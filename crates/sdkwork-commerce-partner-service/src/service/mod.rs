//! Partner service contract declaration.

use crate::ports::{PARTNER_ADMIN_REPOSITORY_PORT, PARTNER_REPOSITORY_PORT};
use sdkwork_contract_service::CommerceServiceContract;

/// Declare the partner service contract for the commerce service registry.
pub fn partner_service_contract() -> CommerceServiceContract {
    CommerceServiceContract {
        domain: "commerce",
        service_name: "partner",
        write_commands: vec![
            "partner.commissionConfig.update",
            "partner.level.create",
            "partner.level.update",
            "partner.level.delete",
            "partner.create",
            "partner.update",
            "partner.joinFeePayment.create",
            "partner.customerBinding.create",
            "partner.customerBinding.delete",
            "partner.commissionEvent.createManual",
            "partner.settlement.run",
            "partner.ledger.adjust",
            "partner.withdrawal.create",
            "partner.withdrawal.review",
            "partner.withdrawal.pay",
        ],
        read_queries: vec![
            "partner.commissionConfig.retrieve",
            "partner.level.list",
            "partner.list",
            "partner.retrieve",
            "partner.tree.list",
            "partner.ancestors.list",
            "partner.joinFeePayment.list",
            "partner.customerBinding.list",
            "partner.commissionEvent.list",
            "partner.settlement.list",
            "partner.ledger.list",
            "partner.withdrawal.list",
            "partner.stats.overview",
            "partner.stats.list",
            "partner.stats.retrieve",
        ],
        ports: vec![PARTNER_REPOSITORY_PORT, PARTNER_ADMIN_REPOSITORY_PORT],
        requires_idempotency_for_writes: false,
    }
}
