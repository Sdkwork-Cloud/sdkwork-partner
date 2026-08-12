use sdkwork_web_core::{HttpMethod, HttpRoute, HttpRouteManifest};

const READ_PERMISSION: &str = "commerce.partner.read";
const MANAGE_PERMISSION: &str = "commerce.partner.manage";

const HTTP_ROUTES: &[HttpRoute] = &[
    // Levels & commission config
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/levels",
        "levels.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/levels",
        "levels.create",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/levels/{levelId}",
        "levels.update",
    ),
    manage(
        HttpMethod::Delete,
        "/backend/v3/api/partners/levels/{levelId}",
        "levels.delete",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/levels/restore_defaults",
        "levels.restoreDefaults",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/commission_config",
        "commissionConfig.retrieve",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/commission_config",
        "commissionConfig.update",
    ),
    // Partners
    read(HttpMethod::Get, "/backend/v3/api/partners", "partner.list"),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners",
        "partner.create",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}",
        "partner.retrieve",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/{partnerId}",
        "partner.update",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/{partnerId}/user_account",
        "userAccount.create",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/tree",
        "partner.tree.list",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/ancestors",
        "partner.ancestors.list",
    ),
    // Join fees
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/join_fee_payments",
        "joinFeePayments.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/{partnerId}/join_fee_payments",
        "joinFeePayments.create",
    ),
    // Customer bindings
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/customers",
        "customerBindings.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/customers",
        "customerBindings.create",
    ),
    manage(
        HttpMethod::Delete,
        "/backend/v3/api/partners/customers/{bindingId}",
        "customerBindings.delete",
    ),
    // Commission events & settlements
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/commission_events",
        "commissionEvents.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/commission_events",
        "commissionEvents.create",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/settlements/run",
        "settlements.run",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/settlements",
        "settlements.list",
    ),
    // Ledger
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/ledger",
        "ledgerEntries.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/ledger/adjustments",
        "ledgerEntries.create",
    ),
    // Audit log
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/audit_logs",
        "auditLogs.list",
    ),
    // Withdrawals
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/withdrawals",
        "withdrawals.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/withdrawals",
        "withdrawals.create",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/withdrawals/{withdrawalId}/review",
        "withdrawalReviews.update",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/withdrawals/{withdrawalId}/pay",
        "withdrawalPayments.update",
    ),
    // Stats
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/stats/overview",
        "statsOverview.list",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/stats",
        "stats.list",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/stats",
        "stats.retrieve",
    ),
    // Partner join (伙伴计划) application review
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/applications",
        "applications.list",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/applications/{applicationId}",
        "applications.retrieve",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/applications/{applicationId}/approve",
        "applications.approve",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/applications/{applicationId}/reject",
        "applications.reject",
    ),
];

const fn read(method: HttpMethod, path: &'static str, operation_id: &'static str) -> HttpRoute {
    HttpRoute::dual_token(method, path, "partners", operation_id)
        .with_required_permission(READ_PERMISSION)
}

const fn manage(method: HttpMethod, path: &'static str, operation_id: &'static str) -> HttpRoute {
    HttpRoute::dual_token(method, path, "partners", operation_id)
        .with_required_permission(MANAGE_PERMISSION)
}

pub fn backend_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(HTTP_ROUTES)
}
