//! Partner admin surface: subject scope, response items, repository port, and
//! the admin service facade.

use crate::commands::{
    BindCustomerCommand, BindPartnerUserAccountCommand, CreateJoinFeePaymentCommand,
    CreateLedgerAdjustmentCommand, CreateManualCommissionEventCommand, CreatePartnerCommand,
    CreatePartnerLevelCommand, CreateWithdrawalCommand, DeletePartnerLevelCommand,
    LevelBenefitItem, PayWithdrawalCommand, ReviewWithdrawalCommand,
    RunCommissionSettlementCommand, UnbindCustomerCommand, UpdateCommissionConfigCommand,
    UpdatePartnerCommand, UpdatePartnerLevelCommand,
};
use crate::join_apply::{
    ApproveJoinApplicationCommand, ListJoinApplicationsQuery, PartnerJoinApplicationItem,
    RejectJoinApplicationCommand,
};
use crate::queries::{
    ListAuditLogsQuery, ListCommissionEventsQuery, ListCustomerBindingsQuery,
    ListJoinFeePaymentsQuery, ListLedgerEntriesQuery, ListPartnerLevelsQuery, ListPartnersQuery,
    ListSettlementsQuery, ListStatsSnapshotsQuery, ListWithdrawalsQuery, RetrievePartnerQuery,
};
use sdkwork_contract_service::CommerceServiceError;
use std::future::Future;
use std::pin::Pin;

/// Scoped admin operator identity for partner operations.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PartnerAdminSubject {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
}

impl PartnerAdminSubject {
    pub fn new(tenant_id: i64, organization_id: i64, user_id: i64) -> Result<Self, String> {
        if tenant_id < 0 || organization_id < 0 || user_id < 0 {
            return Err("tenant/organization/user ids must be non-negative".to_string());
        }
        Ok(Self {
            tenant_id,
            organization_id,
            user_id,
        })
    }
}

pub type PartnerAdminFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, CommerceServiceError>> + Send + 'a>>;

/// Generic paginated admin list page.
#[derive(Clone, Debug)]
pub struct PartnerAdminListPage<T> {
    pub items: Vec<T>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionConfigItem {
    pub enabled: bool,
    pub usage_settlement_enabled: bool,
    pub recharge_enabled: bool,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub max_commission_depth: i64,
    pub currency: String,
    pub min_withdrawal_amount: String,
    /// Platform gross profit margin (percent, e.g. 40.00). The customer
    /// revenue commission base equals `revenue × margin` (profit-based
    /// rebate); join-fee commissions are paid on the full join fee.
    pub profit_margin_ratio: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerLevelItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub level_no: i32,
    pub name: String,
    pub customer_revenue_ratio: String,
    pub join_fee_commission_ratio: String,
    pub join_fee: String,
    pub status: String,
    pub sort_order: i32,
    /// Structured benefit (权益) ladder entries planned for this level.
    pub benefits: Vec<LevelBenefitItem>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub uuid: String,
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub email: String,
    pub level_no: i32,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub parent_partner_id: Option<i64>,
    /// None = no IAM user account bound yet (bindable later).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub user_account_id: Option<i64>,
    pub status: String,
    pub join_fee_amount: String,
    pub join_fee_status: String,
    pub joined_at: Option<String>,
    pub owner_id: i64,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerTreeItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub name: String,
    pub level_no: i32,
    pub status: String,
    pub children: Vec<PartnerTreeItem>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerAncestorItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub name: String,
    pub level_no: i32,
    pub status: String,
    /// 0 = the partner itself, 1 = direct parent, ...
    pub level_offset: i32,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinFeePaymentItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub partner_id: i64,
    pub amount: String,
    pub currency: String,
    pub status: String,
    pub payment_method: String,
    pub paid_at: Option<String>,
    pub paid_by: Option<i64>,
    pub remark: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerBindingItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub partner_id: i64,
    pub customer_user_id: i64,
    pub binding_type: String,
    pub status: String,
    pub bound_at: String,
    pub bound_by: i64,
    pub unbound_at: Option<String>,
    pub unbound_by: Option<i64>,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionEventItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub source_type: String,
    pub source_ref: String,
    pub customer_user_id: i64,
    pub base_amount: String,
    pub event_at: String,
    pub status: String,
    pub settled_at: Option<String>,
    pub remark: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub event_id: i64,
    pub base_amount: String,
    pub distributed_amount: String,
    pub receiver_count: i64,
    pub status: String,
    pub computed_at: String,
    pub remark: String,
    pub distributions: Vec<DistributionItem>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributionItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub settlement_id: i64,
    pub receiver_partner_id: i64,
    pub level_offset: i32,
    pub ratio: String,
    pub base_amount: String,
    pub amount: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntryItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub partner_id: i64,
    pub entry_type: String,
    pub direction: String,
    pub amount: String,
    pub balance_after: String,
    pub ref_type: String,
    pub ref_id: Option<i64>,
    pub operator_id: i64,
    pub remark: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawalItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub partner_id: i64,
    pub amount: String,
    pub status: String,
    pub reviewed_by: Option<i64>,
    pub reviewed_at: Option<String>,
    pub review_remark: String,
    pub paid_at: Option<String>,
    pub paid_by: Option<i64>,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Admin audit-log projection (`partner_audit_log`).
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub operator_id: i64,
    pub operator_type: String,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<i64>,
    /// Internal request correlation id (persisted for audit tracing; not
    /// exposed on the wire — the HTTP response envelope forbids `requestId`).
    #[serde(skip)]
    pub request_id: Option<String>,
    pub payload: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsOverviewItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub total_partners: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub active_partners: i64,
    pub total_join_fee: String,
    pub total_commission: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub pending_withdrawal_count: i64,
    pub pending_withdrawal_amount: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatSnapshotItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub partner_id: i64,
    pub period_start: String,
    pub period_end: String,
    pub period_type: String,
    pub join_fee_total: String,
    pub customer_count: i64,
    pub revenue_base: String,
    pub commission_earned: String,
    pub downstream_partner_count: i64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerStatItem {
    pub partner_id: i64,
    pub total_join_fee: String,
    pub total_commission: String,
    pub available_balance: String,
    pub withdrawing_amount: String,
    pub withdrawn_amount: String,
    pub customer_count: i64,
    pub downstream_partner_count: i64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementRunResult {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub processed: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub settled: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub skipped: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub failed: i64,
}

/// Result of restoring the commercial default level catalog.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDefaultLevelsResult {
    /// Levels inserted or revived from soft-delete.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub restored: i64,
    /// Levels overwritten with the default catalog (`reset` mode only).
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub reset: i64,
    /// Existing active levels left untouched (`fill` mode only).
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub skipped: i64,
}

/// Restore mode for the commercial default level catalog.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RestoreDefaultLevelsMode {
    /// Insert or revive only the missing default levels; never touch active
    /// levels the operator has configured.
    Fill,
    /// Overwrite all seven default levels with the catalog values (keeps the
    /// existing row ids). Operator-created levels beyond the catalog are
    /// never touched.
    Reset,
}

impl RestoreDefaultLevelsMode {
    pub fn parse(value: Option<&str>) -> Result<Self, CommerceServiceError> {
        match value
            .map(str::trim)
            .unwrap_or("fill")
            .to_lowercase()
            .as_str()
        {
            "" | "fill" => Ok(Self::Fill),
            "reset" => Ok(Self::Reset),
            other => Err(CommerceServiceError::validation(format!(
                "unknown restore mode '{other}' (expected 'fill' or 'reset')"
            ))),
        }
    }
}

/// Repository contract for the partner admin surface.
pub trait PartnerAdminRepositoryPort: Send + Sync {
    fn retrieve_commission_config<'a>(
        &'a self,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionConfigItem>;

    fn update_commission_config<'a>(
        &'a self,
        command: UpdateCommissionConfigCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionConfigItem>;

    fn list_levels<'a>(
        &'a self,
        query: ListPartnerLevelsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerLevelItem>>;

    fn create_level<'a>(
        &'a self,
        command: CreatePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerLevelItem>;

    fn update_level<'a>(
        &'a self,
        command: UpdatePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerLevelItem>;

    fn delete_level<'a>(
        &'a self,
        command: DeletePartnerLevelCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, ()>;

    /// Restores the commercial default level catalog (seven-tier pyramid)
    /// for the tenant. `Fill` revives missing or soft-deleted default levels
    /// only; `Reset` additionally overwrites the active default levels with
    /// the catalog values.
    fn restore_default_levels<'a>(
        &'a self,
        mode: RestoreDefaultLevelsMode,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, RestoreDefaultLevelsResult>;

    fn list_partners<'a>(
        &'a self,
        query: ListPartnersQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<PartnerItem>>;

    fn retrieve_partner<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem>;

    fn create_partner<'a>(
        &'a self,
        command: CreatePartnerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem>;

    fn update_partner<'a>(
        &'a self,
        command: UpdatePartnerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem>;

    /// Binds (or replaces) the IAM user account of an existing partner.
    fn bind_partner_user_account<'a>(
        &'a self,
        command: BindPartnerUserAccountCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerItem>;

    fn list_partner_tree<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerTreeItem>>;

    fn list_partner_ancestors<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, Vec<PartnerAncestorItem>>;

    fn list_join_fee_payments<'a>(
        &'a self,
        query: ListJoinFeePaymentsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<JoinFeePaymentItem>>;

    /// Records a join fee payment and, when paid, triggers multi-level
    /// join-fee commission distribution in the same transaction.
    fn create_join_fee_payment<'a>(
        &'a self,
        command: CreateJoinFeePaymentCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, JoinFeePaymentItem>;

    fn list_customer_bindings<'a>(
        &'a self,
        query: ListCustomerBindingsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<CustomerBindingItem>>;

    fn bind_customer<'a>(
        &'a self,
        command: BindCustomerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CustomerBindingItem>;

    fn unbind_customer<'a>(
        &'a self,
        command: UnbindCustomerCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, ()>;

    fn list_commission_events<'a>(
        &'a self,
        query: ListCommissionEventsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<CommissionEventItem>>;

    fn create_manual_commission_event<'a>(
        &'a self,
        command: CreateManualCommissionEventCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, CommissionEventItem>;

    /// Settles pending commission events idempotently (event unique key).
    fn run_commission_settlement<'a>(
        &'a self,
        command: RunCommissionSettlementCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, SettlementRunResult>;

    fn list_settlements<'a>(
        &'a self,
        query: ListSettlementsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<SettlementItem>>;

    fn list_ledger_entries<'a>(
        &'a self,
        query: ListLedgerEntriesQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<LedgerEntryItem>>;

    /// Pages the admin audit log (`partner_audit_log`), newest first.
    fn list_audit_logs<'a>(
        &'a self,
        query: ListAuditLogsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<AuditLogItem>>;

    fn create_ledger_adjustment<'a>(
        &'a self,
        command: CreateLedgerAdjustmentCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, LedgerEntryItem>;

    fn list_withdrawals<'a>(
        &'a self,
        query: ListWithdrawalsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<WithdrawalItem>>;

    fn create_withdrawal<'a>(
        &'a self,
        command: CreateWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem>;

    fn review_withdrawal<'a>(
        &'a self,
        command: ReviewWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem>;

    fn pay_withdrawal<'a>(
        &'a self,
        command: PayWithdrawalCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, WithdrawalItem>;

    fn retrieve_stats_overview<'a>(
        &'a self,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, StatsOverviewItem>;

    fn list_stats_snapshots<'a>(
        &'a self,
        query: ListStatsSnapshotsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<StatSnapshotItem>>;

    fn retrieve_partner_stats<'a>(
        &'a self,
        query: RetrievePartnerQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerStatItem>;

    /// Pages the partner join (伙伴计划) application review queue, newest
    /// first, with status/applicant-type/keyword filters.
    fn list_join_applications<'a>(
        &'a self,
        query: ListJoinApplicationsQuery,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerAdminListPage<PartnerJoinApplicationItem>>;

    /// Retrieves one join application (tenant-scoped).
    fn retrieve_join_application<'a>(
        &'a self,
        application_id: i64,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem>;

    /// Approves a SUBMITTED join application in one transaction: locks the
    /// application row, verifies the assigned level is ACTIVE, creates the
    /// partner record (PENDING, join fee unpaid, bound to the applicant, hung
    /// on the inviter chain, invite code generated), marks the application
    /// APPROVED with reviewer fields, and writes the audit trail.
    fn approve_join_application<'a>(
        &'a self,
        command: ApproveJoinApplicationCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem>;

    /// Rejects a SUBMITTED join application in one transaction (reason
    /// required) and writes the audit trail.
    fn reject_join_application<'a>(
        &'a self,
        command: RejectJoinApplicationCommand,
        subject: &'a PartnerAdminSubject,
    ) -> PartnerAdminFuture<'a, PartnerJoinApplicationItem>;
}

/// Admin service facade over the repository port.
pub struct PartnerAdminService {
    repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync>,
}

use std::sync::Arc;

impl PartnerAdminService {
    pub fn new(repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync>) -> Self {
        Self { repository }
    }

    pub async fn retrieve_commission_config(
        &self,
        subject: &PartnerAdminSubject,
    ) -> Result<CommissionConfigItem, CommerceServiceError> {
        self.repository.retrieve_commission_config(subject).await
    }

    pub async fn update_commission_config(
        &self,
        command: UpdateCommissionConfigCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<CommissionConfigItem, CommerceServiceError> {
        self.repository
            .update_commission_config(command, subject)
            .await
    }

    pub async fn list_levels(
        &self,
        query: ListPartnerLevelsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<Vec<PartnerLevelItem>, CommerceServiceError> {
        self.repository.list_levels(query, subject).await
    }

    pub async fn create_level(
        &self,
        command: CreatePartnerLevelCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerLevelItem, CommerceServiceError> {
        self.repository.create_level(command, subject).await
    }

    pub async fn update_level(
        &self,
        command: UpdatePartnerLevelCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerLevelItem, CommerceServiceError> {
        self.repository.update_level(command, subject).await
    }

    pub async fn delete_level(
        &self,
        command: DeletePartnerLevelCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<(), CommerceServiceError> {
        self.repository.delete_level(command, subject).await
    }

    pub async fn restore_default_levels(
        &self,
        mode: RestoreDefaultLevelsMode,
        subject: &PartnerAdminSubject,
    ) -> Result<RestoreDefaultLevelsResult, CommerceServiceError> {
        self.repository.restore_default_levels(mode, subject).await
    }

    pub async fn list_partners(
        &self,
        query: ListPartnersQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<PartnerItem>, CommerceServiceError> {
        self.repository.list_partners(query, subject).await
    }

    pub async fn retrieve_partner(
        &self,
        query: RetrievePartnerQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerItem, CommerceServiceError> {
        self.repository.retrieve_partner(query, subject).await
    }

    pub async fn create_partner(
        &self,
        command: CreatePartnerCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerItem, CommerceServiceError> {
        self.repository.create_partner(command, subject).await
    }

    pub async fn update_partner(
        &self,
        command: UpdatePartnerCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerItem, CommerceServiceError> {
        self.repository.update_partner(command, subject).await
    }

    pub async fn bind_partner_user_account(
        &self,
        command: BindPartnerUserAccountCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerItem, CommerceServiceError> {
        self.repository
            .bind_partner_user_account(command, subject)
            .await
    }

    pub async fn list_partner_tree(
        &self,
        query: RetrievePartnerQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<Vec<PartnerTreeItem>, CommerceServiceError> {
        self.repository.list_partner_tree(query, subject).await
    }

    pub async fn list_partner_ancestors(
        &self,
        query: RetrievePartnerQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<Vec<PartnerAncestorItem>, CommerceServiceError> {
        self.repository.list_partner_ancestors(query, subject).await
    }

    pub async fn list_join_fee_payments(
        &self,
        query: ListJoinFeePaymentsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<JoinFeePaymentItem>, CommerceServiceError> {
        self.repository.list_join_fee_payments(query, subject).await
    }

    pub async fn create_join_fee_payment(
        &self,
        command: CreateJoinFeePaymentCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<JoinFeePaymentItem, CommerceServiceError> {
        self.repository
            .create_join_fee_payment(command, subject)
            .await
    }

    pub async fn list_customer_bindings(
        &self,
        query: ListCustomerBindingsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<CustomerBindingItem>, CommerceServiceError> {
        self.repository.list_customer_bindings(query, subject).await
    }

    pub async fn bind_customer(
        &self,
        command: BindCustomerCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<CustomerBindingItem, CommerceServiceError> {
        self.repository.bind_customer(command, subject).await
    }

    pub async fn unbind_customer(
        &self,
        command: UnbindCustomerCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<(), CommerceServiceError> {
        self.repository.unbind_customer(command, subject).await
    }

    pub async fn list_commission_events(
        &self,
        query: ListCommissionEventsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<CommissionEventItem>, CommerceServiceError> {
        self.repository.list_commission_events(query, subject).await
    }

    pub async fn create_manual_commission_event(
        &self,
        command: CreateManualCommissionEventCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<CommissionEventItem, CommerceServiceError> {
        self.repository
            .create_manual_commission_event(command, subject)
            .await
    }

    pub async fn run_commission_settlement(
        &self,
        command: RunCommissionSettlementCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<SettlementRunResult, CommerceServiceError> {
        self.repository
            .run_commission_settlement(command, subject)
            .await
    }

    pub async fn list_settlements(
        &self,
        query: ListSettlementsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<SettlementItem>, CommerceServiceError> {
        self.repository.list_settlements(query, subject).await
    }

    pub async fn list_ledger_entries(
        &self,
        query: ListLedgerEntriesQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<LedgerEntryItem>, CommerceServiceError> {
        self.repository.list_ledger_entries(query, subject).await
    }

    pub async fn list_audit_logs(
        &self,
        query: ListAuditLogsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<AuditLogItem>, CommerceServiceError> {
        self.repository.list_audit_logs(query, subject).await
    }

    pub async fn create_ledger_adjustment(
        &self,
        command: CreateLedgerAdjustmentCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<LedgerEntryItem, CommerceServiceError> {
        self.repository
            .create_ledger_adjustment(command, subject)
            .await
    }

    pub async fn list_withdrawals(
        &self,
        query: ListWithdrawalsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<WithdrawalItem>, CommerceServiceError> {
        self.repository.list_withdrawals(query, subject).await
    }

    pub async fn create_withdrawal(
        &self,
        command: CreateWithdrawalCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<WithdrawalItem, CommerceServiceError> {
        self.repository.create_withdrawal(command, subject).await
    }

    pub async fn review_withdrawal(
        &self,
        command: ReviewWithdrawalCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<WithdrawalItem, CommerceServiceError> {
        self.repository.review_withdrawal(command, subject).await
    }

    pub async fn pay_withdrawal(
        &self,
        command: PayWithdrawalCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<WithdrawalItem, CommerceServiceError> {
        self.repository.pay_withdrawal(command, subject).await
    }

    pub async fn retrieve_stats_overview(
        &self,
        subject: &PartnerAdminSubject,
    ) -> Result<StatsOverviewItem, CommerceServiceError> {
        self.repository.retrieve_stats_overview(subject).await
    }

    pub async fn list_stats_snapshots(
        &self,
        query: ListStatsSnapshotsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<StatSnapshotItem>, CommerceServiceError> {
        self.repository.list_stats_snapshots(query, subject).await
    }

    pub async fn retrieve_partner_stats(
        &self,
        query: RetrievePartnerQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerStatItem, CommerceServiceError> {
        self.repository.retrieve_partner_stats(query, subject).await
    }

    pub async fn list_join_applications(
        &self,
        query: ListJoinApplicationsQuery,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerAdminListPage<PartnerJoinApplicationItem>, CommerceServiceError> {
        self.repository.list_join_applications(query, subject).await
    }

    pub async fn retrieve_join_application(
        &self,
        application_id: i64,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerJoinApplicationItem, CommerceServiceError> {
        self.repository
            .retrieve_join_application(application_id, subject)
            .await
    }

    pub async fn approve_join_application(
        &self,
        command: ApproveJoinApplicationCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerJoinApplicationItem, CommerceServiceError> {
        self.repository
            .approve_join_application(command, subject)
            .await
    }

    pub async fn reject_join_application(
        &self,
        command: RejectJoinApplicationCommand,
        subject: &PartnerAdminSubject,
    ) -> Result<PartnerJoinApplicationItem, CommerceServiceError> {
        self.repository
            .reject_join_application(command, subject)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_mode_parse_accepts_defaults_and_explicit_modes() {
        assert_eq!(
            RestoreDefaultLevelsMode::parse(None).unwrap(),
            RestoreDefaultLevelsMode::Fill
        );
        assert_eq!(
            RestoreDefaultLevelsMode::parse(Some("fill")).unwrap(),
            RestoreDefaultLevelsMode::Fill
        );
        assert_eq!(
            RestoreDefaultLevelsMode::parse(Some("reset")).unwrap(),
            RestoreDefaultLevelsMode::Reset
        );
        assert_eq!(
            RestoreDefaultLevelsMode::parse(Some("  FILL  ")).unwrap(),
            RestoreDefaultLevelsMode::Fill
        );
    }

    #[test]
    fn restore_mode_parse_rejects_unknown_modes() {
        assert!(RestoreDefaultLevelsMode::parse(Some("wipe")).is_err());
        // Empty string falls back to the default fill mode.
        assert_eq!(
            RestoreDefaultLevelsMode::parse(Some("")).unwrap(),
            RestoreDefaultLevelsMode::Fill
        );
    }

    #[test]
    fn default_catalog_is_complete_and_consistent() {
        let catalog = crate::domain::default_catalog::DEFAULT_LEVEL_CATALOG;
        assert_eq!(catalog.len(), 7);
        for (index, entry) in catalog.iter().enumerate() {
            assert_eq!(
                entry.level_no,
                (index + 1) as i32,
                "levels must be contiguous"
            );
            assert_eq!(entry.sort_order, (index + 1) as i32);
            assert!(
                entry.customer_revenue_ratio_per_10000 <= 3000,
                "payout pool capped at 30%"
            );
            assert!(!entry.name.is_empty());
            let items = entry.benefits_as_items();
            assert!(!items.is_empty(), "every level needs benefits");
            // Benefit ladders must be ordered and code-unique.
            let codes: Vec<&str> = items.iter().map(|b| b.code.as_str()).collect();
            let mut unique = codes.clone();
            unique.sort_unstable();
            unique.dedup();
            assert_eq!(
                codes.len(),
                unique.len(),
                "duplicate benefit codes in level {}",
                entry.level_no
            );
        }
        // Join fee ladder must start at 5999 and be strictly increasing.
        let fees: Vec<i64> = catalog.iter().map(|e| e.join_fee_cents).collect();
        assert_eq!(fees[0], 599_900);
        for pair in fees.windows(2) {
            assert!(pair[0] < pair[1], "join fees must increase");
        }
    }
}

#[cfg(test)]
mod wire_serialization_tests {
    use super::*;

    /// int64 identifiers must serialize as decimal strings (API_SPEC §16.6,
    /// x-sdkwork-int64-string) so browsers keep exact 64-bit ids. A 19-digit
    /// id like the one below exceeds Number.MAX_SAFE_INTEGER; emitting a JSON
    /// number would silently round it and break parent lookups on replay.
    #[test]
    fn partner_item_serializes_int64_ids_as_strings() {
        let item = PartnerItem {
            id: 8_938_785_933_767_635_644,
            uuid: "e6778f9c-b66e-4b5d-a400-f37d301be9a6".to_owned(),
            name: "总代理".to_owned(),
            contact_name: String::new(),
            phone: String::new(),
            email: String::new(),
            level_no: 1,
            parent_partner_id: Some(8_938_785_933_767_635_643),
            user_account_id: None,
            status: "PENDING".to_owned(),
            join_fee_amount: "0.00".to_owned(),
            join_fee_status: "UNPAID".to_owned(),
            joined_at: None,
            owner_id: 9,
            remark: String::new(),
            created_at: "2026-08-12T00:00:00Z".to_owned(),
            updated_at: "2026-08-12T00:00:00Z".to_owned(),
        };
        let json = serde_json::to_string(&item).expect("serialize partner item");
        assert!(
            json.contains(r#""id":"8938785933767635644""#),
            "id must be a decimal string, got: {json}"
        );
        assert!(
            json.contains(r#""parentPartnerId":"8938785933767635643""#),
            "parentPartnerId must be a decimal string, got: {json}"
        );
        assert!(
            !json.contains(r#""id":8938785933767635644"#),
            "id must not be a JSON number"
        );
    }
}
