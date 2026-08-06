//! SDKWork commerce partner (multi-level agent) domain rules.
//!
//! Owns the commission engine (per-level ratios, depth capping, minor-unit
//! rounding), admin service facade, commands, queries, and repository ports.

pub mod backend_admin;
pub mod commands;
pub mod domain;
pub mod ports;
pub mod queries;
pub mod service;
pub mod validation;
