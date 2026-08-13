use sdkwork_database_config::DatabaseConfig;
use sdkwork_database_lifecycle::{lifecycle_options_from_env, LifecycleOrchestrator};
use sdkwork_database_spi::{
    DatabaseAssetProvider, DatabaseManifest, DefaultDatabaseModule, SpiError,
};
use sdkwork_database_sqlx::{create_pool_from_config, DatabasePool};
use std::path::PathBuf;
use std::sync::Arc;

pub struct PartnerDatabaseHost {
    pool: DatabasePool,
    module: Arc<DefaultDatabaseModule>,
}

impl PartnerDatabaseHost {
    pub fn pool(&self) -> &DatabasePool {
        &self.pool
    }

    pub fn module(&self) -> Arc<DefaultDatabaseModule> {
        self.module.clone()
    }
}

/// Load the partner-owned database assets for a federated application host.
///
/// Hosts register this module in `DatabaseModuleRegistry` and call
/// `RegistryLifecycleOrchestrator::bootstrap_all_from_env()` on their shared
/// connection pool so partner schema, migrations, and seeds stay aligned
/// with the rest of the commerce capability databases.
pub fn database_module() -> Result<DefaultDatabaseModule, SpiError> {
    let app_root = std::env::var("SDKWORK_PARTNER_APP_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let raw = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
            std::fs::canonicalize(&raw).unwrap_or(raw)
        });
    DefaultDatabaseModule::from_app_root(&app_root)
}

pub async fn bootstrap_partner_database_from_env() -> Result<PartnerDatabaseHost, String> {
    let _ = dotenvy::dotenv();
    let config = DatabaseConfig::from_env("PARTNER")
        .map_err(|error| format!("read partner database config failed: {error}"))?;
    let pool = create_pool_from_config(config)
        .await
        .map_err(|error| format!("create partner database pool failed: {error}"))?;
    bootstrap_partner_database_host_with_pool(&pool).await
}

/// Bootstrap the partner database schema and migrations using an externally
/// provided pool.
///
/// This is used when partner is integrated as a federated capability inside a
/// host application (e.g. sdkwork-cloudrouter) that already owns a shared
/// database pool. The function loads the partner database module from the
/// partner repository's `database/` assets, runs the DDL baseline, and
/// optionally applies migrations — all controlled by the same manifest/env
/// options as the standalone bootstrap (mirrors
/// `bootstrap_membership_database_host_with_pool`).
pub async fn bootstrap_partner_database_host_with_pool(
    pool: &DatabasePool,
) -> Result<PartnerDatabaseHost, String> {
    if pool.as_postgres().is_none() {
        return Err("partner authoritative-server assembly requires a shared PostgreSQL pool"
            .to_owned());
    }
    let module = Arc::new(
        database_module()
            .map_err(|error| format!("load partner database module failed: {error}"))?,
    );
    let manifest = DatabaseManifest::from_file(module.manifest_path())
        .map_err(|error| format!("read partner database manifest failed: {error}"))?;
    let options = lifecycle_options_from_env("PARTNER", &manifest);
    let orchestrator =
        LifecycleOrchestrator::new(pool.clone(), module.clone()).with_applied_by("sdkwork-partner");
    orchestrator.init().await.map_err(|e| format!("{e}"))?;
    if options.auto_migrate {
        orchestrator.migrate().await.map_err(|e| format!("{e}"))?;
    }
    Ok(PartnerDatabaseHost {
        pool: pool.clone(),
        module,
    })
}
