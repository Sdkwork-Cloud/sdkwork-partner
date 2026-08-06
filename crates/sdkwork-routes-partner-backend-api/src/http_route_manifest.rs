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
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/commission-config",
        "commissionConfig.retrieve",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/commission-config",
        "commissionConfig.update",
    ),
    // Partners
    read(HttpMethod::Get, "/backend/v3/api/partners", "partners.list"),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners",
        "partners.create",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}",
        "partners.retrieve",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/{partnerId}",
        "partners.update",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/tree",
        "partners.tree.list",
    ),
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/ancestors",
        "partners.ancestors.list",
    ),
    // Join fees
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/join-fee-payments",
        "joinFeePayments.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/{partnerId}/join-fee-payments",
        "joinFeePayments.create",
    ),
    // Customer bindings
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/{partnerId}/customers",
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
        "/backend/v3/api/partners/commission-events",
        "commissionEvents.list",
    ),
    manage(
        HttpMethod::Post,
        "/backend/v3/api/partners/commission-events",
        "commissionEvents.createManual",
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
        "ledgerEntries.adjust",
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
        "withdrawals.review",
    ),
    manage(
        HttpMethod::Patch,
        "/backend/v3/api/partners/withdrawals/{withdrawalId}/pay",
        "withdrawals.pay",
    ),
    // Stats
    read(
        HttpMethod::Get,
        "/backend/v3/api/partners/stats/overview",
        "stats.overview",
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
