//! SDKWork Partner backend API route crate.
//!
//! Owns the `/backend/v3/api/partners/*` admin HTTP surface: ACL, subject
//! scoping, response envelope, and the hand-written HTTP route manifest.

pub mod api_response;
pub mod backend_acl;
pub mod http_route_manifest;
pub mod operations;
pub mod subject;
pub mod web_bootstrap;

pub use operations::build_backend_partner_router;
