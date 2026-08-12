//! Gateway assembly for sdkwork-partner.
//! Application bootstrap lives in `bootstrap.rs`; route inventory is in `assembly-manifest.json`.
// SDKWORK-ASSEMBLY-LIB-CUSTOM

mod bootstrap;
mod generated;

pub use bootstrap::{assemble_api_router, ApiAssembly, ApiAssemblyContext};

use sdkwork_partner_service_host::PartnerServiceHost;
use sdkwork_web_core::DomainContextInjector;
use std::sync::Arc;

pub async fn assemble_backend_business_router(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    let context = bootstrap::ApiAssemblyContext {
        host,
        domain_context_injectors: Vec::<Arc<dyn DomainContextInjector>>::new(),
        readiness_check: Arc::new(sdkwork_web_bootstrap::AlwaysReady)
            as Arc<dyn sdkwork_web_bootstrap::ReadinessCheck>,
    };
    bootstrap::assemble_backend_api_contribution(context).await
}

/// Business-only assembly for the partner join (伙伴计划) app-api surface.
pub async fn assemble_app_business_router(
    host: Arc<PartnerServiceHost>,
) -> Result<bootstrap::ApiAssembly, String> {
    let context = bootstrap::ApiAssemblyContext {
        host,
        domain_context_injectors: Vec::<Arc<dyn DomainContextInjector>>::new(),
        readiness_check: Arc::new(sdkwork_web_bootstrap::AlwaysReady)
            as Arc<dyn sdkwork_web_bootstrap::ReadinessCheck>,
    };
    bootstrap::assemble_app_api_contribution(context).await
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

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
