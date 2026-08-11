//! Lightweight partner relation resolution for dependent commerce surfaces.
//!
//! Resolves the active customer->partner binding (with partner facts) for
//! order creation. Kept separate from `PostgresPartnerAdminRepository` so
//! consumers do not need the wallet adapter or the admin subject machinery.

use sdkwork_contract_service::CommerceServiceError;
use sqlx::{PgPool, Row};

use sdkwork_commerce_partner_service::ports::{
    PartnerRelationFuture, PartnerRelationResolvePort, PartnerRelationSnapshot,
};

/// SQLx-backed `PartnerRelationResolvePort` over the federated commerce pool.
#[derive(Debug)]
pub struct PostgresPartnerRelationResolver {
    pool: PgPool,
}

impl PostgresPartnerRelationResolver {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl PartnerRelationResolvePort for PostgresPartnerRelationResolver {
    fn resolve_customer_partner<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        customer_user_id: i64,
    ) -> PartnerRelationFuture<'a, Option<PartnerRelationSnapshot>> {
        Box::pin(async move {
            let row = sqlx::query(
                "SELECT p.id, p.name, p.level_no, p.status \
                 FROM partner_customer_binding b \
                 JOIN partner_partner p ON p.id = b.partner_id \
                 WHERE b.tenant_id = $1 AND b.organization_id = $2 \
                   AND b.customer_user_id = $3 AND b.status = 'ACTIVE' \
                   AND p.status <> 'CLOSED' \
                   AND p.deleted_at IS NULL \
                 ORDER BY b.updated_at DESC, b.id DESC \
                 LIMIT 1",
            )
            .bind(tenant_id)
            .bind(organization_id)
            .bind(customer_user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(error_from_sql)?;

            let Some(row) = row else {
                return Ok(None);
            };

            Ok(Some(PartnerRelationSnapshot {
                partner_id: row.get::<i64, _>("id"),
                name: row.get::<String, _>("name"),
                level_no: row.get::<i64, _>("level_no"),
                status: row.get::<String, _>("status"),
            }))
        })
    }
}

fn error_from_sql(error: sqlx::Error) -> CommerceServiceError {
    if let sqlx::Error::Database(db_error) = &error {
        if db_error.is_unique_violation() {
            return CommerceServiceError::conflict("unique constraint violated");
        }
    }
    CommerceServiceError::storage(format!("partner relation repository error: {error}"))
}
