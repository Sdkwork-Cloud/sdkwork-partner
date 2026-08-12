//! Partner join (伙伴计划) app surface: subject scope, response items, repository
//! port, commands, queries, and the app join service facade.
//!
//! The join program is the public marketing entry of the partner capability:
//! prospects browse the active level catalog (join fees, commission pools,
//! benefits) and rules, submit an application (individual or organization),
//! track its lifecycle (SUBMITTED -> APPROVED/REJECTED/CANCELLED), and validate
//! inviter invite codes before submitting.

use crate::backend_admin::{PartnerAdminListPage, PartnerAdminRepositoryPort, PartnerAdminSubject};
use crate::commands::LevelBenefitItem;
use crate::queries::{ListPartnerLevelsQuery, PartnerAdminListQuery};
use crate::validation::require_non_empty;
use chrono::{DateTime, Utc};
use sdkwork_contract_service::CommerceServiceError;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

/// Scoped applicant identity for partner join operations.
///
/// App-surface writes (submit/cancel) require an authenticated user. Program
/// retrieval and invite-code validation are public and only carry the tenant
/// scope (`user_id = 0` marks the system/public scope; rows are still scoped
/// to the default tenant/organization for standalone deployments).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PartnerJoinSubject {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
}

impl PartnerJoinSubject {
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

    /// Public (unauthenticated) scope: no applicant user, tenant scope only.
    pub fn public_scope(tenant_id: i64, organization_id: i64) -> Self {
        Self {
            tenant_id,
            organization_id,
            user_id: 0,
        }
    }
}

pub type PartnerJoinFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, CommerceServiceError>> + Send + 'a>>;

/// Partner join program item (public level catalog + rules summary).
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerJoinProgramItem {
    /// Active partner level catalog (join fees, pools, benefits).
    pub levels: Vec<PartnerJoinLevelItem>,
    pub rules: PartnerJoinRulesItem,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerJoinLevelItem {
    /// Level number (1-based).
    pub level_no: i32,
    pub name: String,
    /// Join fee amount for this level.
    pub join_fee: String,
    /// Customer revenue commission pool ratio (percent, e.g. 20.00).
    pub customer_revenue_ratio: String,
    /// Join fee commission pool ratio (percent, e.g. 10.00).
    pub join_fee_commission_ratio: String,
    pub status: String,
    /// Structured benefit (权益) ladder granted by this level.
    pub benefits: Vec<LevelBenefitItem>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerJoinRulesItem {
    /// Commission currency (e.g. CNY).
    pub currency: String,
    /// Platform gross profit margin ratio (percent, default 40.00): customer
    /// revenue commissions are profit-based.
    pub profit_margin_ratio: String,
    pub min_withdrawal_amount: String,
    /// Join fee policy summary text (display copy).
    pub join_fee_policy: String,
}

/// Partner join application projection (`partner_application`).
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartnerJoinApplicationItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub uuid: String,
    /// Applicant entity type (`INDIVIDUAL`/`ORGANIZATION`).
    pub applicant_type: String,
    /// Subject name (organization name when applicantType=ORGANIZATION).
    pub subject_name: String,
    pub contact_name: String,
    pub contact_phone: String,
    pub contact_email: String,
    /// Target (aspirational) level number; the final level is decided by the
    /// reviewer on approval.
    pub target_level_no: i32,
    /// Invite code submitted with the application (original input).
    pub invite_code: String,
    /// Inviter partner id locked at submit time (null = no invite code).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub inviter_partner_id: Option<i64>,
    /// Inviter partner display name (admin surface; empty when the application
    /// carried no invite code or the inviter was deleted).
    pub inviter_partner_name: String,
    /// Inviter partner level number (admin surface; null when the application
    /// carried no invite code).
    pub inviter_level_no: Option<i32>,
    pub business_intro: String,
    /// Application status (SUBMITTED/APPROVED/REJECTED/CANCELLED).
    pub status: String,
    /// Review comment (approval note or rejection reason).
    pub review_comment: String,
    /// Reviewer user id (null = not reviewed yet).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub reviewer_user_id: Option<i64>,
    pub reviewed_at: Option<DateTime<Utc>>,
    /// Partner record created on approval (closed loop reference).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub approved_partner_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Invite-code validation result.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteCodeValidation {
    /// The validated invite code.
    pub code: String,
    /// Whether the invite code is valid.
    pub valid: bool,
    /// Inviter partner id (null when invalid).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option")]
    pub partner_id: Option<i64>,
    /// Inviter partner display name (empty when invalid).
    pub partner_name: String,
    /// Inviter partner level number (null when invalid).
    pub level_no: Option<i32>,
}

/// Submit a partner join application (validated write command).
#[derive(Clone, Debug)]
pub struct SubmitJoinApplicationCommand {
    /// Applicant entity type (`INDIVIDUAL`/`ORGANIZATION`).
    pub applicant_type: String,
    /// Subject name; required when applicantType=ORGANIZATION.
    pub subject_name: String,
    pub contact_name: String,
    pub contact_phone: String,
    pub contact_email: String,
    /// Target (aspirational) level number; must be >= 1.
    pub target_level_no: i32,
    /// Optional inviter invite code; validated at submit time against an
    /// ACTIVE partner and locked as inviter_partner_id.
    pub invite_code: String,
    /// Optional business introduction (<= 2000 chars).
    pub business_intro: String,
}

impl SubmitJoinApplicationCommand {
    pub fn new(
        applicant_type: &str,
        subject_name: &str,
        contact_name: &str,
        contact_phone: &str,
        contact_email: &str,
        target_level_no: i32,
        invite_code: &str,
        business_intro: &str,
    ) -> Result<Self, CommerceServiceError> {
        let applicant_type = applicant_type.trim().to_string();
        if applicant_type != "INDIVIDUAL" && applicant_type != "ORGANIZATION" {
            return Err(CommerceServiceError::validation(format!(
                "unknown applicant_type '{applicant_type}' (expected 'INDIVIDUAL' or 'ORGANIZATION')"
            )));
        }
        let subject_name = subject_name.trim().to_string();
        if applicant_type == "ORGANIZATION" && subject_name.is_empty() {
            return Err(CommerceServiceError::validation(
                "subject_name is required for organization applicants",
            ));
        }
        if subject_name.chars().count() > 256 {
            return Err(CommerceServiceError::validation(
                "subject_name must not exceed 256 characters",
            ));
        }
        let contact_name = require_non_empty("contact_name", contact_name)?;
        let contact_phone = require_non_empty("contact_phone", contact_phone)?;
        let contact_email = require_non_empty("contact_email", contact_email)?;
        if contact_phone.chars().count() > 32 {
            return Err(CommerceServiceError::validation(
                "contact_phone must not exceed 32 characters",
            ));
        }
        if contact_email.chars().count() > 256 {
            return Err(CommerceServiceError::validation(
                "contact_email must not exceed 256 characters",
            ));
        }
        if target_level_no < 1 {
            return Err(CommerceServiceError::validation(
                "target_level_no must be a positive integer",
            ));
        }
        let business_intro = business_intro.trim().to_string();
        if business_intro.chars().count() > 2000 {
            return Err(CommerceServiceError::validation(
                "business_intro must not exceed 2000 characters",
            ));
        }
        Ok(Self {
            applicant_type,
            subject_name,
            contact_name,
            contact_phone,
            contact_email,
            target_level_no,
            invite_code: invite_code.trim().to_string(),
            business_intro,
        })
    }
}

/// Cancel an own SUBMITTED application.
#[derive(Clone, Debug)]
pub struct CancelJoinApplicationCommand {
    pub application_id: i64,
}

impl CancelJoinApplicationCommand {
    pub fn new(application_id: i64) -> Result<Self, CommerceServiceError> {
        if application_id <= 0 {
            return Err(CommerceServiceError::validation(
                "application_id must be a positive integer",
            ));
        }
        Ok(Self { application_id })
    }
}

/// Approve a join application: creates the partner record (PENDING) in the
/// same transaction and closes the loop with `approved_partner_id`.
#[derive(Clone, Debug)]
pub struct ApproveJoinApplicationCommand {
    pub application_id: i64,
    /// Partner level number assigned on approval (must reference an ACTIVE
    /// level).
    pub level_no: i32,
    /// Optional approval note.
    pub remark: String,
}

impl ApproveJoinApplicationCommand {
    pub fn new(
        application_id: i64,
        level_no: i32,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        if application_id <= 0 {
            return Err(CommerceServiceError::validation(
                "application_id must be a positive integer",
            ));
        }
        if level_no < 1 {
            return Err(CommerceServiceError::validation(
                "level_no must be a positive integer",
            ));
        }
        Ok(Self {
            application_id,
            level_no,
            remark: remark.trim().to_string(),
        })
    }
}

/// Reject a join application (reason is required).
#[derive(Clone, Debug)]
pub struct RejectJoinApplicationCommand {
    pub application_id: i64,
    /// Rejection reason (required, <= 1024 chars).
    pub reason: String,
}

impl RejectJoinApplicationCommand {
    pub fn new(application_id: i64, reason: &str) -> Result<Self, CommerceServiceError> {
        if application_id <= 0 {
            return Err(CommerceServiceError::validation(
                "application_id must be a positive integer",
            ));
        }
        let reason = require_non_empty("reason", reason)?;
        if reason.chars().count() > 1024 {
            return Err(CommerceServiceError::validation(
                "reason must not exceed 1024 characters",
            ));
        }
        Ok(Self {
            application_id,
            reason,
        })
    }
}

/// Page the applicant's own applications (newest first).
#[derive(Clone, Debug)]
pub struct ListMyJoinApplicationsQuery {
    pub list: PartnerAdminListQuery,
}

impl ListMyJoinApplicationsQuery {
    pub fn new(list: PartnerAdminListQuery) -> Self {
        Self { list }
    }
}

/// Page join applications for the admin review queue.
#[derive(Clone, Debug)]
pub struct ListJoinApplicationsQuery {
    pub list: PartnerAdminListQuery,
    /// Application status filter (SUBMITTED/APPROVED/REJECTED/CANCELLED).
    pub status: Option<String>,
    /// Applicant entity type filter (INDIVIDUAL/ORGANIZATION).
    pub applicant_type: Option<String>,
    /// Keyword over contact_name/contact_phone/contact_email/subject_name.
    pub keyword: Option<String>,
}

impl ListJoinApplicationsQuery {
    pub fn new(
        list: PartnerAdminListQuery,
        status: Option<String>,
        applicant_type: Option<String>,
        keyword: Option<String>,
    ) -> Self {
        Self {
            list,
            status,
            applicant_type,
            keyword,
        }
    }
}

/// Repository contract for the partner join (伙伴计划) app surface.
pub trait PartnerJoinRepositoryPort: Send + Sync {
    /// Creates the application row; validates the optional invite code against
    /// an ACTIVE partner and enforces one active SUBMITTED application per
    /// applicant (conflict otherwise). Single transaction.
    fn submit_application<'a>(
        &'a self,
        command: SubmitJoinApplicationCommand,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerJoinApplicationItem>;

    /// Pages the applicant's own applications, newest first.
    fn list_my_applications<'a>(
        &'a self,
        query: ListMyJoinApplicationsQuery,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerAdminListPage<PartnerJoinApplicationItem>>;

    /// Cancels an own application that is still SUBMITTED (single transaction,
    /// audit log).
    fn cancel_application<'a>(
        &'a self,
        command: CancelJoinApplicationCommand,
        subject: &'a PartnerJoinSubject,
    ) -> PartnerJoinFuture<'a, PartnerJoinApplicationItem>;

    /// Validates an invite code against an ACTIVE partner; returns
    /// `valid=false` with empty fields when not found (never a 404).
    fn validate_invite_code<'a>(
        &'a self,
        tenant_id: i64,
        organization_id: i64,
        code: &'a str,
    ) -> PartnerJoinFuture<'a, InviteCodeValidation>;
}

/// App-surface service facade over the join repository port.
pub struct PartnerJoinService {
    repository: Arc<dyn PartnerJoinRepositoryPort + Send + Sync>,
    /// Admin repository for the public program catalog reads (active levels
    /// and commission rules); the same PostgreSQL instance backs both ports.
    admin_repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync>,
}

impl PartnerJoinService {
    pub fn new(
        repository: Arc<dyn PartnerJoinRepositoryPort + Send + Sync>,
        admin_repository: Arc<dyn PartnerAdminRepositoryPort + Send + Sync>,
    ) -> Self {
        Self {
            repository,
            admin_repository,
        }
    }

    /// Public partner join program: active level catalog plus commission rules.
    pub async fn retrieve_program(
        &self,
        tenant_id: i64,
        organization_id: i64,
    ) -> Result<PartnerJoinProgramItem, CommerceServiceError> {
        let subject = PartnerAdminSubject::new(tenant_id, organization_id, 0)
            .map_err(|error| CommerceServiceError::validation(error))?;
        let levels = self
            .admin_repository
            .list_levels(ListPartnerLevelsQuery::new(false), &subject)
            .await?;
        let config = self
            .admin_repository
            .retrieve_commission_config(&subject)
            .await?;
        let level_items: Vec<PartnerJoinLevelItem> = levels
            .into_iter()
            .map(|level| PartnerJoinLevelItem {
                level_no: level.level_no,
                name: level.name,
                join_fee: level.join_fee,
                customer_revenue_ratio: level.customer_revenue_ratio,
                join_fee_commission_ratio: level.join_fee_commission_ratio,
                status: level.status,
                benefits: level.benefits,
            })
            .collect();
        // The level catalog is ordered by sort_order ascending; the first
        // entry carries the lowest join fee, which anchors the policy copy.
        let min_join_fee = level_items
            .first()
            .map(|level| level.join_fee.clone())
            .unwrap_or_else(|| "0.00".to_string());
        let rules = PartnerJoinRulesItem {
            currency: config.currency,
            profit_margin_ratio: config.profit_margin_ratio,
            min_withdrawal_amount: config.min_withdrawal_amount,
            join_fee_policy: format!(
                "加入伙伴计划需按所选等级缴纳加盟费，最低 {min_join_fee}；加盟费缴清后伙伴正式激活。"
            ),
        };
        Ok(PartnerJoinProgramItem {
            levels: level_items,
            rules,
        })
    }

    pub async fn submit_application(
        &self,
        command: SubmitJoinApplicationCommand,
        subject: &PartnerJoinSubject,
    ) -> Result<PartnerJoinApplicationItem, CommerceServiceError> {
        self.repository.submit_application(command, subject).await
    }

    pub async fn list_my_applications(
        &self,
        query: ListMyJoinApplicationsQuery,
        subject: &PartnerJoinSubject,
    ) -> Result<PartnerAdminListPage<PartnerJoinApplicationItem>, CommerceServiceError> {
        self.repository.list_my_applications(query, subject).await
    }

    pub async fn cancel_application(
        &self,
        command: CancelJoinApplicationCommand,
        subject: &PartnerJoinSubject,
    ) -> Result<PartnerJoinApplicationItem, CommerceServiceError> {
        self.repository.cancel_application(command, subject).await
    }

    pub async fn validate_invite_code(
        &self,
        tenant_id: i64,
        organization_id: i64,
        code: &str,
    ) -> Result<InviteCodeValidation, CommerceServiceError> {
        self.repository
            .validate_invite_code(tenant_id, organization_id, code)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn submit_command_validates_applicant_type() {
        let error = SubmitJoinApplicationCommand::new(
            "COMPANY",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            1,
            "",
            "",
        )
        .unwrap_err();
        assert_eq!(error.code(), "validation");
    }

    #[test]
    fn submit_command_requires_subject_name_for_organizations() {
        assert!(SubmitJoinApplicationCommand::new(
            "ORGANIZATION",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            1,
            "",
            "",
        )
        .is_err());
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            1,
            "",
            "",
        )
        .is_ok());
    }

    #[test]
    fn submit_command_requires_contact_fields_and_valid_level() {
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "",
            "13800000000",
            "a@b.com",
            1,
            "",
            "",
        )
        .is_err());
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "",
            "a@b.com",
            1,
            "",
            "",
        )
        .is_err());
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "13800000000",
            "",
            1,
            "",
            "",
        )
        .is_err());
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            0,
            "",
            "",
        )
        .is_err());
    }

    #[test]
    fn submit_command_caps_business_intro_length() {
        let long_intro = "x".repeat(2001);
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            1,
            "",
            &long_intro,
        )
        .is_err());
        let ok_intro = "x".repeat(2000);
        assert!(SubmitJoinApplicationCommand::new(
            "INDIVIDUAL",
            "",
            "张三",
            "13800000000",
            "a@b.com",
            1,
            "",
            &ok_intro,
        )
        .is_ok());
    }

    #[test]
    fn approve_command_requires_positive_application_id_and_level() {
        assert!(ApproveJoinApplicationCommand::new(0, 1, "").is_err());
        assert!(ApproveJoinApplicationCommand::new(1, 0, "").is_err());
        assert!(ApproveJoinApplicationCommand::new(1, 2, "ok").is_ok());
    }

    #[test]
    fn reject_command_requires_reason() {
        assert!(RejectJoinApplicationCommand::new(1, "").is_err());
        assert!(RejectJoinApplicationCommand::new(1, "  ").is_err());
        assert!(RejectJoinApplicationCommand::new(0, "reason").is_err());
        assert!(RejectJoinApplicationCommand::new(1, "reason").is_ok());
    }

    #[test]
    fn public_scope_marks_zero_user() {
        let scope = PartnerJoinSubject::public_scope(0, 0);
        assert_eq!(scope.user_id, 0);
        assert!(PartnerJoinSubject::new(1, 2, 3).is_ok());
        assert!(PartnerJoinSubject::new(-1, 0, 0).is_err());
    }
}
