//! Repository port contracts and port-name constants for the partner capability.

pub const PARTNER_REPOSITORY_PORT: &str = "partner.repository";
pub const PARTNER_ADMIN_REPOSITORY_PORT: &str = "partner.admin.repository";

/// App-surface partner store port (phase 2: partner self-service).
///
/// Declared now so the port registry is stable; implementations land with the
/// app-api surface.
pub trait PartnerRepositoryPort: Send + Sync {}
