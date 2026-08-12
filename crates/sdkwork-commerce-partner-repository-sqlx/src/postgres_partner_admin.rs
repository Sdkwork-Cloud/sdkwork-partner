//! PostgreSQL implementation of `PartnerAdminRepositoryPort`.

use crate::account_adapter::PartnerWalletPort;
use crate::mapping::*;
use crate::partner_admin_sql::*;
use chrono::{DateTime, Utc};
use sdkwork_commerce_partner_service::backend_admin::*;
use sdkwork_commerce_partner_service::commands::*;
use sdkwork_commerce_partner_service::domain::commission_engine::{
    allocate_commissions, CommissionNode,
};
use sdkwork_commerce_partner_service::domain::{
    cents_to_decimal, parse_money_to_cents, parse_ratio_per_10000,
};
use sdkwork_commerce_partner_service::join_apply::{
    ApproveJoinApplicationCommand, CancelJoinApplicationCommand, InviteCodeValidation,
    ListJoinApplicationsQuery, ListMyJoinApplicationsQuery, PartnerJoinApplicationItem,
    PartnerJoinFuture, PartnerJoinRepositoryPort, PartnerJoinSubject, RejectJoinApplicationCommand,
    SubmitJoinApplicationCommand,
};
use sdkwork_commerce_partner_service::queries::*;
use sdkwork_contract_service::CommerceServiceError;
use serde_json::json;
use sqlx::{Postgres, Row, Transaction};
use std::sync::Arc;

pub struct PostgresPartnerAdminRepository {
    pool: sqlx::PgPool,
    /// Partner wallet operations over the account-domain ledger. All balance
    /// writes (commissions, adjustments, withdrawal holds) go through this
    /// port; `partner_wallet`/`partner_ledger_entry` are retired (S4).
    wallet: Arc<dyn PartnerWalletPort>,
}

impl PostgresPartnerAdminRepository {
    pub fn new(pool: sqlx::PgPool, wallet: Arc<dyn PartnerWalletPort>) -> Self {
        Self { pool, wallet }
    }
}

fn next_bigint_id() -> i64 {
    let uuid = uuid::Uuid::new_v4();
    (uuid.as_u128() % i64::MAX as u128) as i64
}

fn next_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn error_from_sql(error: sqlx::Error) -> CommerceServiceError {
    if let sqlx::Error::Database(db_error) = &error {
        if db_error.is_unique_violation() {
            return CommerceServiceError::conflict("unique constraint violated");
        }
    }
    CommerceServiceError::storage(format!("partner repository error: {error}"))
}

async fn insert_audit(
    tx: &mut Transaction<'_, Postgres>,
    subject: &PartnerAdminSubject,
    action: &str,
    target_type: &str,
    target_id: Option<i64>,
    payload: serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(INSERT_AUDIT_LOG)
        .bind(next_bigint_id())
        .bind(next_uuid())
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(subject.user_id)
        .bind("admin")
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(Option::<String>::None)
        .bind(payload.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Audit trail for app-surface join operations (operator_type `app`).
async fn insert_app_audit(
    tx: &mut Transaction<'_, Postgres>,
    subject: &PartnerJoinSubject,
    action: &str,
    target_type: &str,
    target_id: Option<i64>,
    payload: serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(INSERT_AUDIT_LOG)
        .bind(next_bigint_id())
        .bind(next_uuid())
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(subject.user_id)
        .bind("app")
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(Option::<String>::None)
        .bind(payload.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Generate a 10-character uppercase alphanumeric partner invite code from a
/// fresh uuid (36^10 candidates; the partial unique index keeps it unique).
fn generate_invite_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let uuid = uuid::Uuid::new_v4();
    let bytes = uuid.as_bytes();
    let mut value = u64::from_be_bytes(bytes[..8].try_into().unwrap_or([0; 8]));
    let mut code = String::with_capacity(10);
    for _ in 0..10 {
        code.push(ALPHABET[(value % 36) as usize] as char);
        value /= 36;
    }
    code
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}

/// Read the commission config for a tenant, creating the default row if absent.
async fn load_commission_config(
    pool: &sqlx::PgPool,
    tenant_id: i64,
    organization_id: i64,
) -> Result<CommissionConfigItem, CommerceServiceError> {
    for _attempt in 0..2 {
        let row = sqlx::query(
            "SELECT enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount::text, profit_margin_ratio::text              FROM partner_commission_config WHERE tenant_id = $1 AND organization_id = $2",
        )
        .bind(tenant_id)
        .bind(organization_id)
        .fetch_optional(pool)
        .await
        .map_err(error_from_sql)?;
        if let Some(row) = row {
            let sources: serde_json::Value =
                serde_json::from_str(&row.get::<String, _>("revenue_sources")).unwrap_or_default();
            return Ok(CommissionConfigItem {
                enabled: row.get::<bool, _>("enabled"),
                usage_settlement_enabled: sources
                    .get("usage_settlement")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true),
                recharge_enabled: sources
                    .get("recharge")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true),
                max_commission_depth: row.get::<i64, _>("max_commission_depth"),
                currency: row.get::<String, _>("currency"),
                min_withdrawal_amount: row.get::<String, _>("min_withdrawal_amount"),
                profit_margin_ratio: row.get::<String, _>("profit_margin_ratio"),
            });
        }
        // Insert the default config row (single row per tenant); retry once.
        // Commercial defaults mirror the install-time seed catalog: bounded
        // commission depth (3) and a ¥100 minimum withdrawal.
        let _ = sqlx::query(
            "INSERT INTO partner_commission_config              (id, uuid, tenant_id, organization_id, enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount, profit_margin_ratio)              VALUES ($1, $2, $3, $4, TRUE, '{\"usage_settlement\":true,\"recharge\":true}', 3, 'CNY', 100::numeric, 40.00::numeric)              ON CONFLICT (tenant_id, organization_id) DO NOTHING",
        )
        .bind(next_bigint_id())
        .bind(next_uuid())
        .bind(tenant_id)
        .bind(organization_id)
        .execute(pool)
        .await
        .map_err(error_from_sql)?;
    }
    Err(CommerceServiceError::conflict(
        "commission config could not be loaded for tenant",
    ))
}

/// Distribute join-fee commission to the ancestor chain within a transaction.
/// Returns the total distributed amount in cents.
async fn distribute_join_fee_commission(
    tx: &mut Transaction<'_, Postgres>,
    wallet: &Arc<dyn PartnerWalletPort>,
    subject: &PartnerAdminSubject,
    paying_partner_id: i64,
    payment_id: i64,
    amount_cents: i64,
) -> Result<i64, CommerceServiceError> {
    let config = load_commission_config_tx(tx, subject).await?;
    let rows = sqlx::query(SELECT_ANCESTOR_CHAIN)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(paying_partner_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    let mut nodes: Vec<CommissionNode> = Vec::new();
    for row in rows {
        let depth: i32 = row.get("depth");
        let status: String = row.get("status");
        let ratio: i64 = parse_ratio_per_10000(
            "join_fee_commission_ratio",
            &row.get::<String, _>("join_fee_ratio"),
        )?;
        // Join-fee commission flows to ancestors only (depth >= 1) and only
        // to ACTIVE partners.
        if depth >= 1 && status == "ACTIVE" && ratio > 0 {
            nodes.push(CommissionNode {
                partner_id: row.get::<i64, _>("id"),
                level_offset: depth,
                level_no: row.get::<i32, _>("level_no"),
                ratio_per_10000: ratio,
            });
        }
    }
    let allocations = allocate_commissions(amount_cents, &nodes, config.max_commission_depth)
        .map_err(|error| CommerceServiceError::invalid_state(error.message()))?;
    if allocations.is_empty() {
        return Ok(0);
    }
    let distributed: i64 = allocations.iter().map(|a| a.amount_cents).sum();
    let settlement_id = next_bigint_id();
    sqlx::query(INSERT_SETTLEMENT)
        .bind(settlement_id)
        .bind(next_uuid())
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(0_i64) // event_id 0 = join-fee batch (partial unique index exempts it)
        .bind(cents_to_decimal(amount_cents))
        .bind(cents_to_decimal(distributed))
        .bind(allocations.len() as i64)
        .bind("SETTLED")
        .bind(subject.user_id)
        .bind(format!("join_fee:payment:{payment_id}"))
        .execute(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    for allocation in allocations {
        // Commission credit goes through the account-domain ledger; the
        // idempotency key is deterministic per (payment, partner) so reruns
        // replay instead of double-crediting.
        let account_ledger_id = wallet
            .credit_commission(
                subject.tenant_id,
                subject.organization_id,
                allocation.partner_id,
                &config.currency,
                allocation.amount_cents,
                "join_fee_commission",
                "JOIN_FEE_PAYMENT",
                payment_id,
                &format!(
                    "join-fee commission level_offset={}",
                    allocation.level_offset
                ),
                &format!("join-fee:{payment_id}:{}", allocation.partner_id),
            )
            .await?;
        sqlx::query(INSERT_DISTRIBUTION)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(settlement_id)
            .bind(allocation.partner_id)
            .bind(allocation.level_offset)
            .bind(cents_to_decimal(allocation.ratio_per_10000))
            .bind(cents_to_decimal(amount_cents))
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(account_ledger_id)
            .execute(&mut **tx)
            .await
            .map_err(error_from_sql)?;
    }
    Ok(distributed)
}

async fn load_commission_config_tx(
    tx: &mut Transaction<'_, Postgres>,
    subject: &PartnerAdminSubject,
) -> Result<CommissionConfigItem, CommerceServiceError> {
    let row = sqlx::query(
        "SELECT enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount::text, \
         profit_margin_ratio::text FROM partner_commission_config WHERE tenant_id = $1 AND organization_id = $2",
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(error_from_sql)?;
    let row =
        row.ok_or_else(|| CommerceServiceError::conflict("commission config missing for tenant"))?;
    let sources: serde_json::Value =
        serde_json::from_str(&row.get::<String, _>("revenue_sources")).unwrap_or_default();
    Ok(CommissionConfigItem {
        enabled: row.get::<bool, _>("enabled"),
        usage_settlement_enabled: sources
            .get("usage_settlement")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        recharge_enabled: sources
            .get("recharge")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        max_commission_depth: row.get::<i64, _>("max_commission_depth"),
        currency: row.get::<String, _>("currency"),
        min_withdrawal_amount: row.get::<String, _>("min_withdrawal_amount"),
        profit_margin_ratio: row.get::<String, _>("profit_margin_ratio"),
    })
}

/// Settle one pending commission event inside a transaction.
/// Returns (settled: bool, distributed_cents: i64).
async fn settle_event(
    tx: &mut Transaction<'_, Postgres>,
    wallet: &Arc<dyn PartnerWalletPort>,
    subject: &PartnerAdminSubject,
    event_id: i64,
    customer_user_id: i64,
    base_amount_cents: i64,
) -> Result<(bool, i64), CommerceServiceError> {
    let config = load_commission_config_tx(tx, subject).await?;
    if !config.enabled {
        sqlx::query(UPDATE_EVENT_SKIPPED)
            .bind(event_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut **tx)
            .await
            .map_err(error_from_sql)?;
        return Ok((false, 0));
    }
    let binding = sqlx::query(SELECT_ACTIVE_BINDING_FOR_CUSTOMER)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(customer_user_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    let Some(binding) = binding else {
        sqlx::query(UPDATE_EVENT_SKIPPED)
            .bind(event_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut **tx)
            .await
            .map_err(error_from_sql)?;
        return Ok((false, 0));
    };
    let owning_partner_id: i64 = binding.get("partner_id");

    let rows = sqlx::query(SELECT_ANCESTOR_CHAIN)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(owning_partner_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    let mut nodes: Vec<CommissionNode> = Vec::new();
    for row in rows {
        let status: String = row.get("status");
        if status != "ACTIVE" {
            continue;
        }
        let ratio: i64 = parse_ratio_per_10000(
            "customer_revenue_ratio",
            &row.get::<String, _>("customer_ratio"),
        )?;
        if ratio > 0 {
            nodes.push(CommissionNode {
                partner_id: row.get::<i64, _>("id"),
                level_offset: row.get::<i32, _>("depth"),
                level_no: row.get::<i32, _>("level_no"),
                ratio_per_10000: ratio,
            });
        }
    }
    // Profit-based rebate: commissions are allocated on the platform's gross
    // profit of the customer transaction (`revenue × profit_margin_ratio`),
    // never on the full revenue amount. The commission event keeps the
    // original revenue amount; the settlement and distributions record the
    // profit base actually allocated.
    let margin = parse_ratio_per_10000("profit_margin_ratio", &config.profit_margin_ratio)
        .map_err(|error| CommerceServiceError::invalid_state(error.message()))?;
    let profit_base_cents =
        sdkwork_commerce_partner_service::domain::profit_base_cents(base_amount_cents, margin)
            .map_err(|error| CommerceServiceError::invalid_state(error.message()))?;
    let allocations = allocate_commissions(profit_base_cents, &nodes, config.max_commission_depth)
        .map_err(|error| CommerceServiceError::invalid_state(error.message()))?;
    if allocations.is_empty() {
        sqlx::query(UPDATE_EVENT_SKIPPED)
            .bind(event_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut **tx)
            .await
            .map_err(error_from_sql)?;
        return Ok((false, 0));
    }

    let distributed: i64 = allocations.iter().map(|a| a.amount_cents).sum();
    let settlement_id = next_bigint_id();
    sqlx::query(INSERT_SETTLEMENT)
        .bind(settlement_id)
        .bind(next_uuid())
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(event_id)
        .bind(cents_to_decimal(profit_base_cents))
        .bind(cents_to_decimal(distributed))
        .bind(allocations.len() as i64)
        .bind("SETTLED")
        .bind(subject.user_id)
        .bind("")
        .execute(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    for allocation in allocations {
        // Commission credit goes through the account-domain ledger with a
        // deterministic idempotency key per (event, partner).
        let account_ledger_id = wallet
            .credit_commission(
                subject.tenant_id,
                subject.organization_id,
                allocation.partner_id,
                &config.currency,
                allocation.amount_cents,
                "commission_earn",
                "COMMISSION_EVENT",
                event_id,
                &format!(
                    "revenue commission level_offset={}",
                    allocation.level_offset
                ),
                &format!("commission:{event_id}:{}", allocation.partner_id),
            )
            .await?;
        sqlx::query(INSERT_DISTRIBUTION)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(settlement_id)
            .bind(allocation.partner_id)
            .bind(allocation.level_offset)
            .bind(cents_to_decimal(allocation.ratio_per_10000))
            .bind(cents_to_decimal(profit_base_cents))
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(account_ledger_id)
            .execute(&mut **tx)
            .await
            .map_err(error_from_sql)?;
    }
    sqlx::query(UPDATE_EVENT_SETTLED)
        .bind(event_id)
        .bind(subject.tenant_id)
        .bind(subject.user_id)
        .execute(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    Ok((true, distributed))
}

/// Inserts the withdrawal row and its audit record in one transaction. The
/// account hold is created beforehand (own transaction); callers release it
/// best-effort when this row insert fails.
async fn insert_withdrawal_row(
    pool: &sqlx::PgPool,
    subject: &PartnerAdminSubject,
    partner_id: i64,
    withdrawal_id: i64,
    hold_id: i64,
    amount_cents: i64,
    remark: &str,
) -> Result<WithdrawalItem, CommerceServiceError> {
    let mut tx = pool.begin().await.map_err(error_from_sql)?;
    let row = sqlx::query(INSERT_WITHDRAWAL)
        .bind(withdrawal_id)
        .bind(next_uuid())
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(partner_id)
        .bind(cents_to_decimal(amount_cents))
        .bind(hold_id)
        .bind(remark)
        .fetch_one(&mut *tx)
        .await
        .map_err(error_from_sql)?;
    insert_audit(
        &mut tx,
        subject,
        "create_withdrawal",
        "partner_withdrawal",
        Some(withdrawal_id),
        json!({"partner_id": partner_id, "amount": cents_to_decimal(amount_cents)}),
    )
    .await
    .map_err(error_from_sql)?;
    tx.commit().await.map_err(error_from_sql)?;
    Ok(map_withdrawal(&row))
}

impl PartnerAdminRepositoryPort for PostgresPartnerAdminRepository {
    fn retrieve_commission_config<'a>(
        &'a self,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionConfigItem> {
        Box::pin(async move {
            load_commission_config(&self.pool, subject.tenant_id, subject.organization_id).await
        })
    }

    fn update_commission_config<'a>(
        &'a self,
        command: UpdateCommissionConfigCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionConfigItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Ensure the row exists, then update it.
            load_commission_config_tx(&mut tx, subject).await?;
            let sources = json!({
                "usage_settlement": command.usage_settlement_enabled,
                "recharge": command.recharge_enabled,
            });
            sqlx::query(
                "UPDATE partner_commission_config SET enabled = $3, revenue_sources = $4, \
                 max_commission_depth = $5, currency = $6, min_withdrawal_amount = $7::numeric, \
                 updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND organization_id = $2",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.enabled)
            .bind(sources.to_string())
            .bind(command.max_commission_depth)
            .bind(&command.currency)
            .bind(cents_to_decimal(command.min_withdrawal_amount))
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            insert_audit(
                &mut tx,
                subject,
                "update_commission_config",
                "partner_commission_config",
                None,
                json!({"enabled": command.enabled, "max_commission_depth": command.max_commission_depth}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            load_commission_config(&self.pool, subject.tenant_id, subject.organization_id).await
        })
    }

    fn list_levels<'a>(
        &'a self,
        query: ListPartnerLevelsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerLevelItem>> {
        Box::pin(async move {
            let sql = if query.include_disabled {
                "SELECT id, level_no, name, customer_revenue_ratio::text, \
                 join_fee_commission_ratio::text, join_fee::text, status, sort_order, \
                 benefits::text AS benefits \
                 FROM partner_level WHERE tenant_id = $1 AND organization_id = $2 AND deleted_at IS NULL \
                 ORDER BY sort_order ASC, level_no ASC"
            } else {
                "SELECT id, level_no, name, customer_revenue_ratio::text, \
                 join_fee_commission_ratio::text, join_fee::text, status, sort_order, \
                 benefits::text AS benefits \
                 FROM partner_level WHERE tenant_id = $1 AND organization_id = $2 AND deleted_at IS NULL AND status = 'ACTIVE' \
                 ORDER BY sort_order ASC, level_no ASC"
            };
            let rows = sqlx::query(sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(rows.iter().map(map_partner_level).collect())
        })
    }

    fn create_level<'a>(
        &'a self,
        command: CreatePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerLevelItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let level_id = next_bigint_id();
            let result = sqlx::query(
                "INSERT INTO partner_level \
                 (id, uuid, tenant_id, organization_id, level_no, name, customer_revenue_ratio, \
                  join_fee_commission_ratio, join_fee, status, sort_order, benefits) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric, 'ACTIVE', $10, $11::jsonb)",
            )
            .bind(level_id)
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.level_no)
            .bind(&command.name)
            .bind(cents_to_decimal(command.customer_revenue_ratio_per_10000))
            .bind(cents_to_decimal(command.join_fee_commission_ratio_per_10000))
            .bind(cents_to_decimal(command.join_fee_cents))
            .bind(command.sort_order)
            .bind(serde_json::to_string(&command.benefits).unwrap_or_else(|_| "[]".to_string()))
            .execute(&mut *tx)
            .await;
            if let Err(error) = result {
                return Err(error_from_sql(error));
            }
            insert_audit(
                &mut tx,
                subject,
                "create_level",
                "partner_level",
                Some(level_id),
                json!({"level_no": command.level_no, "name": command.name}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let item = PartnerLevelItem {
                id: level_id,
                level_no: command.level_no,
                name: command.name,
                customer_revenue_ratio: cents_to_decimal(command.customer_revenue_ratio_per_10000),
                join_fee_commission_ratio: cents_to_decimal(
                    command.join_fee_commission_ratio_per_10000,
                ),
                join_fee: cents_to_decimal(command.join_fee_cents),
                status: "ACTIVE".to_string(),
                sort_order: command.sort_order,
                benefits: command.benefits,
            };
            Ok(item)
        })
    }

    fn update_level<'a>(
        &'a self,
        command: UpdatePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerLevelItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let updated = sqlx::query(
                "UPDATE partner_level SET name = $3, customer_revenue_ratio = $4::numeric, \
                 join_fee_commission_ratio = $5::numeric, join_fee = $6::numeric, status = $7, \
                 sort_order = $8, benefits = $9::jsonb, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
                 RETURNING level_no",
            )
            .bind(command.level_id)
            .bind(subject.tenant_id)
            .bind(&command.name)
            .bind(cents_to_decimal(command.customer_revenue_ratio_per_10000))
            .bind(cents_to_decimal(
                command.join_fee_commission_ratio_per_10000,
            ))
            .bind(cents_to_decimal(command.join_fee_cents))
            .bind(&command.status)
            .bind(command.sort_order)
            .bind(serde_json::to_string(&command.benefits).unwrap_or_else(|_| "[]".to_string()))
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            let Some(updated) = updated else {
                return Err(CommerceServiceError::not_found("partner level not found"));
            };
            let level_no: i32 = updated.get("level_no");
            insert_audit(
                &mut tx,
                subject,
                "update_level",
                "partner_level",
                Some(command.level_id),
                json!({"status": command.status, "benefit_count": command.benefits.len()}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(PartnerLevelItem {
                id: command.level_id,
                level_no,
                name: command.name,
                customer_revenue_ratio: cents_to_decimal(command.customer_revenue_ratio_per_10000),
                join_fee_commission_ratio: cents_to_decimal(
                    command.join_fee_commission_ratio_per_10000,
                ),
                join_fee: cents_to_decimal(command.join_fee_cents),
                status: command.status,
                sort_order: command.sort_order,
                benefits: command.benefits,
            })
        })
    }

    fn delete_level<'a>(
        &'a self,
        command: DeletePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, ()> {
        Box::pin(async move {
            // Soft delete; block when partners still reference the level.
            let referenced = sqlx::query(
                "SELECT COUNT(*) FROM partner_partner WHERE tenant_id = $1 AND organization_id = $2 \
                 AND level_no = (SELECT level_no FROM partner_level WHERE id = $3) AND deleted_at IS NULL",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.level_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let count: i64 = referenced.get("count");
            if count > 0 {
                return Err(CommerceServiceError::conflict(format!(
                    "level is referenced by {count} partner(s)"
                )));
            }
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let deleted = sqlx::query(
                "UPDATE partner_level SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $3, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
            )
            .bind(command.level_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            if deleted.rows_affected() == 0 {
                return Err(CommerceServiceError::not_found("partner level not found"));
            }
            insert_audit(
                &mut tx,
                subject,
                "delete_level",
                "partner_level",
                Some(command.level_id),
                json!({}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(())
        })
    }

    fn restore_default_levels<'a>(
        &'a self,
        mode: RestoreDefaultLevelsMode,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, RestoreDefaultLevelsResult> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let mut result = RestoreDefaultLevelsResult {
                restored: 0,
                reset: 0,
                skipped: 0,
            };
            for entry in
                sdkwork_commerce_partner_service::domain::default_catalog::DEFAULT_LEVEL_CATALOG
            {
                // Find any row (active or soft-deleted) for this level_no.
                let existing = sqlx::query(
                    "SELECT id, deleted_at FROM partner_level \
                     WHERE tenant_id = $1 AND organization_id = $2 AND level_no = $3 \
                     ORDER BY deleted_at IS NULL DESC, id DESC LIMIT 1",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(entry.level_no)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?;
                let benefits_json = serde_json::to_string(&entry.benefits_as_items())
                    .unwrap_or_else(|_| "[]".to_string());
                match existing {
                    Some(row) => {
                        let level_id: i64 = row.get("id");
                        let deleted_at: Option<DateTime<Utc>> = row.get("deleted_at");
                        if deleted_at.is_some() {
                            // Revive the soft-deleted default level and restore its catalog data.
                            sqlx::query(
                                "UPDATE partner_level SET deleted_at = NULL, deleted_by = NULL, \
                                 name = $4, customer_revenue_ratio = $5::numeric, \
                                 join_fee_commission_ratio = $6::numeric, join_fee = $7::numeric, \
                                 status = 'ACTIVE', sort_order = $8, benefits = $9::jsonb, \
                                 updated_at = CURRENT_TIMESTAMP \
                                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $3",
                            )
                            .bind(level_id)
                            .bind(subject.tenant_id)
                            .bind(subject.organization_id)
                            .bind(entry.name)
                            .bind(cents_to_decimal(entry.customer_revenue_ratio_per_10000))
                            .bind(cents_to_decimal(entry.join_fee_commission_ratio_per_10000))
                            .bind(cents_to_decimal(entry.join_fee_cents))
                            .bind(entry.sort_order)
                            .bind(&benefits_json)
                            .execute(&mut *tx)
                            .await
                            .map_err(error_from_sql)?;
                            result.restored += 1;
                        } else if mode == RestoreDefaultLevelsMode::Reset {
                            sqlx::query(
                                "UPDATE partner_level SET name = $4, \
                                 customer_revenue_ratio = $5::numeric, \
                                 join_fee_commission_ratio = $6::numeric, join_fee = $7::numeric, \
                                 status = 'ACTIVE', sort_order = $8, benefits = $9::jsonb, \
                                 updated_at = CURRENT_TIMESTAMP \
                                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $3",
                            )
                            .bind(level_id)
                            .bind(subject.tenant_id)
                            .bind(subject.organization_id)
                            .bind(entry.name)
                            .bind(cents_to_decimal(entry.customer_revenue_ratio_per_10000))
                            .bind(cents_to_decimal(entry.join_fee_commission_ratio_per_10000))
                            .bind(cents_to_decimal(entry.join_fee_cents))
                            .bind(entry.sort_order)
                            .bind(&benefits_json)
                            .execute(&mut *tx)
                            .await
                            .map_err(error_from_sql)?;
                            result.reset += 1;
                        } else {
                            result.skipped += 1;
                        }
                    }
                    None => {
                        let level_id = next_bigint_id();
                        sqlx::query(
                            "INSERT INTO partner_level \
                             (id, uuid, tenant_id, organization_id, level_no, name, \
                              customer_revenue_ratio, join_fee_commission_ratio, join_fee, \
                              status, sort_order, benefits) \
                             VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, \
                                     $9::numeric, 'ACTIVE', $10, $11::jsonb)",
                        )
                        .bind(level_id)
                        .bind(next_uuid())
                        .bind(subject.tenant_id)
                        .bind(subject.organization_id)
                        .bind(entry.level_no)
                        .bind(entry.name)
                        .bind(cents_to_decimal(entry.customer_revenue_ratio_per_10000))
                        .bind(cents_to_decimal(entry.join_fee_commission_ratio_per_10000))
                        .bind(cents_to_decimal(entry.join_fee_cents))
                        .bind(entry.sort_order)
                        .bind(&benefits_json)
                        .execute(&mut *tx)
                        .await
                        .map_err(error_from_sql)?;
                        result.restored += 1;
                    }
                }
            }
            insert_audit(
                &mut tx,
                subject,
                "restore_default_levels",
                "partner_level",
                None,
                json!({
                    "mode": if mode == RestoreDefaultLevelsMode::Reset { "reset" } else { "fill" },
                    "restored": result.restored,
                    "reset": result.reset,
                    "skipped": result.skipped,
                }),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(result)
        })
    }

    fn list_partners<'a>(
        &'a self,
        query: ListPartnersQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<PartnerItem>> {
        Box::pin(async move {
            let q = query.list.q.as_deref();
            let total = sqlx::query(COUNT_PARTNERS)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.status.as_deref())
                .bind(query.level_no)
                .bind(q)
                .bind(query.created_from.as_deref())
                .bind(query.created_to.as_deref())
                .bind(query.join_fee_status.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(LIST_PARTNERS)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.status.as_deref())
                .bind(query.level_no)
                .bind(q)
                .bind(query.created_from.as_deref())
                .bind(query.created_to.as_deref())
                .bind(query.join_fee_status.as_deref())
                .bind(query.list.page_size)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_partner).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn retrieve_partner<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem> {
        Box::pin(async move {
            let row = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("partner not found"))?;
            Ok(map_partner(&row))
        })
    }

    fn create_partner<'a>(
        &'a self,
        command: CreatePartnerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem> {
        Box::pin(async move {
            // The parent must exist and be active when provided.
            if let Some(parent_id) = command.parent_partner_id {
                let parent = sqlx::query(SELECT_PARTNER_BY_ID)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(parent_id)
                    .fetch_optional(&self.pool)
                    .await
                    .map_err(error_from_sql)?
                    .ok_or_else(|| CommerceServiceError::not_found("parent partner not found"))?;
                let parent_status: String = parent.get("status");
                if parent_status != "ACTIVE" {
                    return Err(CommerceServiceError::invalid_state(
                        "parent partner is not active",
                    ));
                }
            }
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // The level must exist; an unknown level would silently break the
            // commission policy of the partner.
            let level_count: i64 = sqlx::query(
                "SELECT COUNT(*) FROM partner_level \
                 WHERE tenant_id = $1 AND organization_id = $2 AND level_no = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.level_no)
            .fetch_one(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .get("count");
            if level_count == 0 {
                return Err(CommerceServiceError::validation(format!(
                    "partner level {} does not exist",
                    command.level_no
                )));
            }
            let partner_id = next_bigint_id();
            // Every partner receives an invite code (伙伴计划 referral code)
            // at creation; the partial unique index keeps codes unique.
            let invite_code = generate_invite_code();
            let result = sqlx::query(INSERT_PARTNER)
                .bind(partner_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(&command.name)
                .bind(&command.contact_name)
                .bind(&command.phone)
                .bind(&command.email)
                .bind(command.level_no)
                .bind(command.parent_partner_id)
                .bind(command.user_account_id)
                .bind("PENDING")
                .bind("0.00")
                .bind("UNPAID")
                .bind(Option::<DateTime<Utc>>::None)
                .bind(subject.user_id)
                .bind(&command.remark)
                .bind(&invite_code)
                .execute(&mut *tx)
                .await;
            if let Err(error) = result {
                return Err(error_from_sql(error));
            }
            insert_audit(
                &mut tx,
                subject,
                "create_partner",
                "partner_partner",
                Some(partner_id),
                json!({"name": command.name, "level_no": command.level_no}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(partner_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner(&row))
        })
    }

    fn update_partner<'a>(
        &'a self,
        command: UpdatePartnerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Lock the partner row so the CLOSED terminal-state check and the
            // parent/user validations below are race-free against a
            // concurrent close or rebind.
            let current = sqlx::query(
                "SELECT status, parent_partner_id, user_account_id FROM partner_partner \
                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $3 AND deleted_at IS NULL \
                 FOR UPDATE",
            )
            .bind(command.partner_id)
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .ok_or_else(|| CommerceServiceError::not_found("partner not found"))?;
            let current_status: String = current.get("status");
            let current_parent: Option<i64> = current.get("parent_partner_id");
            let current_user: Option<i64> = current.get("user_account_id");
            if current_status == "CLOSED" && command.status != "CLOSED" {
                return Err(CommerceServiceError::invalid_state(
                    "closed partners cannot be reactivated",
                ));
            }
            // Closed partners keep their relations frozen: neither the parent
            // nor the bound user account may change once closed (same policy
            // as bind_partner_user_account).
            if current_status == "CLOSED"
                && (command.parent_partner_id != current_parent
                    || command.user_account_id != current_user)
            {
                return Err(CommerceServiceError::invalid_state(
                    "closed partners cannot have their parent or user account changed",
                ));
            }
            // The new parent must exist, be active, and must not create a
            // cycle: a partner cannot become the parent of itself or of one
            // of its descendants.
            if let Some(parent_id) = command.parent_partner_id {
                if parent_id == command.partner_id {
                    return Err(CommerceServiceError::validation(
                        "a partner cannot be its own parent",
                    ));
                }
                let parent = sqlx::query(SELECT_PARTNER_BY_ID)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(parent_id)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(error_from_sql)?
                    .ok_or_else(|| CommerceServiceError::not_found("parent partner not found"))?;
                let parent_status: String = parent.get("status");
                if parent_status != "ACTIVE" {
                    return Err(CommerceServiceError::invalid_state(
                        "parent partner is not active",
                    ));
                }
                let cycle_count: i64 = sqlx::query(COUNT_PARTNER_DESCENDANTS)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(command.partner_id)
                    .bind(parent_id)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(error_from_sql)?
                    .get("count");
                if cycle_count > 0 {
                    return Err(CommerceServiceError::validation(
                        "parent partner cannot be a descendant of the partner",
                    ));
                }
            }
            // The level must exist; an unknown level would silently break the
            // commission policy of the partner.
            let level_count: i64 = sqlx::query(
                "SELECT COUNT(*) FROM partner_level \
                 WHERE tenant_id = $1 AND organization_id = $2 AND level_no = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.level_no)
            .fetch_one(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .get("count");
            if level_count == 0 {
                return Err(CommerceServiceError::validation(format!(
                    "partner level {} does not exist",
                    command.level_no
                )));
            }
            // The IAM user account may only belong to one partner (unique
            // index); check explicitly for a human-readable conflict instead
            // of relying on the unique-violation mapping (same check as
            // bind_partner_user_account).
            if let Some(user_account_id) = command.user_account_id {
                let occupying: i64 = sqlx::query(
                    "SELECT COUNT(*) FROM partner_partner \
                     WHERE tenant_id = $1 AND organization_id = $2 AND user_account_id = $3 \
                       AND id != $4 AND deleted_at IS NULL",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(user_account_id)
                .bind(command.partner_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .get("count");
                if occupying > 0 {
                    return Err(CommerceServiceError::conflict(
                        "the IAM user account is already bound to another partner",
                    ));
                }
            }
            let updated = sqlx::query(
                "UPDATE partner_partner SET name = $3, contact_name = $4, phone = $5, email = $6, \
                 level_no = $7, status = $8, remark = $9, parent_partner_id = $10, \
                 user_account_id = $11, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $12 AND deleted_at IS NULL",
            )
            .bind(command.partner_id)
            .bind(subject.tenant_id)
            .bind(&command.name)
            .bind(&command.contact_name)
            .bind(&command.phone)
            .bind(&command.email)
            .bind(command.level_no)
            .bind(&command.status)
            .bind(&command.remark)
            .bind(command.parent_partner_id)
            .bind(command.user_account_id)
            .bind(subject.organization_id)
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            if updated.rows_affected() == 0 {
                return Err(CommerceServiceError::not_found("partner not found"));
            }
            insert_audit(
                &mut tx,
                subject,
                "update_partner",
                "partner_partner",
                Some(command.partner_id),
                json!({
                    "status": command.status,
                    "level_no": command.level_no,
                    "parent_partner_id": command.parent_partner_id,
                    "user_account_id": command.user_account_id,
                }),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner(&row))
        })
    }

    fn bind_partner_user_account<'a>(
        &'a self,
        command: BindPartnerUserAccountCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Lock the partner row so the CLOSED terminal-state check and the
            // user-account uniqueness check are race-free.
            let current = sqlx::query(
                "SELECT status, user_account_id FROM partner_partner \
                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $3 AND deleted_at IS NULL \
                 FOR UPDATE",
            )
            .bind(command.partner_id)
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .ok_or_else(|| CommerceServiceError::not_found("partner not found"))?;
            let current_status: String = current.get("status");
            if current_status == "CLOSED" {
                return Err(CommerceServiceError::invalid_state(
                    "closed partners cannot have their user account changed",
                ));
            }
            // The IAM user account may only belong to one partner (unique
            // index); check explicitly for a human-readable conflict instead
            // of relying on the unique-violation mapping.
            let occupying: i64 = sqlx::query(
                "SELECT COUNT(*) FROM partner_partner \
                 WHERE tenant_id = $1 AND organization_id = $2 AND user_account_id = $3 \
                   AND id != $4 AND deleted_at IS NULL",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.user_account_id)
            .bind(command.partner_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .get("count");
            if occupying > 0 {
                return Err(CommerceServiceError::conflict(
                    "the IAM user account is already bound to another partner",
                ));
            }
            let updated = sqlx::query(
                "UPDATE partner_partner SET user_account_id = $3, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND organization_id = $4 AND deleted_at IS NULL",
            )
            .bind(command.partner_id)
            .bind(subject.tenant_id)
            .bind(command.user_account_id)
            .bind(subject.organization_id)
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            if updated.rows_affected() == 0 {
                return Err(CommerceServiceError::not_found("partner not found"));
            }
            insert_audit(
                &mut tx,
                subject,
                "bind_user_account",
                "partner_partner",
                Some(command.partner_id),
                json!({"user_account_id": command.user_account_id}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner(&row))
        })
    }

    fn list_partner_tree<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerTreeItem>> {
        Box::pin(async move {
            let rows = sqlx::query(
                "WITH RECURSIVE descendants AS ( \
                 SELECT p.id, p.parent_partner_id, p.name, p.level_no, p.status \
                 FROM partner_partner p \
                 WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.id = $3 AND p.deleted_at IS NULL \
                 UNION ALL \
                 SELECT p.id, p.parent_partner_id, p.name, p.level_no, p.status \
                 FROM partner_partner p \
                 JOIN descendants d ON p.parent_partner_id = d.id \
                 WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL) \
                 SELECT id, parent_partner_id, name, level_no, status FROM descendants \
                 ORDER BY id",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let mut by_parent: std::collections::HashMap<Option<i64>, Vec<PartnerTreeItem>> =
                std::collections::HashMap::new();
            for row in rows {
                let item = PartnerTreeItem {
                    id: row.get("id"),
                    name: row.get("name"),
                    level_no: row.get("level_no"),
                    status: row.get("status"),
                    children: Vec::new(),
                };
                by_parent
                    .entry(row.get("parent_partner_id"))
                    .or_default()
                    .push(item);
            }
            fn build(
                by_parent: &std::collections::HashMap<Option<i64>, Vec<PartnerTreeItem>>,
                parent: Option<i64>,
            ) -> Vec<PartnerTreeItem> {
                by_parent
                    .get(&parent)
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .map(|mut item| {
                        let children = build(by_parent, Some(item.id));
                        item.children = children;
                        item
                    })
                    .collect()
            }
            Ok(build(&by_parent, Some(query.partner_id)))
        })
    }

    fn list_partner_ancestors<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerAncestorItem>> {
        Box::pin(async move {
            let rows = sqlx::query(SELECT_ANCESTOR_CHAIN)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(rows
                .iter()
                .map(|row| PartnerAncestorItem {
                    id: row.get("id"),
                    name: String::new(),
                    level_no: row.get("level_no"),
                    status: row.get("status"),
                    level_offset: row.get("depth"),
                })
                .collect())
        })
    }

    fn list_join_fee_payments<'a>(
        &'a self,
        query: ListJoinFeePaymentsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<JoinFeePaymentItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_join_fee_payment p \
                             WHERE p.tenant_id = $1 AND p.organization_id = $2 \
                             AND ($3::bigint IS NULL OR p.partner_id = $3) \
                             AND ($4::text IS NULL OR p.status = $4)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.status.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT id, partner_id, amount::text, currency, status, payment_method, \
                 paid_at, paid_by, remark, created_at FROM partner_join_fee_payment p \
                 WHERE p.tenant_id = $1 AND p.organization_id = $2 \
                 AND ($3::bigint IS NULL OR p.partner_id = $3) \
                 AND ($4::text IS NULL OR p.status = $4) \
                 ORDER BY p.created_at DESC, p.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.status.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_join_fee_payment).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn create_join_fee_payment<'a>(
        &'a self,
        command: CreateJoinFeePaymentCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, JoinFeePaymentItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Partner must exist.
            let partner_exists = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .is_some();
            if !partner_exists {
                return Err(CommerceServiceError::not_found("partner not found"));
            }
            let payment_id = next_bigint_id();
            let inserted = sqlx::query(INSERT_JOIN_FEE_PAYMENT)
                .bind(payment_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind(cents_to_decimal(command.amount_cents))
                .bind(&command.currency)
                .bind(&command.payment_method)
                .bind(subject.user_id)
                .bind(&command.remark)
                .bind(&command.idempotency_key)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            let Some(row) = inserted else {
                // Idempotent replay: a payment with the same idempotency key
                // already exists (its commission was already distributed), so
                // return the existing payment without re-triggering anything.
                let key = command.idempotency_key.as_deref().unwrap_or_default();
                let row = sqlx::query(SELECT_JOIN_FEE_PAYMENT_BY_IDEMPOTENCY_KEY)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(key)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(error_from_sql)?;
                tx.commit().await.map_err(error_from_sql)?;
                return Ok(map_join_fee_payment(&row));
            };
            sqlx::query(UPDATE_PARTNER_JOIN_FEE_PAID)
                .bind(command.partner_id)
                .bind(subject.tenant_id)
                .bind(cents_to_decimal(command.amount_cents))
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            // Trigger multi-level join-fee commission for ancestors.
            let distributed = distribute_join_fee_commission(
                &mut tx,
                &self.wallet,
                subject,
                command.partner_id,
                payment_id,
                command.amount_cents,
            )
            .await?;
            insert_audit(
                &mut tx,
                subject,
                "create_join_fee_payment",
                "partner_join_fee_payment",
                Some(payment_id),
                json!({"amount": cents_to_decimal(command.amount_cents), "distributed_commission": distributed}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(map_join_fee_payment(&row))
        })
    }

    fn list_customer_bindings<'a>(
        &'a self,
        query: ListCustomerBindingsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<CustomerBindingItem>> {
        Box::pin(async move {
            let q = query.list.q.as_deref();
            let count_sql = "SELECT COUNT(*) FROM partner_customer_binding b \
                             WHERE b.tenant_id = $1 AND b.organization_id = $2 \
                             AND ($3::bigint IS NULL OR b.partner_id = $3) \
                             AND ($4::text IS NULL OR b.status = $4) \
                             AND ($5::text IS NULL OR b.customer_user_id::text = $5 OR b.partner_id::text = $5)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.status.as_deref())
                .bind(q)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT b.id, b.partner_id, b.customer_user_id, b.binding_type, b.status, \
                 b.bound_at, b.bound_by, b.unbound_at, b.unbound_by, b.created_at \
                 FROM partner_customer_binding b \
                 WHERE b.tenant_id = $1 AND b.organization_id = $2 \
                 AND ($3::bigint IS NULL OR b.partner_id = $3) \
                 AND ($4::text IS NULL OR b.status = $4) \
                 AND ($5::text IS NULL OR b.customer_user_id::text = $5 OR b.partner_id::text = $5) \
                 ORDER BY b.created_at DESC, b.id DESC LIMIT $6 OFFSET $7",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.status.as_deref())
            .bind(q)
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_customer_binding).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn bind_customer<'a>(
        &'a self,
        command: BindCustomerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CustomerBindingItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let partner = sqlx::query(SELECT_PARTNER_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("partner not found"))?;
            let partner_status: String = partner.get("status");
            if partner_status != "ACTIVE" {
                return Err(CommerceServiceError::invalid_state("partner is not active"));
            }
            let binding_id = next_bigint_id();
            let result = sqlx::query(INSERT_CUSTOMER_BINDING)
                .bind(binding_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind(command.customer_user_id)
                .bind(&command.binding_type)
                .bind(subject.user_id)
                .execute(&mut *tx)
                .await;
            if let Err(error) = result {
                return Err(error_from_sql(error));
            }
            insert_audit(
                &mut tx,
                subject,
                "bind_customer",
                "partner_customer_binding",
                Some(binding_id),
                json!({"partner_id": command.partner_id, "customer_user_id": command.customer_user_id}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(
                "SELECT id, partner_id, customer_user_id, binding_type, status, bound_at, \
                 bound_by, unbound_at, unbound_by, created_at FROM partner_customer_binding \
                 WHERE tenant_id = $1 AND organization_id = $2 AND id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(binding_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(map_customer_binding(&row))
        })
    }

    fn unbind_customer<'a>(
        &'a self,
        command: UnbindCustomerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, ()> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let updated = sqlx::query(
                "UPDATE partner_customer_binding SET status = 'UNBOUND', unbound_at = CURRENT_TIMESTAMP, \
                 unbound_by = $3, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'",
            )
            .bind(command.binding_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            if updated.rows_affected() == 0 {
                return Err(CommerceServiceError::not_found(
                    "active customer binding not found",
                ));
            }
            insert_audit(
                &mut tx,
                subject,
                "unbind_customer",
                "partner_customer_binding",
                Some(command.binding_id),
                json!({}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(())
        })
    }

    fn list_commission_events<'a>(
        &'a self,
        query: ListCommissionEventsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<CommissionEventItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_commission_event e \
                             WHERE e.tenant_id = $1 AND e.organization_id = $2 \
                             AND ($3::text IS NULL OR e.status = $3) \
                             AND ($4::text IS NULL OR e.source_type = $4)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.status.as_deref())
                .bind(query.source_type.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT e.id, e.source_type, e.source_ref, e.customer_user_id, e.base_amount::text, \
                 e.event_at, e.status, e.settled_at, e.remark, e.created_at \
                 FROM partner_commission_event e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 \
                 AND ($3::text IS NULL OR e.status = $3) \
                 AND ($4::text IS NULL OR e.source_type = $4) \
                 ORDER BY e.event_at DESC, e.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.status.as_deref())
            .bind(query.source_type.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_commission_event).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn create_manual_commission_event<'a>(
        &'a self,
        command: CreateManualCommissionEventCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionEventItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let event_at: DateTime<Utc> = if command.event_at.trim().is_empty() {
                Utc::now()
            } else {
                DateTime::parse_from_rfc3339(command.event_at.trim())
                    .map(|value| value.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now())
            };
            let event_id = next_bigint_id();
            let result = sqlx::query(INSERT_COMMISSION_EVENT)
                .bind(event_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind("MANUAL")
                .bind(&command.source_ref)
                .bind(command.customer_user_id)
                .bind(cents_to_decimal(command.base_amount_cents))
                .bind(event_at)
                .bind(&command.remark)
                .execute(&mut *tx)
                .await;
            if let Err(error) = result {
                return Err(error_from_sql(error));
            }
            insert_audit(
                &mut tx,
                subject,
                "create_manual_commission_event",
                "partner_commission_event",
                Some(event_id),
                json!({"source_ref": command.source_ref, "customer_user_id": command.customer_user_id}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(
                "SELECT id, source_type, source_ref, customer_user_id, base_amount::text, \
                 event_at, status, settled_at, remark, created_at FROM partner_commission_event \
                 WHERE tenant_id = $1 AND organization_id = $2 AND id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(event_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(map_commission_event(&row))
        })
    }

    fn run_commission_settlement<'a>(
        &'a self,
        command: RunCommissionSettlementCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, SettlementRunResult> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let rows = sqlx::query(SELECT_PENDING_EVENTS_FOR_SETTLEMENT)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.limit)
                .fetch_all(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            let mut result = SettlementRunResult {
                processed: rows.len() as i64,
                settled: 0,
                skipped: 0,
                failed: 0,
            };
            for row in rows {
                let event_id: i64 = row.get("id");
                let customer_user_id: i64 = row.get("customer_user_id");
                let base_amount =
                    parse_money_to_cents("base_amount", &row.get::<String, _>("base_amount"))?;
                match settle_event(
                    &mut tx,
                    &self.wallet,
                    subject,
                    event_id,
                    customer_user_id,
                    base_amount,
                )
                .await
                {
                    Ok((settled, _)) => {
                        if settled {
                            result.settled += 1;
                        } else {
                            result.skipped += 1;
                        }
                    }
                    Err(_) => {
                        // Mark failed and continue the batch.
                        result.failed += 1;
                        let _ = sqlx::query(
                            "UPDATE partner_commission_event SET status = 'FAILED', settled_at = CURRENT_TIMESTAMP \
                             WHERE id = $1 AND tenant_id = $2",
                        )
                        .bind(event_id)
                        .bind(subject.tenant_id)
                        .execute(&mut *tx)
                        .await;
                    }
                }
            }
            insert_audit(
                &mut tx,
                subject,
                "run_commission_settlement",
                "partner_commission_settlement",
                None,
                json!({"processed": result.processed, "settled": result.settled, "skipped": result.skipped, "failed": result.failed}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(result)
        })
    }

    fn list_settlements<'a>(
        &'a self,
        query: ListSettlementsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<SettlementItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_commission_settlement s \
                             WHERE s.tenant_id = $1 AND s.organization_id = $2 \
                             AND ($3::bigint IS NULL OR EXISTS (SELECT 1 FROM partner_commission_distribution d \
                                 WHERE d.settlement_id = s.id AND d.receiver_partner_id = $3)) \
                             AND ($4::text IS NULL OR s.status = $4)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.status.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT s.id, s.event_id, s.base_amount::text, s.distributed_amount::text, \
                 s.receiver_count, s.status, s.computed_at, s.remark \
                 FROM partner_commission_settlement s \
                 WHERE s.tenant_id = $1 AND s.organization_id = $2 \
                 AND ($3::bigint IS NULL OR EXISTS (SELECT 1 FROM partner_commission_distribution d \
                     WHERE d.settlement_id = s.id AND d.receiver_partner_id = $3)) \
                 AND ($4::text IS NULL OR s.status = $4) \
                 ORDER BY s.computed_at DESC, s.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.status.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let mut items = Vec::with_capacity(rows.len());
            for row in rows {
                let settlement_id: i64 = row.get("id");
                let distribution_rows = sqlx::query(
                    "SELECT id, settlement_id, receiver_partner_id, level_offset, ratio::text, \
                     base_amount::text, amount::text, created_at FROM partner_commission_distribution \
                     WHERE tenant_id = $1 AND organization_id = $2 AND settlement_id = $3 \
                     ORDER BY level_offset ASC, id ASC",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(settlement_id)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
                items.push(map_settlement(&row, &distribution_rows));
            }
            Ok(PartnerAdminListPage {
                items,
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn list_ledger_entries<'a>(
        &'a self,
        query: ListLedgerEntriesQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<LedgerEntryItem>> {
        Box::pin(async move {
            // The partner ledger is the account-domain ledger
            // (`acct_ledger_entry`, owner_type=PARTNER, purpose=SETTLEMENT);
            // partner_wallet/partner_ledger_entry are retired (S4).
            // The partner ledger is the account-domain ledger
            // (`acct_ledger_entry`, owner_type=PARTNER, purpose=SETTLEMENT);
            // partner_wallet/partner_ledger_entry are retired (S4). The
            // `entry_type` filter keeps the legacy public enum values and maps
            // them onto the account `business_type` labels.
            let count_sql = "SELECT COUNT(*) FROM acct_ledger_entry e \
                             WHERE e.tenant_id = $1 AND e.organization_id = $2 \
                               AND e.owner_type = 'PARTNER' AND e.owner_id = $3 \
                             AND ($4::text IS NULL OR \
                                  e.business_type = CASE $4 \
                                    WHEN 'JOIN_FEE_COMMISSION' THEN 'join_fee_commission' \
                                    WHEN 'REVENUE_COMMISSION' THEN 'commission_earn' \
                                    WHEN 'MANUAL_ADJUST' THEN 'commission_adjustment' \
                                    WHEN 'WITHDRAWAL_PAID' THEN 'commission_withdraw_paid' \
                                    WHEN 'WITHDRAWAL_APPLY' THEN 'commission_withdraw_hold' \
                                    WHEN 'WITHDRAWAL_REJECT' THEN 'commission_withdraw_release' \
                                    ELSE $4 END)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.entry_type.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            // Project account-domain ledger rows onto the legacy partner
            // ledger shape: business_type -> entry_type, minor units (cents) ->
            // decimal strings, source encoded in `business_no`, and the
            // adjustment operator in `idempotency_key` part 3.
            let rows = sqlx::query(
                "SELECT e.id, e.owner_id AS partner_id, \
                 CASE e.business_type \
                   WHEN 'join_fee_commission' THEN 'JOIN_FEE_COMMISSION' \
                   WHEN 'commission_earn' THEN 'REVENUE_COMMISSION' \
                   WHEN 'commission_adjustment' THEN 'MANUAL_ADJUST' \
                   WHEN 'commission_withdraw_paid' THEN 'WITHDRAWAL_PAID' \
                   ELSE e.business_type \
                 END AS entry_type, \
                 CASE WHEN e.direction = 'CREDIT' THEN 'IN' ELSE 'OUT' END AS direction, \
                 round(e.amount::numeric / 100, 2)::text AS amount, \
                 round(e.balance_after::numeric / 100, 2)::text AS balance_after, \
                 CASE e.business_type \
                   WHEN 'join_fee_commission' THEN 'JOIN_FEE_PAYMENT' \
                   WHEN 'commission_earn' THEN 'COMMISSION_EVENT' \
                   WHEN 'commission_withdraw_paid' THEN 'PARTNER_WITHDRAWAL' \
                   ELSE '' \
                 END AS ref_type, \
                 CASE e.business_type \
                   WHEN 'commission_adjustment' THEN NULL \
                   ELSE NULLIF(split_part(e.business_no, ':', 2), '')::bigint \
                 END AS ref_id, \
                 CASE e.business_type \
                   WHEN 'commission_adjustment' THEN NULLIF(split_part(e.idempotency_key, ':', 3), '')::bigint \
                   ELSE 0 \
                 END AS operator_id, \
                 COALESCE(e.remark, '') AS remark, e.created_at \
                 FROM acct_ledger_entry e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 \
                   AND e.owner_type = 'PARTNER' AND e.owner_id = $3 \
                 AND ($4::text IS NULL OR \
                      e.business_type = CASE $4 \
                        WHEN 'JOIN_FEE_COMMISSION' THEN 'join_fee_commission' \
                        WHEN 'REVENUE_COMMISSION' THEN 'commission_earn' \
                        WHEN 'MANUAL_ADJUST' THEN 'commission_adjustment' \
                        WHEN 'WITHDRAWAL_PAID' THEN 'commission_withdraw_paid' \
                        WHEN 'WITHDRAWAL_APPLY' THEN 'commission_withdraw_hold' \
                        WHEN 'WITHDRAWAL_REJECT' THEN 'commission_withdraw_release' \
                        ELSE $4 END) \
                 ORDER BY e.created_at DESC, e.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.entry_type.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_ledger_entry).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn list_audit_logs<'a>(
        &'a self,
        query: ListAuditLogsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<AuditLogItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_audit_log a \
                             WHERE a.tenant_id = $1 AND a.organization_id = $2 \
                             AND ($3::text IS NULL OR a.action = $3) \
                             AND ($4::text IS NULL OR a.target_type = $4) \
                             AND ($5::bigint IS NULL OR a.target_id = $5) \
                             AND ($6::bigint IS NULL OR a.operator_id = $6)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.action.as_deref())
                .bind(query.target_type.as_deref())
                .bind(query.target_id)
                .bind(query.operator_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT a.id, a.operator_id, a.operator_type, a.action, a.target_type, \
                        a.target_id, a.request_id, a.payload, a.created_at \
                 FROM partner_audit_log a \
                 WHERE a.tenant_id = $1 AND a.organization_id = $2 \
                 AND ($3::text IS NULL OR a.action = $3) \
                 AND ($4::text IS NULL OR a.target_type = $4) \
                 AND ($5::bigint IS NULL OR a.target_id = $5) \
                 AND ($6::bigint IS NULL OR a.operator_id = $6) \
                 ORDER BY a.created_at DESC, a.id DESC LIMIT $7 OFFSET $8",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.action.as_deref())
            .bind(query.target_type.as_deref())
            .bind(query.target_id)
            .bind(query.operator_id)
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_audit_log).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn create_ledger_adjustment<'a>(
        &'a self,
        command: CreateLedgerAdjustmentCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, LedgerEntryItem> {
        Box::pin(async move {
            let config =
                load_commission_config(&self.pool, subject.tenant_id, subject.organization_id)
                    .await?;
            // Manual adjustments mutate the account-domain ledger through the
            // wallet port; negative amounts become DEBIT entries and are
            // validated against the available balance by the account store.
            // The idempotency key embeds the operator (part 3) so the ledger
            // view can surface who adjusted.
            let idempotency_key = format!(
                "adjust:{}:{}:{}",
                command.partner_id,
                subject.user_id,
                next_uuid()
            );
            let ledger_id = if command.amount_cents > 0 {
                self.wallet
                    .credit_commission(
                        subject.tenant_id,
                        subject.organization_id,
                        command.partner_id,
                        &config.currency,
                        command.amount_cents,
                        "commission_adjustment",
                        "MANUAL_ADJUST",
                        0,
                        &command.remark,
                        &idempotency_key,
                    )
                    .await?
            } else {
                match self
                    .wallet
                    .debit_commission(
                        subject.tenant_id,
                        subject.organization_id,
                        command.partner_id,
                        &config.currency,
                        command.amount_cents.unsigned_abs() as i64,
                        "MANUAL_ADJUST",
                        0,
                        &command.remark,
                        &idempotency_key,
                    )
                    .await
                {
                    Ok(ledger_id) => ledger_id,
                    Err(error) if error.message() == "insufficient account balance" => {
                        return Err(CommerceServiceError::invalid_state(
                            "adjustment would make the wallet balance negative",
                        ));
                    }
                    Err(error) => return Err(error),
                }
            };
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            insert_audit(
                &mut tx,
                subject,
                "create_ledger_adjustment",
                "acct_ledger_entry",
                Some(ledger_id),
                json!({"partner_id": command.partner_id, "amount": cents_to_decimal(command.amount_cents)}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(
                "SELECT e.id, e.owner_id AS partner_id, \
                 CASE e.business_type WHEN 'commission_adjustment' THEN 'MANUAL_ADJUST' \
                   ELSE e.business_type END AS entry_type, \
                 CASE WHEN e.direction = 'CREDIT' THEN 'IN' ELSE 'OUT' END AS direction, \
                 round(e.amount::numeric / 100, 2)::text AS amount, \
                 round(e.balance_after::numeric / 100, 2)::text AS balance_after, \
                 '' AS ref_type, NULL::bigint AS ref_id, \
                 NULLIF(split_part(e.idempotency_key, ':', 3), '')::bigint AS operator_id, \
                 COALESCE(e.remark, '') AS remark, e.created_at \
                 FROM acct_ledger_entry e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 AND e.id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(ledger_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(map_ledger_entry(&row))
        })
    }

    fn list_withdrawals<'a>(
        &'a self,
        query: ListWithdrawalsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<WithdrawalItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_withdrawal w \
                             WHERE w.tenant_id = $1 AND w.organization_id = $2 \
                             AND ($3::bigint IS NULL OR w.partner_id = $3) \
                             AND ($4::text IS NULL OR w.status = $4)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.status.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT w.id, w.partner_id, w.amount::text, w.status, w.reviewed_by, w.reviewed_at, \
                 w.review_remark, w.paid_at, w.paid_by, w.remark, w.created_at, w.updated_at \
                 FROM partner_withdrawal w \
                 WHERE w.tenant_id = $1 AND w.organization_id = $2 \
                 AND ($3::bigint IS NULL OR w.partner_id = $3) \
                 AND ($4::text IS NULL OR w.status = $4) \
                 ORDER BY w.created_at DESC, w.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.status.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_withdrawal).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn create_withdrawal<'a>(
        &'a self,
        command: CreateWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem> {
        Box::pin(async move {
            let config =
                load_commission_config(&self.pool, subject.tenant_id, subject.organization_id)
                    .await?;
            let min_amount =
                parse_money_to_cents("min_withdrawal_amount", &config.min_withdrawal_amount)?;
            if command.amount_cents < min_amount {
                return Err(CommerceServiceError::validation(format!(
                    "amount is below the minimum withdrawal amount {}",
                    config.min_withdrawal_amount
                )));
            }
            // Freeze the commission through the account-domain hold; the hold
            // is created before the withdrawal row so an idempotent retry can
            // never double-freeze. On a later insert failure the hold is
            // released best-effort.
            let available = self
                .wallet
                .available_balance_cents(
                    subject.tenant_id,
                    subject.organization_id,
                    command.partner_id,
                    &config.currency,
                )
                .await?;
            if command.amount_cents > available {
                return Err(CommerceServiceError::invalid_state(
                    "withdrawal amount exceeds the available balance",
                ));
            }
            let withdrawal_id = next_bigint_id();
            let hold_id = match self
                .wallet
                .create_withdrawal_hold(
                    subject.tenant_id,
                    subject.organization_id,
                    command.partner_id,
                    &config.currency,
                    command.amount_cents,
                    &format!("withdraw:{withdrawal_id}"),
                    withdrawal_id,
                    &format!("withdraw-hold:{withdrawal_id}:{}", command.partner_id),
                )
                .await
            {
                Ok(hold_id) => hold_id,
                Err(error)
                    if error.message() == "insufficient account balance"
                        || error.message() == "insufficient available balance for hold" =>
                {
                    return Err(CommerceServiceError::invalid_state(
                        "withdrawal amount exceeds the available balance",
                    ));
                }
                Err(error) => return Err(error),
            };
            let row = match insert_withdrawal_row(
                &self.pool,
                subject,
                command.partner_id,
                withdrawal_id,
                hold_id,
                command.amount_cents,
                &command.remark,
            )
            .await
            {
                Ok(row) => row,
                Err(error) => {
                    // Best-effort rollback: the hold committed in its own
                    // transaction, so release it when the withdrawal row
                    // cannot be created (idempotent by withdrawal id).
                    let _ = self
                        .wallet
                        .release_withdrawal_hold(
                            subject.tenant_id,
                            hold_id,
                            &format!("withdraw-rollback:{withdrawal_id}:{}", command.partner_id),
                        )
                        .await;
                    return Err(error);
                }
            };
            Ok(row)
        })
    }

    fn review_withdrawal<'a>(
        &'a self,
        command: ReviewWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_WITHDRAWAL_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.withdrawal_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("withdrawal not found"))?;
            let status: String = row.get("status");
            if status != "PENDING" {
                return Err(CommerceServiceError::invalid_state(format!(
                    "withdrawal is not pending (current status {status})"
                )));
            }
            let partner_id: i64 = row.get("partner_id");
            if command.approve {
                sqlx::query(
                    "UPDATE partner_withdrawal SET status = 'APPROVED', reviewed_by = $3, \
                     reviewed_at = CURRENT_TIMESTAMP, review_remark = $4, updated_at = CURRENT_TIMESTAMP \
                     WHERE id = $1 AND tenant_id = $2",
                )
                .bind(command.withdrawal_id)
                .bind(subject.tenant_id)
                .bind(subject.user_id)
                .bind(&command.review_remark)
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            } else {
                // Reject: release the frozen hold so the funds return to the
                // available balance. The release is idempotent by withdrawal
                // id, so a retry after a partial failure replays safely.
                let hold_id = row.get::<Option<i64>, _>("hold_id").ok_or_else(|| {
                    CommerceServiceError::invalid_state("withdrawal has no hold to release")
                })?;
                self.wallet
                    .release_withdrawal_hold(
                        subject.tenant_id,
                        hold_id,
                        &format!(
                            "withdraw-release:{0}:{1}",
                            command.withdrawal_id, partner_id
                        ),
                    )
                    .await?;
                sqlx::query(
                    "UPDATE partner_withdrawal SET status = 'REJECTED', reviewed_by = $3, \
                     reviewed_at = CURRENT_TIMESTAMP, review_remark = $4, updated_at = CURRENT_TIMESTAMP \
                     WHERE id = $1 AND tenant_id = $2",
                )
                .bind(command.withdrawal_id)
                .bind(subject.tenant_id)
                .bind(subject.user_id)
                .bind(&command.review_remark)
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            }
            insert_audit(
                &mut tx,
                subject,
                if command.approve {
                    "approve_withdrawal"
                } else {
                    "reject_withdrawal"
                },
                "partner_withdrawal",
                Some(command.withdrawal_id),
                json!({}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_WITHDRAWAL_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.withdrawal_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_withdrawal(&row))
        })
    }

    fn pay_withdrawal<'a>(
        &'a self,
        command: PayWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_WITHDRAWAL_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.withdrawal_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("withdrawal not found"))?;
            let status: String = row.get("status");
            if status != "APPROVED" {
                return Err(CommerceServiceError::invalid_state(format!(
                    "withdrawal must be approved before payment (current status {status})"
                )));
            }
            let partner_id: i64 = row.get("partner_id");
            // Settle the frozen hold through the account ledger; the settle is
            // idempotent by withdrawal id, so a retry after a partial failure
            // replays safely. The `commission_withdraw_paid` DEBIT is the
            // withdrawal's ledger record.
            let hold_id = row.get::<Option<i64>, _>("hold_id").ok_or_else(|| {
                CommerceServiceError::invalid_state("withdrawal has no hold to settle")
            })?;
            self.wallet
                .settle_withdrawal_hold(
                    subject.tenant_id,
                    hold_id,
                    "commission_withdraw_paid",
                    &format!("withdraw:{}", command.withdrawal_id),
                    &format!("withdraw-settle:{0}:{1}", command.withdrawal_id, partner_id),
                )
                .await?;
            sqlx::query(
                "UPDATE partner_withdrawal SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, \
                 paid_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2",
            )
            .bind(command.withdrawal_id)
            .bind(subject.tenant_id)
            .bind(subject.user_id)
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            insert_audit(
                &mut tx,
                subject,
                "pay_withdrawal",
                "partner_withdrawal",
                Some(command.withdrawal_id),
                json!({}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_WITHDRAWAL_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.withdrawal_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_withdrawal(&row))
        })
    }

    fn retrieve_stats_overview<'a>(
        &'a self,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, StatsOverviewItem> {
        Box::pin(async move {
            let partner_row = sqlx::query(
                "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active, \
                 COALESCE(SUM(join_fee_amount), 0)::text AS join_fee \
                 FROM partner_partner WHERE tenant_id = $1 AND organization_id = $2 AND deleted_at IS NULL",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            // Cumulative commission = CREDIT entries across all PARTNER
            // settlement accounts (commission credits + adjustment credits);
            // partner_wallet is retired (S4).
            let wallet_row = sqlx::query(
                "SELECT COALESCE(round((SUM(e.amount) FILTER (WHERE e.direction = 'CREDIT'))::numeric / 100, 2), 0.00)::text AS commission \
                 FROM acct_ledger_entry e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 AND e.owner_type = 'PARTNER'",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let withdrawal_row = sqlx::query(
                "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0)::text AS amount \
                 FROM partner_withdrawal WHERE tenant_id = $1 AND organization_id = $2 AND status = 'PENDING'",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(StatsOverviewItem {
                total_partners: partner_row.get("total"),
                active_partners: partner_row.get("active"),
                total_join_fee: partner_row.get("join_fee"),
                total_commission: wallet_row.get("commission"),
                pending_withdrawal_count: withdrawal_row.get("count"),
                pending_withdrawal_amount: withdrawal_row.get("amount"),
            })
        })
    }

    fn list_stats_snapshots<'a>(
        &'a self,
        query: ListStatsSnapshotsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<StatSnapshotItem>> {
        Box::pin(async move {
            let count_sql = "SELECT COUNT(*) FROM partner_stat_snapshot s \
                             WHERE s.tenant_id = $1 AND s.organization_id = $2 \
                             AND ($3::bigint IS NULL OR s.partner_id = $3) \
                             AND ($4::text IS NULL OR s.period_type = $4)";
            let total = sqlx::query(count_sql)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .bind(query.period_type.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(
                "SELECT s.id, s.partner_id, s.period_start, s.period_end, s.period_type, \
                 s.join_fee_total::text, s.customer_count, s.revenue_base::text, \
                 s.commission_earned::text, s.downstream_partner_count \
                 FROM partner_stat_snapshot s \
                 WHERE s.tenant_id = $1 AND s.organization_id = $2 \
                 AND ($3::bigint IS NULL OR s.partner_id = $3) \
                 AND ($4::text IS NULL OR s.period_type = $4) \
                 ORDER BY s.period_start DESC, s.id DESC LIMIT $5 OFFSET $6",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .bind(query.period_type.as_deref())
            .bind(query.list.page_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_stat_snapshot).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn retrieve_partner_stats<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerStatItem> {
        Box::pin(async move {
            // Partner balances live in the account-domain settlement account
            // (available/frozen) and its ledger (cumulative credits/paid);
            // partner_wallet/partner_ledger_entry are retired (S4).
            let account_row = sqlx::query(
                "SELECT available_amount, frozen_amount \
                 FROM acct_account \
                 WHERE tenant_id = $1 AND organization_id = $2 AND owner_type = 'PARTNER' \
                   AND owner_id = $3 AND asset_code = 'cash' AND account_purpose = 'SETTLEMENT'",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let (available_cents, frozen_cents) = match account_row {
                Some(account) => (
                    account.get::<i64, _>("available_amount"),
                    account.get::<i64, _>("frozen_amount"),
                ),
                None => (0, 0),
            };
            let ledger_row = sqlx::query(
                "SELECT COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'CREDIT'), 0) AS earned, \
                 COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'DEBIT' AND e.business_type = 'commission_withdraw_paid'), 0) AS withdrawn \
                 FROM acct_ledger_entry e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 \
                   AND e.owner_type = 'PARTNER' AND e.owner_id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let total_commission_cents: i64 = ledger_row.get("earned");
            let withdrawn_cents: i64 = ledger_row.get("withdrawn");
            let join_fee_row = sqlx::query(
                "SELECT COALESCE(SUM(amount), 0)::text AS total FROM partner_join_fee_payment \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 AND status = 'PAID'",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let customer_row = sqlx::query(
                "SELECT COUNT(*) AS count FROM partner_customer_binding \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 AND status = 'ACTIVE'",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(query.partner_id)
            .fetch_one(&self.pool)
            .await
            .map_err(error_from_sql)?;
            let downstream_row = sqlx::query(COUNT_DESCENDANTS)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(PartnerStatItem {
                partner_id: query.partner_id,
                total_join_fee: join_fee_row.get("total"),
                total_commission: cents_to_decimal(total_commission_cents),
                available_balance: cents_to_decimal(available_cents),
                withdrawing_amount: cents_to_decimal(frozen_cents),
                withdrawn_amount: cents_to_decimal(withdrawn_cents),
                customer_count: customer_row.get("count"),
                downstream_partner_count: downstream_row.get::<i64, _>("count").max(0),
            })
        })
    }

    fn list_join_applications<'a>(
        &'a self,
        query: ListJoinApplicationsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<PartnerJoinApplicationItem>> {
        Box::pin(async move {
            let total = sqlx::query(COUNT_APPLICATIONS_BY_FILTERS)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.status.as_deref())
                .bind(query.applicant_type.as_deref())
                .bind(query.keyword.as_deref())
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(SELECT_APPLICATIONS_BY_FILTERS)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.status.as_deref())
                .bind(query.applicant_type.as_deref())
                .bind(query.keyword.as_deref())
                .bind(query.list.page_size)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_partner_application).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn retrieve_join_application<'a>(
        &'a self,
        application_id: i64,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem> {
        Box::pin(async move {
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(application_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("join application not found"))?;
            Ok(map_partner_application(&row))
        })
    }

    fn approve_join_application<'a>(
        &'a self,
        command: ApproveJoinApplicationCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem> {
        Box::pin(async move {
            // The approval is atomic in ONE transaction: lock the application
            // row, verify SUBMITTED, verify the assigned level is ACTIVE,
            // create the partner record (PENDING, join fee unpaid, bound to
            // the applicant, hung on the inviter chain, invite code
            // generated), mark the application APPROVED, and audit. When the
            // generated invite code collides (partial unique index) the
            // transaction rolls back and retries with a fresh code.
            for attempt in 0..3 {
                let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
                let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID_FOR_UPDATE)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(command.application_id)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(error_from_sql)?
                    .ok_or_else(|| CommerceServiceError::not_found("join application not found"))?;
                let status: String = row.get("status");
                if status != "SUBMITTED" {
                    return Err(CommerceServiceError::invalid_state(format!(
                        "application is not submittable (current status {status})"
                    )));
                }
                let level_row = sqlx::query(
                    "SELECT level_no FROM partner_level \
                     WHERE tenant_id = $1 AND organization_id = $2 AND level_no = $3 \
                       AND status = 'ACTIVE' AND deleted_at IS NULL",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.level_no)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?;
                if level_row.is_none() {
                    return Err(CommerceServiceError::validation(format!(
                        "partner level {} is not active",
                        command.level_no
                    )));
                }
                let applicant_user_id: i64 = row.get("applicant_user_id");
                let subject_name: String = row.get("subject_name");
                let contact_name: String = row.get("contact_name");
                let contact_phone: String = row.get("contact_phone");
                let contact_email: String = row.get("contact_email");
                let inviter_partner_id: Option<i64> = row.get("inviter_partner_id");
                // Partner name prefers the subject name; individual applicants
                // fall back to their contact name.
                let partner_name = if subject_name.trim().is_empty() {
                    contact_name.clone()
                } else {
                    subject_name.clone()
                };
                let partner_id = next_bigint_id();
                let insert = sqlx::query(INSERT_PARTNER)
                    .bind(partner_id)
                    .bind(next_uuid())
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(&partner_name)
                    .bind(&contact_name)
                    .bind(&contact_phone)
                    .bind(&contact_email)
                    .bind(command.level_no)
                    .bind(inviter_partner_id)
                    .bind(applicant_user_id)
                    .bind("PENDING")
                    .bind("0.00")
                    .bind("UNPAID")
                    .bind(Option::<DateTime<Utc>>::None)
                    .bind(applicant_user_id) // owner_id = applicant
                    .bind("joined via partner join application")
                    .bind(&generate_invite_code())
                    .execute(&mut *tx)
                    .await;
                if let Err(error) = insert {
                    if is_unique_violation(&error) && attempt < 2 {
                        // Roll back (drop) and retry with a fresh invite code.
                        continue;
                    }
                    return Err(error_from_sql(error));
                }
                sqlx::query(UPDATE_PARTNER_APPLICATION_APPROVED)
                    .bind(command.application_id)
                    .bind(subject.tenant_id)
                    .bind(subject.user_id)
                    .bind(&command.remark)
                    .bind(partner_id)
                    .bind(subject.organization_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(error_from_sql)?;
                insert_audit(
                    &mut tx,
                    subject,
                    "approve_join_application",
                    "partner_application",
                    Some(command.application_id),
                    json!({
                        "level_no": command.level_no,
                        "partner_id": partner_id,
                        "remark": command.remark,
                    }),
                )
                .await
                .map_err(error_from_sql)?;
                tx.commit().await.map_err(error_from_sql)?;
                let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(command.application_id)
                    .fetch_one(&self.pool)
                    .await
                    .map_err(error_from_sql)?;
                return Ok(map_partner_application(&row));
            }
            Err(CommerceServiceError::conflict(
                "could not allocate a unique partner invite code",
            ))
        })
    }

    fn reject_join_application<'a>(
        &'a self,
        command: RejectJoinApplicationCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID_FOR_UPDATE)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.application_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("join application not found"))?;
            let status: String = row.get("status");
            if status != "SUBMITTED" {
                return Err(CommerceServiceError::invalid_state(format!(
                    "application is not submittable (current status {status})"
                )));
            }
            sqlx::query(UPDATE_PARTNER_APPLICATION_REJECTED)
                .bind(command.application_id)
                .bind(subject.tenant_id)
                .bind(subject.user_id)
                .bind(&command.reason)
                .bind(subject.organization_id)
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            insert_audit(
                &mut tx,
                subject,
                "reject_join_application",
                "partner_application",
                Some(command.application_id),
                json!({"reason": command.reason}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.application_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner_application(&row))
        })
    }
}

impl PartnerJoinRepositoryPort for PostgresPartnerAdminRepository {
    fn submit_application<'a>(
        &'a self,
        command: SubmitJoinApplicationCommand,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerJoinApplicationItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Optional invite code: lock the inviter at submit time. The code
            // must belong to an ACTIVE partner of the same tenant.
            let inviter_partner_id = if command.invite_code.is_empty() {
                None
            } else {
                let partner = sqlx::query(SELECT_PARTNER_BY_INVITE_CODE)
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(&command.invite_code)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(error_from_sql)?;
                let Some(partner) = partner else {
                    return Err(CommerceServiceError::conflict(
                        "invite code is invalid or not found",
                    ));
                };
                let status: String = partner.get("status");
                if status != "ACTIVE" {
                    return Err(CommerceServiceError::conflict(
                        "invite code belongs to an inactive partner",
                    ));
                }
                Some(partner.get::<i64, _>("id"))
            };
            // One active SUBMITTED application per applicant (partial unique
            // index); check explicitly for a human-readable conflict and map
            // any race lost to the index onto the same conflict.
            let existing = sqlx::query(SELECT_ACTIVE_SUBMITTED_APPLICATION_BY_USER)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(subject.user_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            if existing.is_some() {
                return Err(CommerceServiceError::conflict(
                    "an active join application already exists for this user",
                ));
            }
            let application_id = next_bigint_id();
            let result = sqlx::query(INSERT_PARTNER_APPLICATION)
                .bind(application_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(subject.user_id)
                .bind(&command.applicant_type)
                .bind(&command.subject_name)
                .bind(&command.contact_name)
                .bind(&command.contact_phone)
                .bind(&command.contact_email)
                .bind(command.target_level_no)
                .bind(&command.invite_code)
                .bind(inviter_partner_id)
                .bind(&command.business_intro)
                .execute(&mut *tx)
                .await;
            if let Err(error) = result {
                return Err(error_from_sql(error));
            }
            insert_app_audit(
                &mut tx,
                subject,
                "submit_join_application",
                "partner_application",
                Some(application_id),
                json!({
                    "applicant_type": command.applicant_type,
                    "target_level_no": command.target_level_no,
                    "inviter_partner_id": inviter_partner_id,
                }),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(application_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner_application(&row))
        })
    }

    fn list_my_applications<'a>(
        &'a self,
        query: ListMyJoinApplicationsQuery,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerAdminListPage<PartnerJoinApplicationItem>> {
        Box::pin(async move {
            let total = sqlx::query(COUNT_APPLICATIONS_BY_USER)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(subject.user_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("count");
            let offset = (query.list.page - 1) * query.list.page_size;
            let rows = sqlx::query(SELECT_APPLICATIONS_BY_USER)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(subject.user_id)
                .bind(query.list.page_size)
                .bind(offset)
                .fetch_all(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(PartnerAdminListPage {
                items: rows.iter().map(map_partner_application).collect(),
                page: query.list.page,
                page_size: query.list.page_size,
                total,
            })
        })
    }

    fn cancel_application<'a>(
        &'a self,
        command: CancelJoinApplicationCommand,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerJoinApplicationItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Lock the application row so the ownership and SUBMITTED checks
            // below are race-free against a concurrent review.
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID_FOR_UPDATE)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.application_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .ok_or_else(|| CommerceServiceError::not_found("join application not found"))?;
            let applicant_user_id: i64 = row.get("applicant_user_id");
            if applicant_user_id != subject.user_id {
                // Own application only; do not leak the existence of other
                // applicants' rows.
                return Err(CommerceServiceError::not_found(
                    "join application not found",
                ));
            }
            let status: String = row.get("status");
            if status != "SUBMITTED" {
                return Err(CommerceServiceError::invalid_state(format!(
                    "application is not submittable (current status {status})"
                )));
            }
            sqlx::query(UPDATE_PARTNER_APPLICATION_CANCELLED)
                .bind(command.application_id)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            insert_app_audit(
                &mut tx,
                subject,
                "cancel_join_application",
                "partner_application",
                Some(command.application_id),
                json!({}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(SELECT_PARTNER_APPLICATION_BY_ID)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.application_id)
                .fetch_one(&self.pool)
                .await
                .map_err(error_from_sql)?;
            Ok(map_partner_application(&row))
        })
    }

    fn validate_invite_code<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        code: &'a str,
    ) -> PartnerJoinFuture<'a, InviteCodeValidation> {
        Box::pin(async move {
            let code = code.trim().to_string();
            let invalid = || InviteCodeValidation {
                code: code.clone(),
                valid: false,
                partner_id: None,
                partner_name: String::new(),
                level_no: None,
            };
            if code.is_empty() {
                return Ok(invalid());
            }
            let row = sqlx::query(SELECT_PARTNER_BY_INVITE_CODE)
                .bind(tenant_id)
                .bind(organization_id)
                .bind(&code)
                .fetch_optional(&self.pool)
                .await
                .map_err(error_from_sql)?;
            let Some(row) = row else {
                // Not found is a plain invalid result, never a 404.
                return Ok(invalid());
            };
            let status: String = row.get("status");
            if status != "ACTIVE" {
                return Ok(invalid());
            }
            Ok(InviteCodeValidation {
                code,
                valid: true,
                partner_id: Some(row.get("id")),
                partner_name: row.get("name"),
                level_no: Some(row.get("level_no")),
            })
        })
    }
}
