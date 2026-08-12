//! Runtime behavior contract for the anonymous partner join surfaces: the
//! web framework layer must let GET /app/v3/api/partner_join and
//! /app/v3/api/partner_join/invite_codes/{code} through WITHOUT any credential
//! while protected app-api routes still demand dual-token credentials.
//!
//! Regression: axum routes were registered under kebab-case paths while the
//! manifest and OpenAPI authority use snake_case, so the manifest never
//! matched anonymous requests and they failed with 40101
//! (missing-access-token during request-context-resolution).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::response::Response;
use axum::Router;
use sdkwork_web_core::DefaultWebRequestContextResolver;
use tower::ServiceExt;

async fn dummy_handler() -> Response {
    Response::new(Body::from("ok"))
}

fn test_router() -> Router<()> {
    let router = Router::new()
        .route(
            "/app/v3/api/partner_join",
            axum::routing::get(dummy_handler),
        )
        .route(
            "/app/v3/api/partner_join/applications",
            axum::routing::post(dummy_handler),
        )
        .route(
            "/app/v3/api/partner_join/invite_codes/{code}",
            axum::routing::get(dummy_handler),
        );
    sdkwork_routes_partner_app_api::wrap_router_with_web_framework(
        DefaultWebRequestContextResolver::default(),
        router,
    )
}

fn assert_status(router: Router<()>, method: &str, path: &str, expected: StatusCode) {
    let response = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            let request = Request::builder()
                .method(method)
                .uri(path)
                .body(Body::empty())
                .unwrap();
            router.clone().oneshot(request).await.unwrap()
        });
    assert_eq!(
        response.status(),
        expected,
        "{method} {path} expected {expected}"
    );
}

#[test]
fn anonymous_public_surfaces_are_reachable_without_credentials() {
    let router = test_router();
    assert_status(
        router.clone(),
        "GET",
        "/app/v3/api/partner_join",
        StatusCode::OK,
    );
    assert_status(
        router,
        "GET",
        "/app/v3/api/partner_join/invite_codes/ABC123",
        StatusCode::OK,
    );
}

#[test]
fn protected_app_surfaces_require_credentials() {
    let router = test_router();
    assert_status(
        router,
        "POST",
        "/app/v3/api/partner_join/applications",
        StatusCode::UNAUTHORIZED,
    );
}
