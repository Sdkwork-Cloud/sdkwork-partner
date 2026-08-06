//! Host-neutral API assembly for the sdkwork-partner application HTTP plane.
//!
//! Composes the partner backend router from the service host and exposes
//! assembly contributions for standalone and cloud hosts.

pub mod generated;

use axum::Router;
use sdkwork_partner_service_host::PartnerServiceHost;

/// Assemble the backend business router for the partner capability.
pub fn assemble_backend_business_router(host: &PartnerServiceHost) -> Router {
    sdkwork_routes_partner_backend_api::build_backend_partner_router(host.partner_admin_service())
}
