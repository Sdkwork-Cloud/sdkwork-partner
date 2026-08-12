//! Repository port contracts and port-name constants for the partner capability.

pub mod partner_relation;

pub use partner_relation::{
    PartnerRelationFuture, PartnerRelationResolvePort, PartnerRelationSnapshot,
};

pub const PARTNER_REPOSITORY_PORT: &str = "partner.repository";
pub const PARTNER_ADMIN_REPOSITORY_PORT: &str = "partner.admin.repository";
pub const PARTNER_JOIN_REPOSITORY_PORT: &str = "partner.join.repository";

/// App-surface partner store port (phase 2: partner self-service).
///
/// Declared now so the port registry is stable; implementations land with the
/// app-api surface.
pub trait PartnerRepositoryPort: Send + Sync {}
