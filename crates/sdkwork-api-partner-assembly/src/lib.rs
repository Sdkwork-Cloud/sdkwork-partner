//! Gateway assembly for sdkwork-partner.
//! Application bootstrap lives in `bootstrap.rs`; route inventory is in `assembly-manifest.json`.
// SDKWORK-ASSEMBLY-LIB-CUSTOM

mod bootstrap;
mod generated;

pub use bootstrap::{
    assemble_api_router, assemble_app_api_contribution, assemble_backend_api_contribution,
    ApiAssembly, ApiAssemblyContext,
};

use sdkwork_database_sqlx::DatabasePool;
use sdkwork_partner_service_host::PartnerServiceHost;
use sdkwork_web_core::DomainContextInjector;
use std::sync::Arc;

/// Business-only assembly for the partner backend-api surface (levels,
/// partners, applications review, commission review).
///
/// Returns the dependency-owned backend contribution without a Web Framework
/// layer — the consuming host installs framework/security once on the
/// combined router (API_ASSEMBLY_SPEC §4/§6.1). The standalone partner
/// gateway uses `assemble_api_router`/`assemble_backend_business_router_from_env`
/// for the framework-wrapped profile.
pub async fn assemble_backend_business_router(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    assemble_backend_business_router_with_host(host).await
}

/// Same-origin dependency composition: build the partner backend business
/// contribution on a shared pool owned by the consuming host. Mirrors
/// `assemble_backend_business_router_with_pool` on the membership assembly.
pub async fn assemble_backend_business_router_with_pool(
    pool: &DatabasePool,
) -> Result<bootstrap::ApiAssembly, String> {
    let host = Arc::new(PartnerServiceHost::from_pool(pool).await?);
    assemble_backend_business_router_with_host(host).await
}

async fn assemble_backend_business_router_with_host(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    let router = sdkwork_routes_partner_backend_api::build_partner_backend_router(host);
    let manifest = sdkwork_routes_partner_backend_api::gateway_route_manifest();
    bootstrap::ApiAssembly::from_manifest(
        "sdkwork-partner",
        "SDKWork partner Backend API",
        router,
        manifest,
        Vec::<Arc<dyn DomainContextInjector>>::new(),
        Arc::new(sdkwork_web_bootstrap::AlwaysReady)
            as Arc<dyn sdkwork_web_bootstrap::ReadinessCheck>,
    )
}

/// Business-only assembly for the partner join (伙伴计划) app-api surface.
///
/// Returns the dependency-owned app contribution without a Web Framework
/// layer — the consuming host installs framework/security once on the
/// combined router (API_ASSEMBLY_SPEC §4/§6.1). The standalone partner
/// gateway uses `assemble_api_router_from_env` for the framework-wrapped
/// profile.
pub async fn assemble_app_business_router(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    assemble_app_business_router_with_host(host).await
}

/// Same-origin dependency composition: build the partner join app business
/// contribution on a shared pool owned by the consuming host. Mirrors
/// `assemble_app_api_contribution_with_pool` on the membership assembly.
pub async fn assemble_app_business_router_with_pool(
    pool: &DatabasePool,
) -> Result<bootstrap::ApiAssembly, String> {
    let host = Arc::new(PartnerServiceHost::from_pool(pool).await?);
    assemble_app_business_router_with_host(host).await
}

async fn assemble_app_business_router_with_host(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    let router = sdkwork_routes_partner_app_api::build_partner_app_router(host);
    let manifest = sdkwork_routes_partner_app_api::gateway_route_manifest();
    bootstrap::ApiAssembly::from_manifest(
        "sdkwork-partner",
        "SDKWork partner App API",
        router,
        manifest,
        Vec::<Arc<dyn DomainContextInjector>>::new(),
        Arc::new(sdkwork_web_bootstrap::AlwaysReady)
            as Arc<dyn sdkwork_web_bootstrap::ReadinessCheck>,
    )
}

pub async fn assemble_api_router_from_env() -> Result<ApiAssembly, String> {
    let host = Arc::new(PartnerServiceHost::from_env().await?);
    let context = bootstrap::ApiAssemblyContext {
        host,
        domain_context_injectors: Vec::<Arc<dyn DomainContextInjector>>::new(),
        readiness_check: Arc::new(sdkwork_web_bootstrap::AlwaysReady)
            as Arc<dyn sdkwork_web_bootstrap::ReadinessCheck>,
    };
    assemble_api_router(context).await
}

pub async fn assemble_backend_business_router_from_env() -> Result<ApiAssembly, String> {
    let host = Arc::new(PartnerServiceHost::from_env().await?);
    assemble_backend_business_router(host).await
}

/// App-api surface route manifest owned by the dependency assembly. The
/// consuming host composes it into its Web Framework route manifest so the
/// partner join public routes (program catalog, invite code validation)
/// inherit their declared `RouteAuth::Public` auth profile.
pub fn app_api_route_manifest() -> sdkwork_web_core::HttpRouteManifest {
    sdkwork_routes_partner_app_api::gateway_route_manifest()
}

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
