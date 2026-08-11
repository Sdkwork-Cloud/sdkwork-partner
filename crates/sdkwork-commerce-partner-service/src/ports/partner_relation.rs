//! Order-integration partner relation port.
//!
//! Lets dependent commerce surfaces (notably `sdkwork-order`) resolve the
//! partner bound to a customer without reaching into partner tables directly.
//! The order side owns its own snapshot port; this crate only exposes the
//! resolution capability on the partner side of the dependency boundary.

use std::future::Future;
use std::pin::Pin;

use sdkwork_contract_service::CommerceServiceError;

pub type PartnerRelationFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, CommerceServiceError>> + Send + 'a>>;

/// Immutable partner facts captured when an order is created.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PartnerRelationSnapshot {
    /// Partner id (numeric id from `partner_partner`).
    pub partner_id: i64,
    /// Partner display name.
    pub name: String,
    /// Partner level number.
    pub level_no: i64,
    /// Partner status (`PENDING`/`ACTIVE`/`SUSPENDED`/`CLOSED`).
    pub status: String,
}

/// Resolves the active customer->partner binding for order creation.
///
/// Implementations MUST treat a missing or inactive binding as `Ok(None)`;
/// order creation must never fail because a customer has no partner.
pub trait PartnerRelationResolvePort: Send + Sync {
    fn resolve_customer_partner<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        customer_user_id: i64,
    ) -> PartnerRelationFuture<'a, Option<PartnerRelationSnapshot>>;
}

/// Port-name constant for the partner relation resolution port.
pub const PARTNER_RELATION_RESOLVE_PORT: &str = "partner.relation.resolve";
