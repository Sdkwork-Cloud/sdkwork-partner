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
use sdkwork_partner_database_host::{bootstrap_partner_database_from_env, PartnerDatabaseHost};
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
        // Partner persistence is PostgreSQL-only; the DatabasePool Sqlite
        // variant is gated behind the "sqlite" feature. An irrefutable match
        // keeps this explicit — enabling sqlite later becomes a compile error
        // here, forcing a deliberate decision instead of a silent fallback.
        let pool = match database.pool() {
            DatabasePool::Postgres(pool, _context) => pool.clone(),
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
