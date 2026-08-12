use sdkwork_web_core::{HttpMethod, HttpRoute, HttpRouteManifest};

const HTTP_ROUTES: &[HttpRoute] = &[
    // Partner join (伙伴计划) program catalog and invite-code validation are
    // anonymous display surfaces (RouteAuth::Public). Applications and their
    // lifecycle require a portal session (dual token).
    HttpRoute::public(
        HttpMethod::Get,
        "/app/v3/api/partner_join",
        "join",
        "partnerJoin.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Post,
        "/app/v3/api/partner_join/applications",
        "join",
        "partnerJoin.application.create",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        "/app/v3/api/partner_join/applications/mine",
        "join",
        "partnerJoin.application.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Post,
        "/app/v3/api/partner_join/applications/{applicationId}/cancel",
        "join",
        "partnerJoin.application.cancel",
    ),
    HttpRoute::public(
        HttpMethod::Get,
        "/app/v3/api/partner_join/invite_codes/{code}",
        "join",
        "partnerJoin.inviteCode.retrieve",
    ),
];

/// App-surface public prefixes: infrastructure paths only.
///
/// The two anonymous join routes are declared `HttpRoute::public` in the
/// manifest; the framework resolves anonymous access from `RouteAuth::Public`
/// (ManifestAuthorizationPolicy), so the public prefix list intentionally does
/// NOT cover `/app/v3/api/partner_join` — a prefix that broad would also cover
/// the protected `/partner-join/applications` routes and fail
/// `validate_public_path_prefixes`.
pub fn partner_app_api_public_path_prefixes() -> Vec<String> {
    sdkwork_web_bootstrap::infra_public_path_prefixes()
}

pub fn app_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(HTTP_ROUTES)
}
