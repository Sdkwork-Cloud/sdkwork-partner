//! SDKWork Partner service host.
//!
//! Owns an in-process service container: partner database bootstrap, the
//! partner admin service, the partner join (伙伴计划) app service, and the
//! commission capture/settlement workers. Must not mount HTTP routes.

use sdkwork_commerce_partner_repository_sqlx::{
    account_adapter::PartnerAccountWalletAdapter, PostgresPartnerAdminRepository,
};
use sdkwork_commerce_partner_service::backend_admin::{
    PartnerAdminRepositoryPort, PartnerAdminService,
};
use sdkwork_commerce_partner_service::join_apply::{PartnerJoinRepositoryPort, PartnerJoinService};
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_partner_database_host::{
    bootstrap_partner_database_from_env, bootstrap_partner_database_host_with_pool,
    PartnerDatabaseHost,
};
use std::sync::Arc;

pub struct PartnerServiceHost {
    database: PartnerDatabaseHost,
    partner_admin: Arc<PartnerAdminService>,
    partner_join: Arc<PartnerJoinService>,
}

impl PartnerServiceHost {
    pub fn new(
        database: PartnerDatabaseHost,
        partner_admin: Arc<PartnerAdminService>,
        partner_join: Arc<PartnerJoinService>,
    ) -> Self {
        Self {
            database,
            partner_admin,
            partner_join,
        }
    }

    pub async fn from_env() -> Result<Self, String> {
        let database = bootstrap_partner_database_from_env().await?;
        Self::from_database(database)
    }

    /// Build the partner service host on a shared pool owned by the consuming
    /// host (same-origin dependency composition). Mirrors the membership
    /// `MembershipServiceHost::from_pool` pattern; the consuming host already
    /// owns the database lifecycle for this pool.
    pub async fn from_pool(pool: &DatabasePool) -> Result<Self, String> {
        let database = bootstrap_partner_database_host_with_pool(pool).await?;
        Self::from_database(database)
    }

    fn from_database(database: PartnerDatabaseHost) -> Result<Self, String> {
        // Partner persistence is PostgreSQL-only. Shared workspace consumers
        // can unify the database crate's optional engine features, so reject
        // non-PostgreSQL pools explicitly instead of making feature unification
        // a compile-time failure for the whole application graph.
        let pool = match database.pool() {
            DatabasePool::Postgres(pool, _context) => pool.clone(),
            _ => {
                return Err(
                    "partner service host requires an authoritative PostgreSQL database pool"
                        .to_owned(),
                )
            }
        };
        let repository = Arc::new(PostgresPartnerAdminRepository::new(
            pool.clone(),
            Arc::new(PartnerAccountWalletAdapter::new(pool.clone())),
        ));
        // One PostgreSQL repository instance backs both ports: the admin
        // service (levels/partners/commission review) and the join app
        // service (partner join applications + program catalog reads).
        let admin_repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync> =
            repository.clone();
        let join_repository: Arc<dyn PartnerJoinRepositoryPort + Send + Sync> = repository;
        let partner_admin = Arc::new(PartnerAdminService::new(admin_repository.clone()));
        let partner_join = Arc::new(PartnerJoinService::new(join_repository, admin_repository));
        Ok(Self::new(database, partner_admin, partner_join))
    }

    pub fn partner_admin_service(&self) -> Arc<PartnerAdminService> {
        self.partner_admin.clone()
    }

    pub fn partner_join_service(&self) -> Arc<PartnerJoinService> {
        self.partner_join.clone()
    }

    pub fn database_pool(&self) -> &DatabasePool {
        self.database.pool()
    }

    pub fn database_module(&self) -> std::sync::Arc<sdkwork_database_spi::DefaultDatabaseModule> {
        self.database.module()
    }
}
