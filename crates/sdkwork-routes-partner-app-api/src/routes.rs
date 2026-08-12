use axum::Router;
use sdkwork_partner_service_host::PartnerServiceHost;
use std::sync::Arc;

use crate::operations::build_partner_join_router;
use crate::web_bootstrap::wrap_router_with_web_framework_from_env;

pub fn build_partner_app_router(host: Arc<PartnerServiceHost>) -> Router {
    build_partner_join_router(host.partner_join_service())
}

pub async fn build_partner_app_router_with_framework(host: Arc<PartnerServiceHost>) -> Router {
    wrap_router_with_web_framework_from_env(build_partner_app_router(host)).await
}
