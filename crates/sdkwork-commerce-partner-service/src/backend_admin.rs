//! Partner admin surface: subject scope, response items, repository port, and
//! the admin service facade.

use crate::commands::{
    BindCustomerCommand, BindPartnerUserAccountCommand, CreateJoinFeePaymentCommand,
    CreateLedgerAdjustmentCommand, CreateManualCommissionEventCommand, CreatePartnerCommand,
    CreatePartnerLevelCommand, CreateWithdrawalCommand, DeletePartnerLevelCommand,
    PayWithdrawalCommand, ReviewWithdrawalCommand, RunCommissionSettlementCommand,
    UnbindCustomerCommand, UpdateCommissionConfigCommand, UpdatePartnerCommand,
    UpdatePartnerLevelCommand,
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
    pub max_commission_depth: i64,
    pub currency: String,
    pub min_withdrawal_amount: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerLevelItem {
    pub id: i64,
    pub level_no: i32,
    pub name: String,
    pub customer_revenue_ratio: String,
    pub join_fee_commission_ratio: String,
    pub join_fee: String,
    pub status: String,
    pub sort_order: i32,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerItem {
    pub id: i64,
    pub uuid: String,
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub email: String,
    pub level_no: i32,
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
    pub id: i64,
    pub name: String,
    pub level_no: i32,
    pub status: String,
    pub children: Vec<PartnerTreeItem>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerAncestorItem {
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
    pub id: i64,
    pub operator_id: i64,
    pub operator_type: String,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<i64>,
    pub request_id: Option<String>,
    pub payload: String,
    pub created_at: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsOverviewItem {
    pub total_partners: i64,
    pub active_partners: i64,
    pub total_join_fee: String,
    pub total_commission: String,
    pub pending_withdrawal_count: i64,
    pub pending_withdrawal_amount: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatSnapshotItem {
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
    pub processed: i64,
    pub settled: i64,
    pub skipped: i64,
    pub failed: i64,
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
}
