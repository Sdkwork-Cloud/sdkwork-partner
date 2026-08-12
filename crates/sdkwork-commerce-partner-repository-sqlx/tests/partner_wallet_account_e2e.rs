//! Live-PostgreSQL end-to-end tests for the S4 partner wallet unification.
//!
//! Partner commission balances live in the sdkwork-account domain
//! (`acct_account`/`acct_ledger_entry`, owner_type=PARTNER,
//! account_purpose=SETTLEMENT, asset `cash`); `partner_wallet` and
//! `partner_ledger_entry` are retired. These tests exercise the wallet port
//! (`PartnerAccountWalletAdapter`) and the repository withdrawal workflow
//! against a real database: commission credits with idempotent replay,
//! withdrawal hold/freeze + release/settle, insufficient-balance rejection,
//! and the account-ledger list projection.
//!
//! Skipped unless `SDKWORK_DATABASE_URL` is set (same convention as
//! `postgres_usage_settlement_store_e2e` in sdkwork-cloudrouter).

use sdkwork_commerce_partner_repository_sqlx::account_adapter::{
    PartnerAccountWalletAdapter, PartnerWalletPort,
};
use sdkwork_commerce_partner_repository_sqlx::PostgresPartnerAdminRepository;
use sdkwork_commerce_partner_service::backend_admin::{
    PartnerAdminRepositoryPort, PartnerAdminSubject,
};
use sdkwork_commerce_partner_service::commands::{
    CreateWithdrawalCommand, PayWithdrawalCommand, ReviewWithdrawalCommand,
};
use sdkwork_commerce_partner_service::queries::{ListLedgerEntriesQuery, PartnerAdminListQuery};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use std::env;
use std::sync::Arc;

const POSTGRES_TEST_DATABASE_URL: &str = "SDKWORK_DATABASE_URL";
const ACCOUNT_BASELINE: &str = include_str!(
    "../../../../sdkwork-account/database/ddl/baseline/postgres/0001_account_baseline.sql"
);
const PARTNER_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_partner_baseline.sql");

const TENANT_ID: i64 = 100_001;
const ORGANIZATION_ID: i64 = 0;
const PARTNER_ID: i64 = 77;
const ADMIN_USER_ID: i64 = 9;
const CURRENCY: &str = "CNY";

#[tokio::test]
async fn commission_credit_replays_idempotently_without_double_credit() {
    let Some(ctx) = PostgresTestContext::new("credit_replay").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());

    let first = adapter
        .credit_commission(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            5000,
            "join_fee_commission",
            "JOIN_FEE_PAYMENT",
            1,
            "join-fee commission level_offset=0",
            "join-fee:1:77",
        )
        .await
        .expect("credit join-fee commission");
    let replay = adapter
        .credit_commission(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            5000,
            "join_fee_commission",
            "JOIN_FEE_PAYMENT",
            1,
            "join-fee commission level_offset=0",
            "join-fee:1:77",
        )
        .await
        .expect("replay must succeed, not double-credit");
    assert_eq!(
        first, replay,
        "idempotent replay returns the same ledger id"
    );

    assert_eq!(
        5000,
        adapter
            .available_balance_cents(TENANT_ID, ORGANIZATION_ID, PARTNER_ID, CURRENCY)
            .await
            .expect("read available balance")
    );
    assert_eq!(
        5000,
        adapter
            .total_earned_cents(TENANT_ID, ORGANIZATION_ID, PARTNER_ID, CURRENCY)
            .await
            .expect("read total earned")
    );

    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!("PARTNER", account.owner_type);
    assert_eq!("SETTLEMENT", account.account_purpose);
    assert_eq!("cash", account.asset_code);
    assert_eq!(CURRENCY, account.currency_code);
    assert_eq!(5000, account.available_amount);

    ctx.cleanup().await;
}

#[tokio::test]
async fn withdrawal_hold_freezes_balance_and_settle_moves_funds_out() {
    let Some(ctx) = PostgresTestContext::new("hold_settle").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());
    credit(&adapter, 10000).await;

    let hold_id = adapter
        .create_withdrawal_hold(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            4000,
            "withdraw:101",
            101,
            "withdraw-hold:101:77",
        )
        .await
        .expect("create withdrawal hold");

    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(6000, account.available_amount, "hold must freeze funds");
    assert_eq!(4000, account.frozen_amount, "hold must freeze funds");

    adapter
        .settle_withdrawal_hold(
            TENANT_ID,
            hold_id,
            "commission_withdraw_paid",
            "withdraw:101",
            "withdraw-settle:101:77",
        )
        .await
        .expect("settle paid withdrawal hold");

    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(6000, account.available_amount);
    assert_eq!(
        0, account.frozen_amount,
        "settle must unfreeze the paid amount"
    );

    let paid = ledger_total(&ctx.pool, "commission_withdraw_paid", "DEBIT").await;
    assert_eq!(4000, paid, "exactly one settle DEBIT must exist");

    assert_eq!(
        6000,
        adapter
            .total_earned_cents(TENANT_ID, ORGANIZATION_ID, PARTNER_ID, CURRENCY)
            .await
            .expect("read total earned")
    );

    ctx.cleanup().await;
}

#[tokio::test]
async fn withdrawal_hold_release_returns_funds() {
    let Some(ctx) = PostgresTestContext::new("hold_release").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());
    credit(&adapter, 10000).await;

    let hold_id = adapter
        .create_withdrawal_hold(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            4000,
            "withdraw:102",
            102,
            "withdraw-hold:102:77",
        )
        .await
        .expect("create withdrawal hold");
    adapter
        .release_withdrawal_hold(TENANT_ID, hold_id, "withdraw-release:102:77")
        .await
        .expect("release rejected withdrawal hold");

    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(
        10000, account.available_amount,
        "release must restore funds"
    );
    assert_eq!(0, account.frozen_amount);

    ctx.cleanup().await;
}

#[tokio::test]
async fn debit_adjustment_beyond_balance_fails_and_leaves_balance_unchanged() {
    let Some(ctx) = PostgresTestContext::new("adjust_insufficient").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());
    credit(&adapter, 1000).await;

    let error = adapter
        .debit_commission(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            5000,
            "MANUAL_ADJUST",
            0,
            "manual adjustment e2e",
            "adjust:77:9:00000000-0000-0000-0000-000000000001",
        )
        .await
        .expect_err("debit beyond the balance must fail");
    assert_eq!(
        "insufficient account balance",
        error.message(),
        "account store must reject the debit"
    );

    assert_eq!(
        1000,
        adapter
            .available_balance_cents(TENANT_ID, ORGANIZATION_ID, PARTNER_ID, CURRENCY)
            .await
            .expect("read available balance")
    );

    ctx.cleanup().await;
}

#[tokio::test]
async fn withdrawal_workflow_through_repository_holds_reviews_and_pays() {
    let Some(ctx) = PostgresTestContext::new("repo_workflow").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());
    seed_commission_config(&ctx.pool, 1000).await;
    credit(&adapter, 10000).await;
    let repository =
        PostgresPartnerAdminRepository::new(ctx.pool.clone(), Arc::new(adapter.clone()));
    let subject = PartnerAdminSubject::new(TENANT_ID, ORGANIZATION_ID, ADMIN_USER_ID)
        .expect("build admin subject");

    let withdrawal = repository
        .create_withdrawal(
            CreateWithdrawalCommand::new(PARTNER_ID, 3000, "e2e withdrawal").expect("command"),
            &subject,
        )
        .await
        .expect("create withdrawal");
    assert_eq!("PENDING", withdrawal.status);
    assert!(
        withdrawal_hold_id(&ctx.pool, withdrawal.id).await.is_some(),
        "withdrawal must carry the account hold id"
    );
    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(7000, account.available_amount);
    assert_eq!(3000, account.frozen_amount, "apply must freeze the amount");

    let approved = repository
        .review_withdrawal(
            ReviewWithdrawalCommand::new(withdrawal.id, true, "approved").expect("command"),
            &subject,
        )
        .await
        .expect("approve withdrawal");
    assert_eq!("APPROVED", approved.status);
    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(
        3000, account.frozen_amount,
        "approval keeps the hold frozen"
    );

    let paid = repository
        .pay_withdrawal(
            PayWithdrawalCommand::new(withdrawal.id, "").expect("command"),
            &subject,
        )
        .await
        .expect("pay withdrawal");
    assert_eq!("PAID", paid.status);
    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(7000, account.available_amount);
    assert_eq!(0, account.frozen_amount, "payment settles the hold");

    // The account ledger must carry both the commission credit and the paid
    // withdrawal, projected onto the legacy entry shape.
    let page = repository
        .list_ledger_entries(
            ListLedgerEntriesQuery::new(
                PartnerAdminListQuery::new(1, 50, None).expect("list query"),
                PARTNER_ID,
                None,
            ),
            &subject,
        )
        .await
        .expect("list ledger entries");
    assert_eq!(2, page.items.len(), "credit + paid withdrawal entries");
    let credit_entry = page
        .items
        .iter()
        .find(|entry| entry.entry_type == "REVENUE_COMMISSION")
        .expect("credit entry");
    assert_eq!("IN", credit_entry.direction);
    assert_eq!("100.00", credit_entry.amount);
    let paid_entry = page
        .items
        .iter()
        .find(|entry| entry.entry_type == "WITHDRAWAL_PAID")
        .expect("paid entry");
    assert_eq!("OUT", paid_entry.direction);
    assert_eq!("30.00", paid_entry.amount);
    assert_eq!("PARTNER_WITHDRAWAL", paid_entry.ref_type);
    assert_eq!(Some(withdrawal.id), paid_entry.ref_id);

    ctx.cleanup().await;
}

#[tokio::test]
async fn rejected_withdrawal_releases_the_hold_and_leaves_no_ledger_entry() {
    let Some(ctx) = PostgresTestContext::new("repo_reject").await else {
        return;
    };
    let adapter = PartnerAccountWalletAdapter::new(ctx.pool.clone());
    seed_commission_config(&ctx.pool, 1000).await;
    credit(&adapter, 10000).await;
    let repository =
        PostgresPartnerAdminRepository::new(ctx.pool.clone(), Arc::new(adapter.clone()));
    let subject = PartnerAdminSubject::new(TENANT_ID, ORGANIZATION_ID, ADMIN_USER_ID)
        .expect("build admin subject");

    let withdrawal = repository
        .create_withdrawal(
            CreateWithdrawalCommand::new(PARTNER_ID, 3000, "e2e withdrawal").expect("command"),
            &subject,
        )
        .await
        .expect("create withdrawal");
    let rejected = repository
        .review_withdrawal(
            ReviewWithdrawalCommand::new(withdrawal.id, false, "rejected").expect("command"),
            &subject,
        )
        .await
        .expect("reject withdrawal");
    assert_eq!("REJECTED", rejected.status);

    let account = partner_settlement_account(&ctx.pool).await;
    assert_eq!(10000, account.available_amount, "reject must restore funds");
    assert_eq!(0, account.frozen_amount);
    // A rejection is a hold-domain release, not a money movement: the account
    // ledger must stay untouched.
    let release_entries = ledger_total(&ctx.pool, "commission_withdraw_release", "CREDIT").await;
    assert_eq!(0, release_entries, "release must not create ledger entries");

    ctx.cleanup().await;
}

async fn credit(adapter: &PartnerAccountWalletAdapter, amount_cents: i64) {
    adapter
        .credit_commission(
            TENANT_ID,
            ORGANIZATION_ID,
            PARTNER_ID,
            CURRENCY,
            amount_cents,
            "commission_earn",
            "COMMISSION_EVENT",
            9001,
            "revenue commission level_offset=0",
            &format!("commission:9001:{PARTNER_ID}"),
        )
        .await
        .expect("credit commission");
}

/// Seed a commission config row so withdrawal validation uses a test minimum
/// (¥10) instead of the schema-default ¥100 inserted by the repository when
/// no config row exists.
async fn seed_commission_config(pool: &PgPool, min_withdrawal_cents: i64) {
    sqlx::query(
        "INSERT INTO partner_commission_config \
         (id, uuid, tenant_id, organization_id, enabled, revenue_sources, \
          max_commission_depth, currency, min_withdrawal_amount, profit_margin_ratio) \
         VALUES ($1, $2, $3, $4, TRUE, $5, 3, 'CNY', $6::numeric, 40.00::numeric) \
         ON CONFLICT (tenant_id, organization_id) DO NOTHING",
    )
    .bind(1i64)
    .bind("00000000-0000-0000-0000-00000000CONFIG")
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind("{\"usage_settlement\":true,\"recharge\":true}")
    .bind(cents_to_decimal(min_withdrawal_cents))
    .execute(pool)
    .await
    .expect("seed commission config");
}

fn cents_to_decimal(cents: i64) -> String {
    format!("{:.2}", cents as f64 / 100.0)
}

struct PartnerSettlementAccount {
    owner_type: String,
    account_purpose: String,
    asset_code: String,
    currency_code: String,
    available_amount: i64,
    frozen_amount: i64,
}

async fn partner_settlement_account(pool: &PgPool) -> PartnerSettlementAccount {
    let row = sqlx::query(
        r#"
        SELECT owner_type, account_purpose, asset_code, currency_code, available_amount, frozen_amount
        FROM acct_account
        WHERE tenant_id = $1 AND organization_id = $2
          AND owner_type = 'PARTNER' AND owner_id = $3
          AND asset_code = 'cash' AND account_purpose = 'SETTLEMENT'
        "#,
    )
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(PARTNER_ID)
    .fetch_one(pool)
    .await
    .expect("read partner settlement account");
    PartnerSettlementAccount {
        owner_type: row.get("owner_type"),
        account_purpose: row.get("account_purpose"),
        asset_code: row.get("asset_code"),
        currency_code: row.get("currency_code"),
        available_amount: row.get("available_amount"),
        frozen_amount: row.get("frozen_amount"),
    }
}

async fn withdrawal_hold_id(pool: &PgPool, withdrawal_id: i64) -> Option<i64> {
    let row =
        sqlx::query("SELECT hold_id FROM partner_withdrawal WHERE tenant_id = $1 AND id = $2")
            .bind(TENANT_ID)
            .bind(withdrawal_id)
            .fetch_one(pool)
            .await
            .expect("read withdrawal hold id");
    row.get("hold_id")
}

async fn ledger_total(pool: &PgPool, business_type: &str, direction: &str) -> i64 {
    let row = sqlx::query(
        r#"
        SELECT CAST(COALESCE(SUM(amount), 0) AS BIGINT) AS total
        FROM acct_ledger_entry
        WHERE tenant_id = $1 AND organization_id = $2
          AND owner_type = 'PARTNER' AND owner_id = $3
          AND business_type = $4 AND direction = $5
        "#,
    )
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(PARTNER_ID)
    .bind(business_type)
    .bind(direction)
    .fetch_one(pool)
    .await
    .expect("read partner ledger totals");
    row.get::<i64, _>("total")
}

struct PostgresTestContext {
    pool: PgPool,
    database_url: String,
    schema: String,
}

impl PostgresTestContext {
    async fn new(label: &str) -> Option<Self> {
        let database_url = match env::var(POSTGRES_TEST_DATABASE_URL) {
            Ok(value) if !value.trim().is_empty() => value,
            _ => {
                eprintln!(
                    "skipping partner wallet e2e test; set {POSTGRES_TEST_DATABASE_URL} to run it"
                );
                return None;
            }
        };
        let schema = format!("sdkwork_partner_wallet_e2e_{label}");
        let quoted_schema = quote_identifier(&schema);
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "DROP SCHEMA IF EXISTS {quoted_schema} CASCADE"
        )))
        .execute(&admin_pool)
        .await
        .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "CREATE SCHEMA {quoted_schema}"
        )))
        .execute(&admin_pool)
        .await
        .unwrap();
        admin_pool.close().await;

        let schema_for_connections = schema.clone();
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .after_connect(move |connection, _metadata| {
                let schema = schema_for_connections.clone();
                Box::pin(async move {
                    sqlx::query(sqlx::AssertSqlSafe(format!(
                        "SET search_path TO {}",
                        quote_identifier(&schema)
                    )))
                    .execute(&mut *connection)
                    .await?;
                    Ok(())
                })
            })
            .connect(&database_url)
            .await
            .unwrap();
        create_schema(&pool).await;

        Some(Self {
            pool,
            database_url,
            schema,
        })
    }

    async fn cleanup(self) {
        let Self {
            pool,
            database_url,
            schema,
        } = self;
        pool.close().await;
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "DROP SCHEMA IF EXISTS {} CASCADE",
            quote_identifier(&schema)
        )))
        .execute(&admin_pool)
        .await
        .unwrap();
        admin_pool.close().await;
    }
}

async fn create_schema(pool: &PgPool) {
    for baseline in [ACCOUNT_BASELINE, PARTNER_BASELINE] {
        for statement in split_statements(baseline) {
            sqlx::query(sqlx::AssertSqlSafe(statement.to_owned()))
                .execute(pool)
                .await
                .expect("apply baseline DDL");
        }
    }
}

fn split_statements(baseline: &str) -> Vec<String> {
    // Drop full-line `--` comments first so comment text containing `;` never
    // splits a real statement.
    let without_comments = baseline
        .lines()
        .filter(|line| !line.trim_start().starts_with("--"))
        .collect::<Vec<_>>()
        .join("\n");
    without_comments
        .split(';')
        .map(str::trim)
        .filter(|statement| !statement.is_empty())
        // The baselines wrap groups of idempotent DDL in BEGIN;...COMMIT;
        // blocks. Executing BEGIN; alone on a pooled connection would leave
        // that connection idle in transaction holding its locks while the
        // matching COMMIT; lands on another connection as a no-op, so every
        // later ALTER TABLE blocks forever. Drop the bare transaction
        // markers: each remaining statement is idempotent and safe to apply
        // in autocommit, preserving the original statement order.
        .filter(|statement| {
            let upper = statement.to_uppercase();
            upper != "BEGIN" && upper != "COMMIT"
        })
        .map(str::to_owned)
        .collect()
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}
