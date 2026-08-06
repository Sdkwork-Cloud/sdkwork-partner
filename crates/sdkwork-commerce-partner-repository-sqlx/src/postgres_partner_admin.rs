//! PostgreSQL implementation of `PartnerAdminRepositoryPort`.

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
use sdkwork_commerce_partner_service::queries::*;
use sdkwork_contract_service::CommerceServiceError;
use serde_json::json;
use sqlx::{Postgres, Row, Transaction};

pub struct PostgresPartnerAdminRepository {
    pool: sqlx::PgPool,
}

impl PostgresPartnerAdminRepository {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
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

/// Read the commission config for a tenant, creating the default row if absent.
async fn load_commission_config(
    pool: &sqlx::PgPool,
    tenant_id: i64,
    organization_id: i64,
) -> Result<CommissionConfigItem, CommerceServiceError> {
    for _attempt in 0..2 {
        let row = sqlx::query(
            "SELECT enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount::text              FROM partner_commission_config WHERE tenant_id = $1 AND organization_id = $2",
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
            });
        }
        // Insert the default config row (single row per tenant); retry once.
        let _ = sqlx::query(
            "INSERT INTO partner_commission_config              (id, uuid, tenant_id, organization_id, enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount)              VALUES ($1, $2, $3, $4, TRUE, '{\"usage_settlement\":true,\"recharge\":true}', 0, 'CNY', 0::numeric)              ON CONFLICT (tenant_id, organization_id) DO NOTHING",
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
        let wallet = sqlx::query(UPSERT_WALLET_CREDIT)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(allocation.partner_id)
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind("0.00")
            .bind("0.00")
            .fetch_one(&mut **tx)
            .await
            .map_err(error_from_sql)?;
        let balance_after: String = wallet.get("available_balance");
        let ledger_id = sqlx::query(INSERT_LEDGER_ENTRY)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(allocation.partner_id)
            .bind("JOIN_FEE_COMMISSION")
            .bind("IN")
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(&balance_after)
            .bind("JOIN_FEE_PAYMENT")
            .bind(payment_id)
            .bind(subject.user_id)
            .bind(format!(
                "join-fee commission level_offset={}",
                allocation.level_offset
            ))
            .fetch_one(&mut **tx)
            .await
            .map_err(error_from_sql)?
            .get::<i64, _>("id");
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
            .bind(ledger_id)
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
        "SELECT enabled, revenue_sources, max_commission_depth, currency, min_withdrawal_amount::text \
         FROM partner_commission_config WHERE tenant_id = $1 AND organization_id = $2",
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
    })
}

/// Settle one pending commission event inside a transaction.
/// Returns (settled: bool, distributed_cents: i64).
async fn settle_event(
    tx: &mut Transaction<'_, Postgres>,
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
    let allocations = allocate_commissions(base_amount_cents, &nodes, config.max_commission_depth)
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
        .bind(cents_to_decimal(base_amount_cents))
        .bind(cents_to_decimal(distributed))
        .bind(allocations.len() as i64)
        .bind("SETTLED")
        .bind(subject.user_id)
        .bind("")
        .execute(&mut **tx)
        .await
        .map_err(error_from_sql)?;
    for allocation in allocations {
        let wallet = sqlx::query(UPSERT_WALLET_CREDIT)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(allocation.partner_id)
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind("0.00")
            .bind("0.00")
            .fetch_one(&mut **tx)
            .await
            .map_err(error_from_sql)?;
        let balance_after: String = wallet.get("available_balance");
        let ledger_id = sqlx::query(INSERT_LEDGER_ENTRY)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(allocation.partner_id)
            .bind("REVENUE_COMMISSION")
            .bind("IN")
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(&balance_after)
            .bind("COMMISSION_EVENT")
            .bind(event_id)
            .bind(subject.user_id)
            .bind(format!(
                "revenue commission level_offset={}",
                allocation.level_offset
            ))
            .fetch_one(&mut **tx)
            .await
            .map_err(error_from_sql)?
            .get::<i64, _>("id");
        sqlx::query(INSERT_DISTRIBUTION)
            .bind(next_bigint_id())
            .bind(next_uuid())
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(settlement_id)
            .bind(allocation.partner_id)
            .bind(allocation.level_offset)
            .bind(cents_to_decimal(allocation.ratio_per_10000))
            .bind(cents_to_decimal(base_amount_cents))
            .bind(cents_to_decimal(allocation.amount_cents))
            .bind(ledger_id)
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
                 join_fee_commission_ratio::text, join_fee::text, status, sort_order \
                 FROM partner_level WHERE tenant_id = $1 AND organization_id = $2 AND deleted_at IS NULL \
                 ORDER BY sort_order ASC, level_no ASC"
            } else {
                "SELECT id, level_no, name, customer_revenue_ratio::text, \
                 join_fee_commission_ratio::text, join_fee::text, status, sort_order \
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
                  join_fee_commission_ratio, join_fee, status, sort_order) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric, 'ACTIVE', $10)",
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
                 sort_order = $8, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
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
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            if updated.rows_affected() == 0 {
                return Err(CommerceServiceError::not_found("partner level not found"));
            }
            insert_audit(
                &mut tx,
                subject,
                "update_level",
                "partner_level",
                Some(command.level_id),
                json!({"status": command.status}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(PartnerLevelItem {
                id: command.level_id,
                level_no: 0,
                name: command.name,
                customer_revenue_ratio: cents_to_decimal(command.customer_revenue_ratio_per_10000),
                join_fee_commission_ratio: cents_to_decimal(
                    command.join_fee_commission_ratio_per_10000,
                ),
                join_fee: cents_to_decimal(command.join_fee_cents),
                status: command.status,
                sort_order: command.sort_order,
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
            let partner_id = next_bigint_id();
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
            let updated = sqlx::query(
                "UPDATE partner_partner SET name = $3, contact_name = $4, phone = $5, email = $6, \
                 level_no = $7, status = $8, remark = $9, updated_at = CURRENT_TIMESTAMP \
                 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
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
                json!({"status": command.status, "level_no": command.level_no}),
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
            let row = sqlx::query(INSERT_JOIN_FEE_PAYMENT)
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
                .fetch_one(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            sqlx::query(UPDATE_PARTNER_JOIN_FEE_PAID)
                .bind(command.partner_id)
                .bind(subject.tenant_id)
                .bind(cents_to_decimal(command.amount_cents))
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            // Record the join fee as an out-flow ledger entry (record only;
            // join fees are not deducted from the commission wallet).
            let wallet_balance = sqlx::query(SELECT_WALLET)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .map(|w| w.get::<String, _>("available_balance"))
                .unwrap_or_else(|| "0.00".to_string());
            sqlx::query(INSERT_LEDGER_ENTRY)
                .bind(next_bigint_id())
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind("JOIN_FEE_PAYMENT")
                .bind("OUT")
                .bind(cents_to_decimal(command.amount_cents))
                .bind(&wallet_balance)
                .bind("JOIN_FEE_PAYMENT")
                .bind(payment_id)
                .bind(subject.user_id)
                .bind("join fee paid")
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            // Trigger multi-level join-fee commission for ancestors.
            let distributed = distribute_join_fee_commission(
                &mut tx,
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
            let count_sql = "SELECT COUNT(*) FROM partner_customer_binding b \
                             WHERE b.tenant_id = $1 AND b.organization_id = $2 \
                             AND ($3::bigint IS NULL OR b.partner_id = $3) \
                             AND ($4::text IS NULL OR b.status = $4)";
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
                "SELECT b.id, b.partner_id, b.customer_user_id, b.binding_type, b.status, \
                 b.bound_at, b.bound_by, b.unbound_at, b.unbound_by, b.created_at \
                 FROM partner_customer_binding b \
                 WHERE b.tenant_id = $1 AND b.organization_id = $2 \
                 AND ($3::bigint IS NULL OR b.partner_id = $3) \
                 AND ($4::text IS NULL OR b.status = $4) \
                 ORDER BY b.created_at DESC, b.id DESC LIMIT $5 OFFSET $6",
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
                match settle_event(&mut tx, subject, event_id, customer_user_id, base_amount).await
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
            let count_sql = "SELECT COUNT(*) FROM partner_ledger_entry e \
                             WHERE e.tenant_id = $1 AND e.organization_id = $2 AND e.partner_id = $3 \
                             AND ($4::text IS NULL OR e.entry_type = $4)";
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
            let rows = sqlx::query(
                "SELECT e.id, e.partner_id, e.entry_type, e.direction, e.amount::text, \
                 e.balance_after::text, e.ref_type, e.ref_id, e.operator_id, e.remark, e.created_at \
                 FROM partner_ledger_entry e \
                 WHERE e.tenant_id = $1 AND e.organization_id = $2 AND e.partner_id = $3 \
                 AND ($4::text IS NULL OR e.entry_type = $4) \
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

    fn create_ledger_adjustment<'a>(
        &'a self,
        command: CreateLedgerAdjustmentCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, LedgerEntryItem> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            // Lock the wallet row.
            let wallet = sqlx::query(
                "SELECT total_earned::text, available_balance::text, withdrawing_amount::text, \
                 withdrawn_amount::text FROM partner_wallet \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 FOR UPDATE",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.partner_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .ok_or_else(|| CommerceServiceError::not_found("partner wallet not found"))?;
            let available = parse_money_to_cents(
                "available_balance",
                &wallet.get::<String, _>("available_balance"),
            )?;
            let total_earned =
                parse_money_to_cents("total_earned", &wallet.get::<String, _>("total_earned"))?;
            if command.amount_cents < 0 && available + command.amount_cents < 0 {
                return Err(CommerceServiceError::invalid_state(
                    "adjustment would make the wallet balance negative",
                ));
            }
            let new_available = available + command.amount_cents;
            let new_total = if command.amount_cents > 0 {
                total_earned + command.amount_cents
            } else {
                total_earned
            };
            let direction = if command.amount_cents > 0 {
                "IN"
            } else {
                "OUT"
            };
            sqlx::query(
                "UPDATE partner_wallet SET total_earned = $4::numeric, available_balance = $5::numeric, \
                 updated_at = CURRENT_TIMESTAMP \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.partner_id)
            .bind(cents_to_decimal(new_total))
            .bind(cents_to_decimal(new_available))
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            let ledger_id = sqlx::query(INSERT_LEDGER_ENTRY)
                .bind(next_bigint_id())
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind("MANUAL_ADJUST")
                .bind(direction)
                .bind(cents_to_decimal(command.amount_cents))
                .bind(cents_to_decimal(new_available))
                .bind("")
                .bind(Option::<i64>::None)
                .bind(subject.user_id)
                .bind(&command.remark)
                .fetch_one(&mut *tx)
                .await
                .map_err(error_from_sql)?
                .get::<i64, _>("id");
            insert_audit(
                &mut tx,
                subject,
                "create_ledger_adjustment",
                "partner_ledger_entry",
                Some(ledger_id),
                json!({"partner_id": command.partner_id, "amount": cents_to_decimal(command.amount_cents)}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            let row = sqlx::query(
                "SELECT id, partner_id, entry_type, direction, amount::text, balance_after::text, \
                 ref_type, ref_id, operator_id, remark, created_at FROM partner_ledger_entry \
                 WHERE tenant_id = $1 AND organization_id = $2 AND id = $3",
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
            let mut tx = self.pool.begin().await.map_err(error_from_sql)?;
            let wallet = sqlx::query(
                "SELECT total_earned::text, available_balance::text, withdrawing_amount::text, \
                 withdrawn_amount::text FROM partner_wallet \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 FOR UPDATE",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.partner_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .ok_or_else(|| CommerceServiceError::not_found("partner wallet not found"))?;
            let available = parse_money_to_cents(
                "available_balance",
                &wallet.get::<String, _>("available_balance"),
            )?;
            if command.amount_cents > available {
                return Err(CommerceServiceError::invalid_state(
                    "withdrawal amount exceeds the available balance",
                ));
            }
            let withdrawing = parse_money_to_cents(
                "withdrawing_amount",
                &wallet.get::<String, _>("withdrawing_amount"),
            )?;
            let new_available = available - command.amount_cents;
            let new_withdrawing = withdrawing + command.amount_cents;
            sqlx::query(
                "UPDATE partner_wallet SET available_balance = $4::numeric, withdrawing_amount = $5::numeric, \
                 updated_at = CURRENT_TIMESTAMP \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(command.partner_id)
            .bind(cents_to_decimal(new_available))
            .bind(cents_to_decimal(new_withdrawing))
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            let withdrawal_id = next_bigint_id();
            let row = sqlx::query(INSERT_WITHDRAWAL)
                .bind(withdrawal_id)
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind(cents_to_decimal(command.amount_cents))
                .bind(&command.remark)
                .fetch_one(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            sqlx::query(INSERT_LEDGER_ENTRY)
                .bind(next_bigint_id())
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(command.partner_id)
                .bind("WITHDRAWAL_APPLY")
                .bind("OUT")
                .bind(cents_to_decimal(command.amount_cents))
                .bind(cents_to_decimal(new_available))
                .bind("PARTNER_WITHDRAWAL")
                .bind(withdrawal_id)
                .bind(subject.user_id)
                .bind("withdrawal applied")
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
            insert_audit(
                &mut tx,
                subject,
                "create_withdrawal",
                "partner_withdrawal",
                Some(withdrawal_id),
                json!({"partner_id": command.partner_id, "amount": cents_to_decimal(command.amount_cents)}),
            )
            .await
            .map_err(error_from_sql)?;
            tx.commit().await.map_err(error_from_sql)?;
            Ok(map_withdrawal(&row))
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
            let amount_cents = parse_money_to_cents("amount", &row.get::<String, _>("amount"))?;
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
                // Reject: return the frozen funds to the available balance.
                let wallet = sqlx::query(
                    "SELECT available_balance::text, withdrawing_amount::text FROM partner_wallet \
                     WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 FOR UPDATE",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(partner_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(error_from_sql)?;
                let (available, withdrawing) = if let Some(wallet) = wallet {
                    (
                        parse_money_to_cents(
                            "available_balance",
                            &wallet.get::<String, _>("available_balance"),
                        )?,
                        parse_money_to_cents(
                            "withdrawing_amount",
                            &wallet.get::<String, _>("withdrawing_amount"),
                        )?,
                    )
                } else {
                    (0, 0)
                };
                let new_available = available + amount_cents;
                let new_withdrawing = withdrawing - amount_cents;
                sqlx::query(
                    "UPDATE partner_wallet SET available_balance = $4::numeric, withdrawing_amount = $5::numeric, \
                     updated_at = CURRENT_TIMESTAMP \
                     WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3",
                )
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(partner_id)
                .bind(cents_to_decimal(new_available))
                .bind(cents_to_decimal(new_withdrawing))
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
                sqlx::query(INSERT_LEDGER_ENTRY)
                    .bind(next_bigint_id())
                    .bind(next_uuid())
                    .bind(subject.tenant_id)
                    .bind(subject.organization_id)
                    .bind(partner_id)
                    .bind("WITHDRAWAL_REJECT")
                    .bind("IN")
                    .bind(cents_to_decimal(amount_cents))
                    .bind(cents_to_decimal(new_available))
                    .bind("PARTNER_WITHDRAWAL")
                    .bind(command.withdrawal_id)
                    .bind(subject.user_id)
                    .bind("withdrawal rejected")
                    .execute(&mut *tx)
                    .await
                    .map_err(error_from_sql)?;
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
            let amount_cents = parse_money_to_cents("amount", &row.get::<String, _>("amount"))?;
            let wallet = sqlx::query(
                "SELECT withdrawing_amount::text, withdrawn_amount::text FROM partner_wallet \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3 FOR UPDATE",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(partner_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(error_from_sql)?
            .ok_or_else(|| CommerceServiceError::not_found("partner wallet not found"))?;
            let withdrawing = parse_money_to_cents(
                "withdrawing_amount",
                &wallet.get::<String, _>("withdrawing_amount"),
            )?;
            let withdrawn = parse_money_to_cents(
                "withdrawn_amount",
                &wallet.get::<String, _>("withdrawn_amount"),
            )?;
            let new_withdrawing = withdrawing - amount_cents;
            let new_withdrawn = withdrawn + amount_cents;
            sqlx::query(
                "UPDATE partner_wallet SET withdrawing_amount = $4::numeric, withdrawn_amount = $5::numeric, \
                 updated_at = CURRENT_TIMESTAMP \
                 WHERE tenant_id = $1 AND organization_id = $2 AND partner_id = $3",
            )
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(partner_id)
            .bind(cents_to_decimal(new_withdrawing))
            .bind(cents_to_decimal(new_withdrawn))
            .execute(&mut *tx)
            .await
            .map_err(error_from_sql)?;
            sqlx::query(INSERT_LEDGER_ENTRY)
                .bind(next_bigint_id())
                .bind(next_uuid())
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(partner_id)
                .bind("WITHDRAWAL_PAID")
                .bind("OUT")
                .bind(cents_to_decimal(amount_cents))
                .bind(cents_to_decimal(new_withdrawing + withdrawn))
                .bind("PARTNER_WITHDRAWAL")
                .bind(command.withdrawal_id)
                .bind(subject.user_id)
                .bind(if command.remark.is_empty() {
                    "withdrawal paid"
                } else {
                    &command.remark
                })
                .execute(&mut *tx)
                .await
                .map_err(error_from_sql)?;
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
            let wallet_row = sqlx::query(
                "SELECT COALESCE(SUM(total_earned), 0)::text AS commission \
                 FROM partner_wallet WHERE tenant_id = $1 AND organization_id = $2",
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
            let wallet = sqlx::query(SELECT_WALLET)
                .bind(subject.tenant_id)
                .bind(subject.organization_id)
                .bind(query.partner_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(error_from_sql)?;
            let (total_commission, available, withdrawing, withdrawn) = match wallet {
                Some(wallet) => (
                    wallet.get::<String, _>("total_earned"),
                    wallet.get::<String, _>("available_balance"),
                    wallet.get::<String, _>("withdrawing_amount"),
                    wallet.get::<String, _>("withdrawn_amount"),
                ),
                None => (
                    "0.00".to_string(),
                    "0.00".to_string(),
                    "0.00".to_string(),
                    "0.00".to_string(),
                ),
            };
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
                total_commission,
                available_balance: available,
                withdrawing_amount: withdrawing,
                withdrawn_amount: withdrawn,
                customer_count: customer_row.get("count"),
                downstream_partner_count: downstream_row.get::<i64, _>("count").max(0),
            })
        })
    }
}
