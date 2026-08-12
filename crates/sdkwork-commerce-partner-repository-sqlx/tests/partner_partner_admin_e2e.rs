//! Live-PostgreSQL end-to-end tests for partner relation updates.
//!
//! `update_partner` supports changing `parent_partner_id` and
//! `user_account_id` with the same policies as create/bind: the parent must
//! exist and be active, cycles are rejected (a partner cannot become the
//! parent of itself or of its descendants), the IAM user account is unique
//! per partner, and closed partners keep their relations frozen.
//!
//! Skipped unless `SDKWORK_DATABASE_URL` is set (same convention as
//! `partner_wallet_account_e2e`).

use sdkwork_commerce_partner_repository_sqlx::account_adapter::PartnerAccountWalletAdapter;
use sdkwork_commerce_partner_repository_sqlx::PostgresPartnerAdminRepository;
use sdkwork_commerce_partner_service::backend_admin::{
    PartnerAdminRepositoryPort, PartnerAdminSubject, PartnerItem,
};
use sdkwork_commerce_partner_service::commands::{CreatePartnerCommand, UpdatePartnerCommand};
use sdkwork_contract_service::CommerceServiceError;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;
use std::sync::Arc;

const POSTGRES_TEST_DATABASE_URL: &str = "SDKWORK_DATABASE_URL";
const PARTNER_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_partner_baseline.sql");

const TENANT_ID: i64 = 100_002;
const ORGANIZATION_ID: i64 = 0;
const ADMIN_USER_ID: i64 = 9;
const LEVEL_NO: i32 = 1;

#[tokio::test]
async fn update_partner_reparents_to_active_partner() {
    let Some(ctx) = PostgresTestContext::new("reparent").await else {
        return;
    };
    let repo = repository(ctx.pool.clone());
    seed_level(&ctx.pool).await;
    let subject = subject();

    let a = create_partner(&repo, &subject, "A", None, None).await;
    set_active(&ctx.pool, a.id).await;
    let b = create_partner(&repo, &subject, "B", None, None).await;

    let updated = update(&repo, &subject, b.id, Some(a.id), None, "PENDING")
        .await
        .expect("reparent to an active partner");
    assert_eq!(updated.parent_partner_id, Some(a.id));
    assert_eq!(updated.user_account_id, None);

    // Clearing the parent back to top level is also supported.
    let cleared = update(&repo, &subject, b.id, None, None, "PENDING")
        .await
        .expect("clear the parent");
    assert_eq!(cleared.parent_partner_id, None);

    ctx.cleanup().await;
}

#[tokio::test]
async fn update_partner_rejects_missing_or_inactive_parent() {
    let Some(ctx) = PostgresTestContext::new("parent_invalid").await else {
        return;
    };
    let repo = repository(ctx.pool.clone());
    seed_level(&ctx.pool).await;
    let subject = subject();

    let b = create_partner(&repo, &subject, "B", None, None).await;

    let missing = update(&repo, &subject, b.id, Some(999_999_999), None, "PENDING")
        .await
        .expect_err("missing parent must be rejected");
    assert_eq!(missing.code(), "not-found");

    let a = create_partner(&repo, &subject, "A", None, None).await; // PENDING
    let inactive = update(&repo, &subject, b.id, Some(a.id), None, "PENDING")
        .await
        .expect_err("inactive parent must be rejected");
    assert_eq!(inactive.code(), "invalid-state");

    ctx.cleanup().await;
}

#[tokio::test]
async fn update_partner_rejects_cycles() {
    let Some(ctx) = PostgresTestContext::new("cycle").await else {
        return;
    };
    let repo = repository(ctx.pool.clone());
    seed_level(&ctx.pool).await;
    let subject = subject();

    let a = create_partner(&repo, &subject, "A", None, None).await;
    set_active(&ctx.pool, a.id).await;
    let b = create_partner(&repo, &subject, "B", Some(a.id), None).await;
    set_active(&ctx.pool, b.id).await;
    let c = create_partner(&repo, &subject, "C", Some(b.id), None).await;
    set_active(&ctx.pool, c.id).await;

    let own = update(&repo, &subject, b.id, Some(b.id), None, "ACTIVE")
        .await
        .expect_err("a partner cannot be its own parent");
    assert_eq!(own.code(), "validation");

    let descendant = update(&repo, &subject, b.id, Some(c.id), None, "ACTIVE")
        .await
        .expect_err("a descendant cannot become the parent");
    assert_eq!(descendant.code(), "validation");

    // The tree remains intact after the rejected updates.
    let refreshed = update(&repo, &subject, b.id, Some(a.id), None, "ACTIVE")
        .await
        .expect("valid reparent still works");
    assert_eq!(refreshed.parent_partner_id, Some(a.id));

    ctx.cleanup().await;
}

#[tokio::test]
async fn update_partner_binds_user_account_and_rejects_conflict() {
    let Some(ctx) = PostgresTestContext::new("bind_user").await else {
        return;
    };
    let repo = repository(ctx.pool.clone());
    seed_level(&ctx.pool).await;
    let subject = subject();

    let a = create_partner(&repo, &subject, "A", None, None).await;
    let b = create_partner(&repo, &subject, "B", None, None).await;

    let bound = update(&repo, &subject, b.id, None, Some(90_001), "PENDING")
        .await
        .expect("bind an IAM user account");
    assert_eq!(bound.user_account_id, Some(90_001));

    let conflict = update(&repo, &subject, a.id, None, Some(90_001), "PENDING")
        .await
        .expect_err("a user account cannot belong to two partners");
    assert_eq!(conflict.code(), "conflict");

    // Re-binding the same partner with a new account replaces the binding.
    let rebound = update(&repo, &subject, b.id, None, Some(90_002), "PENDING")
        .await
        .expect("rebind with another account");
    assert_eq!(rebound.user_account_id, Some(90_002));

    // Unbinding is supported as well.
    let unbound = update(&repo, &subject, b.id, None, None, "PENDING")
        .await
        .expect("unbind the user account");
    assert_eq!(unbound.user_account_id, None);

    ctx.cleanup().await;
}

#[tokio::test]
async fn update_partner_rejects_relation_change_when_closed() {
    let Some(ctx) = PostgresTestContext::new("closed_frozen").await else {
        return;
    };
    let repo = repository(ctx.pool.clone());
    seed_level(&ctx.pool).await;
    let subject = subject();

    let a = create_partner(&repo, &subject, "A", None, None).await;
    set_active(&ctx.pool, a.id).await;
    let b = create_partner(&repo, &subject, "B", None, None).await;

    // Closing the partner (without relation changes) is allowed.
    let closed = update(&repo, &subject, b.id, None, None, "CLOSED")
        .await
        .expect("close the partner");
    assert_eq!(closed.status, "CLOSED");

    let parent_change = update(&repo, &subject, b.id, Some(a.id), None, "CLOSED")
        .await
        .expect_err("closed partners cannot change their parent");
    assert_eq!(parent_change.code(), "invalid-state");

    let user_change = update(&repo, &subject, b.id, None, Some(90_003), "CLOSED")
        .await
        .expect_err("closed partners cannot change their user account");
    assert_eq!(user_change.code(), "invalid-state");

    ctx.cleanup().await;
}

fn subject() -> PartnerAdminSubject {
    PartnerAdminSubject::new(TENANT_ID, ORGANIZATION_ID, ADMIN_USER_ID).expect("subject")
}

fn repository(pool: PgPool) -> PostgresPartnerAdminRepository {
    PostgresPartnerAdminRepository::new(
        pool.clone(),
        Arc::new(PartnerAccountWalletAdapter::new(pool)),
    )
}

async fn seed_level(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO partner_level (id, uuid, tenant_id, organization_id, level_no, name, status) \
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')",
    )
    .bind(1i64)
    .bind("00000000-0000-0000-0000-00000000LEVEL")
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(LEVEL_NO)
    .bind("L1")
    .execute(pool)
    .await
    .expect("seed partner level");
}

async fn create_partner(
    repo: &PostgresPartnerAdminRepository,
    subject: &PartnerAdminSubject,
    name: &str,
    parent: Option<i64>,
    user: Option<i64>,
) -> PartnerItem {
    let command = CreatePartnerCommand::new(name, "", "", "", LEVEL_NO, parent, user, "")
        .expect("create command");
    repo.create_partner(command, subject)
        .await
        .expect("create partner")
}

async fn set_active(pool: &PgPool, id: i64) {
    // Update the status directly so the partner's parent/user relations are
    // preserved (the repository update helper would also clear them).
    sqlx::query("UPDATE partner_partner SET status = 'ACTIVE' WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .expect("activate partner");
}

async fn update(
    repo: &PostgresPartnerAdminRepository,
    subject: &PartnerAdminSubject,
    id: i64,
    parent: Option<i64>,
    user: Option<i64>,
    status: &str,
) -> Result<PartnerItem, CommerceServiceError> {
    let command = UpdatePartnerCommand::new(
        id,
        "name-kept",
        "",
        "",
        "",
        LEVEL_NO,
        parent,
        user,
        status,
        "",
    )
    .expect("update command");
    repo.update_partner(command, subject).await
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
                    "skipping partner admin e2e test; set {POSTGRES_TEST_DATABASE_URL} to run it"
                );
                return None;
            }
        };
        let schema = format!("sdkwork_partner_admin_e2e_{label}");
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
    for statement in split_statements(PARTNER_BASELINE) {
        sqlx::query(sqlx::AssertSqlSafe(statement.to_owned()))
            .execute(pool)
            .await
            .expect("apply baseline DDL");
    }
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
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
        // The baseline wraps groups of idempotent DDL in BEGIN;...COMMIT;
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
