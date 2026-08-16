//! Standalone Partner gateway binary (`partner-server`).
//!
//! Development building block only; production routes are owned by the host
//! application topology (e.g. sdkwork-cloudrouter).
//!
//! Mounts the full assembled API plane: the partner join (伙伴计划) app-api
//! surface under `/app/v3/api/partner_join/*` and the partner backend-api
//! surface under `/backend/v3/api/partners/*`.

use sdkwork_api_partner_assembly::assemble_api_router_from_env;
use sdkwork_iam_web_adapter::{
    build_web_framework_builder, iam_web_request_context_resolver_from_env,
};
use sdkwork_web_bootstrap::{infra_public_path_prefixes, ComposedApiAssembly};

const DEFAULT_BIND: &str = "0.0.0.0:18098";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sdkwork_partner=debug".into()),
        )
        .init();

    let bind = std::env::var("PARTNER_API_BIND").unwrap_or_else(|_| DEFAULT_BIND.to_string());

    let assembly = assemble_api_router_from_env().await.map_err(|error| {
        tracing::error!("assemble partner router failed: {error}");
        error
    })?;
    let framework = build_web_framework_builder(
        iam_web_request_context_resolver_from_env().await,
        assembly.route_manifest.clone(),
        infra_public_path_prefixes(),
    );
    let app = ComposedApiAssembly::try_compose("SDKWork Partner API", vec![assembly])
        .map_err(std::io::Error::other)?
        .into_hosted(framework)
        .router;

    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("partner-server listening on {bind}");
    axum::serve(listener, app).await?;
    Ok(())
}
