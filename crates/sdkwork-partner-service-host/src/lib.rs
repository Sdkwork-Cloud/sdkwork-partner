//! SDKWork Partner service host.
//!
//! Owns an in-process service container: partner database bootstrap, the
//! partner admin service, and the commission capture/settlement workers.
//! Must not mount HTTP routes.

use sdkwork_commerce_partner_repository_sqlx::PostgresPartnerAdminRepository;
use sdkwork_commerce_partner_service::backend_admin::{
    PartnerAdminRepositoryPort, PartnerAdminService,
};
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_partner_database_host::{bootstrap_partner_database_from_env, PartnerDatabaseHost};
use std::sync::Arc;

pub struct PartnerServiceHost {
    database: PartnerDatabaseHost,
    partner_admin: Arc<PartnerAdminService>,
}

impl PartnerServiceHost {
    pub fn new(database: PartnerDatabaseHost, partner_admin: Arc<PartnerAdminService>) -> Self {
        Self {
            database,
            partner_admin,
        }
    }

    pub async fn from_env() -> Result<Self, String> {
        let database = bootstrap_partner_database_from_env().await?;
        let pool = match database.pool() {
            DatabasePool::Postgres(pool) => pool.clone(),
            other => {
                return Err(format!(
                    "partner service host requires a PostgreSQL pool, got {other:?}"
                ));
            }
        };
        let repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync> =
            Arc::new(PostgresPartnerAdminRepository::new(pool));
        let partner_admin = Arc::new(PartnerAdminService::new(repository));
        Ok(Self::new(database, partner_admin))
    }

    pub fn partner_admin_service(&self) -> Arc<PartnerAdminService> {
        self.partner_admin.clone()
    }

    pub fn database_pool(&self) -> &DatabasePool {
        self.database.pool()
    }

    pub fn database_module(&self) -> std::sync::Arc<sdkwork_database_spi::DefaultDatabaseModule> {
        self.database.module()
    }
}
