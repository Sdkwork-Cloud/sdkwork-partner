//! Validated read queries for the partner admin surface.

use sdkwork_contract_service::CommerceServiceError;

pub const MAX_PAGE_SIZE: i64 = 200;

#[derive(Clone, Debug)]
pub struct PartnerAdminListQuery {
    pub page: i64,
    pub page_size: i64,
    pub q: Option<String>,
}

impl PartnerAdminListQuery {
    pub fn new(page: i64, page_size: i64, q: Option<String>) -> Result<Self, CommerceServiceError> {
        if page < 1 {
            return Err(CommerceServiceError::validation(
                "page must be a positive integer",
            ));
        }
        if !(1..=MAX_PAGE_SIZE).contains(&page_size) {
            return Err(CommerceServiceError::validation(format!(
                "page_size must be between 1 and {MAX_PAGE_SIZE}"
            )));
        }
        Ok(Self {
            page,
            page_size,
            q: q.map(|value| value.trim().to_string()),
        })
    }
}

#[derive(Clone, Debug)]
pub struct ListPartnerLevelsQuery {
    pub include_disabled: bool,
}

impl ListPartnerLevelsQuery {
    pub fn new(include_disabled: bool) -> Self {
        Self { include_disabled }
    }
}

#[derive(Clone, Debug)]
pub struct ListPartnersQuery {
    pub list: PartnerAdminListQuery,
    pub status: Option<String>,
    pub level_no: Option<i32>,
    /// Inclusive created-at lower bound (RFC 3339).
    pub created_from: Option<String>,
    /// Exclusive created-at upper bound (RFC 3339).
    pub created_to: Option<String>,
    /// Join fee payment status (`PAID`/`UNPAID`).
    pub join_fee_status: Option<String>,
}

impl ListPartnersQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        status: Option<String>,
        level_no: Option<i32>,
        created_from: Option<String>,
        created_to: Option<String>,
        join_fee_status: Option<String>,
    ) -> Self {
        Self {
            list,
            status,
            level_no,
            created_from,
            created_to,
            join_fee_status,
        }
    }
}

#[derive(Clone, Debug)]
pub struct RetrievePartnerQuery {
    pub partner_id: i64,
}

impl RetrievePartnerQuery {
    pub fn new(partner_id: i64) -> Result<Self, CommerceServiceError> {
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        Ok(Self { partner_id })
    }
}

#[derive(Clone, Debug)]
pub struct ListJoinFeePaymentsQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: Option<i64>,
    pub status: Option<String>,
}

impl ListJoinFeePaymentsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        partner_id: Option<i64>,
        status: Option<String>,
    ) -> Self {
        Self {
            list,
            partner_id,
            status,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListCustomerBindingsQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: Option<i64>,
    pub status: Option<String>,
}

impl ListCustomerBindingsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        partner_id: Option<i64>,
        status: Option<String>,
    ) -> Self {
        Self {
            list,
            partner_id,
            status,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListCommissionEventsQuery {
    pub list: PartnerAdminListQuery,
    pub status: Option<String>,
    pub source_type: Option<String>,
}

impl ListCommissionEventsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        status: Option<String>,
        source_type: Option<String>,
    ) -> Self {
        Self {
            list,
            status,
            source_type,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListSettlementsQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: Option<i64>,
    pub status: Option<String>,
}

impl ListSettlementsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        partner_id: Option<i64>,
        status: Option<String>,
    ) -> Self {
        Self {
            list,
            partner_id,
            status,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListLedgerEntriesQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: i64,
    pub entry_type: Option<String>,
}

impl ListLedgerEntriesQuery {
    pub fn new(list: PartnerAdminListQuery, partner_id: i64, entry_type: Option<String>) -> Self {
        Self {
            list,
            partner_id,
            entry_type,
        }
    }
}

/// Admin audit-log page query (partner_audit_log projection).
#[derive(Clone, Debug)]
pub struct ListAuditLogsQuery {
    pub list: PartnerAdminListQuery,
    pub action: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<i64>,
    pub operator_id: Option<i64>,
}

impl ListAuditLogsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        action: Option<String>,
        target_type: Option<String>,
        target_id: Option<i64>,
        operator_id: Option<i64>,
    ) -> Self {
        Self {
            list,
            action,
            target_type,
            target_id,
            operator_id,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListWithdrawalsQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: Option<i64>,
    pub status: Option<String>,
}

impl ListWithdrawalsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        partner_id: Option<i64>,
        status: Option<String>,
    ) -> Self {
        Self {
            list,
            partner_id,
            status,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ListStatsSnapshotsQuery {
    pub list: PartnerAdminListQuery,
    pub partner_id: Option<i64>,
    pub period_type: Option<String>,
}

impl ListStatsSnapshotsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        partner_id: Option<i64>,
        period_type: Option<String>,
    ) -> Self {
        Self {
            list,
            partner_id,
            period_type,
        }
    }
}
