use axum::Router;
use sdkwork_web_axum::with_web_request_context;
use sdkwork_web_core::{WebRequestContextProfile, WebRequestContextResolver};

use crate::http_route_manifest::app_route_manifest;
pub use crate::http_route_manifest::partner_app_api_public_path_prefixes;

pub fn wrap_router_with_web_framework<R>(resolver: R, router: Router) -> Router
where
    R: WebRequestContextResolver + Clone,
{
    let route_manifest = app_route_manifest();
    route_manifest
        .validate_public_path_prefixes(&partner_app_api_public_path_prefixes())
        .expect("partner app-api public prefixes must not cover protected manifest routes");

    let (environment, security_policy) =
        sdkwork_web_bootstrap::application_security_policy_from_env(
            &[
                "SDKWORK_ENVIRONMENT",
                "SDKWORK_PARTNER_ENVIRONMENT",
                "PARTNER_ENVIRONMENT",
                "SDKWORK_ENV",
            ],
            &["SDKWORK_CORS_ALLOWED_ORIGINS"],
        );
    let layer = sdkwork_iam_web_adapter::build_web_framework_layer(
        resolver,
        route_manifest,
        partner_app_api_public_path_prefixes(),
    )
    .with_profile(WebRequestContextProfile {
        public_path_prefixes: partner_app_api_public_path_prefixes(),
        environment,
        ..WebRequestContextProfile::default()
    })
    .with_security_policy(security_policy);
    with_web_request_context(router, layer)
}

pub async fn wrap_router_with_web_framework_from_env(router: Router) -> Router {
    let resolver = sdkwork_iam_web_adapter::iam_web_request_context_resolver_from_env().await;
    wrap_router_with_web_framework(resolver, router)
}
