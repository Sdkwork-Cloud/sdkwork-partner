//! Regression contract: the two anonymous partner join surfaces must resolve
//! as public (skip credential resolution) through the app-api route manifest.
//!
//! A previous mismatch (axum routes registered under kebab-case while the
//! manifest and OpenAPI authority use snake_case) made `match_route` miss the
//! public routes, so anonymous requests failed with 40101
//! (`missing-access-token` during request-context-resolution).

use sdkwork_routes_partner_app_api::gateway_route_manifest;

#[test]
fn public_surfaces_resolve_anonymously_from_manifest() {
    let manifest = gateway_route_manifest();

    for path in [
        "/app/v3/api/partner_join",
        "/app/v3/api/partner_join/invite_codes/ABC123",
    ] {
        let route = manifest
            .match_route("GET", path)
            .unwrap_or_else(|| panic!("manifest must match GET {path}"));
        assert!(
            route.auth.skips_credential_resolution(),
            "GET {path} must skip credential resolution (RouteAuth::Public)"
        );
        assert!(route.auth.is_anonymous(), "GET {path} must be anonymous");
    }
}

#[test]
fn protected_surfaces_require_credentials() {
    let manifest = gateway_route_manifest();

    for (method, path) in [
        ("POST", "/app/v3/api/partner_join/applications"),
        ("GET", "/app/v3/api/partner_join/applications/mine"),
        ("POST", "/app/v3/api/partner_join/applications/1/cancel"),
    ] {
        let route = manifest
            .match_route(method, path)
            .unwrap_or_else(|| panic!("manifest must match {method} {path}"));
        assert!(
            !route.auth.skips_credential_resolution(),
            "{method} {path} must require credentials (dual-token)"
        );
    }
}

#[test]
fn kebab_case_variants_do_not_match() {
    // The wire contract is snake_case (`partner_join`, `invite_codes`);
    // legacy kebab-case paths must NOT match the public manifest, otherwise a
    // stale client would silently bypass the intended route classification.
    let manifest = gateway_route_manifest();
    assert!(manifest
        .match_route("GET", "/app/v3/api/partner-join")
        .is_none());
    assert!(manifest
        .match_route("GET", "/app/v3/api/partner_join/invite-codes/ABC123")
        .is_none());
}
