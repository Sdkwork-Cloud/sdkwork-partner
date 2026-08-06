//! Standalone Partner gateway binary (`partner-server`).
//!
//! Development building block only; production routes are owned by the host
//! application topology (e.g. sdkwork-cloudrouter).

use sdkwork_api_partner_assembly::assemble_backend_business_router;
use sdkwork_partner_service_host::PartnerServiceHost;
use std::sync::Arc;

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
    let host = Arc::new(PartnerServiceHost::from_env().await.map_err(|error| {
        tracing::error!("bootstrap partner service host failed: {error}");
        error
    })?);

    let app = assemble_backend_business_router(host)
        .await
        .map_err(|error| {
            tracing::error!("assemble partner router failed: {error}");
            error
        })?;

    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("partner-server listening on {bind}");
    axum::serve(listener, app.router).await?;
    Ok(())
}
