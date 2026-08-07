//! SDKWork commerce partner SQLx repository.
//!
//! Implements the repository ports declared by `sdkwork-commerce-partner-service`
//! over PostgreSQL with hand-written `sqlx::query` bindings, transactional
//! writes, and recursive CTE ancestor walks.

pub mod account_adapter;
mod mapping;
mod partner_admin_sql;
pub mod postgres_partner_admin;

pub use account_adapter::{PartnerAccountWalletAdapter, PartnerWalletPort};
pub use postgres_partner_admin::PostgresPartnerAdminRepository;
