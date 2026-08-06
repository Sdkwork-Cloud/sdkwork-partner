use axum::Router;
use sdkwork_partner_service_host::PartnerServiceHost;
use std::sync::Arc;

use crate::operations::build_backend_partner_router;
use crate::web_bootstrap::wrap_router_with_web_framework_from_env;

pub fn build_partner_backend_router(host: Arc<PartnerServiceHost>) -> Router {
    build_backend_partner_router(host.partner_admin_service())
}

pub async fn build_partner_backend_router_with_framework(host: Arc<PartnerServiceHost>) -> Router {
    wrap_router_with_web_framework_from_env(build_partner_backend_router(host)).await
}
