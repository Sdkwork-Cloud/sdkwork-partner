mod api_response;
pub mod http_route_manifest;
mod operations;
pub mod routes;
mod subject;
pub mod web_bootstrap;

pub use operations::build_partner_join_router;
pub use routes::{build_partner_app_router, build_partner_app_router_with_framework};
pub use web_bootstrap::{
    partner_app_api_public_path_prefixes, wrap_router_with_web_framework,
    wrap_router_with_web_framework_from_env,
};

use axum::Router;
use sdkwork_partner_service_host::PartnerServiceHost;
use std::sync::Arc;

pub fn gateway_route_manifest() -> sdkwork_web_core::HttpRouteManifest {
    http_route_manifest::app_route_manifest()
}

pub async fn gateway_mount_business(host: Arc<PartnerServiceHost>) -> Router {
    build_partner_app_router_with_framework(host).await
}

pub async fn gateway_mount(host: Arc<PartnerServiceHost>) -> Router {
    gateway_mount_business(host).await
}
