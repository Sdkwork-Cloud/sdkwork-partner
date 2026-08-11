//! Validated write commands for the partner admin surface.

use crate::validation::require_non_empty;
use sdkwork_contract_service::CommerceServiceError;

#[derive(Clone, Debug)]
pub struct UpdateCommissionConfigCommand {
    pub enabled: bool,
    pub usage_settlement_enabled: bool,
    pub recharge_enabled: bool,
    pub max_commission_depth: i64,
    pub currency: String,
    pub min_withdrawal_amount: i64,
}

impl UpdateCommissionConfigCommand {
    pub fn new(
        enabled: bool,
        usage_settlement_enabled: bool,
        recharge_enabled: bool,
        max_commission_depth: i64,
        currency: &str,
        min_withdrawal_amount: i64,
    ) -> Result<Self, CommerceServiceError> {
        let currency = require_non_empty("currency", currency)?;
        if max_commission_depth < 0 {
            return Err(CommerceServiceError::validation(
                "max_commission_depth must not be negative",
            ));
        }
        if min_withdrawal_amount < 0 {
            return Err(CommerceServiceError::validation(
                "min_withdrawal_amount must not be negative",
            ));
        }
        Ok(Self {
            enabled,
            usage_settlement_enabled,
            recharge_enabled,
            max_commission_depth,
            currency,
            min_withdrawal_amount,
        })
    }
}

#[derive(Clone, Debug)]
pub struct CreatePartnerLevelCommand {
    pub level_no: i32,
    pub name: String,
    pub customer_revenue_ratio_per_10000: i64,
    pub join_fee_commission_ratio_per_10000: i64,
    pub join_fee_cents: i64,
    pub sort_order: i32,
}

impl CreatePartnerLevelCommand {
    pub fn new(
        level_no: i32,
        name: &str,
        customer_revenue_ratio_per_10000: i64,
        join_fee_commission_ratio_per_10000: i64,
        join_fee_cents: i64,
        sort_order: i32,
    ) -> Result<Self, CommerceServiceError> {
        let name = require_non_empty("name", name)?;
        if level_no <= 0 {
            return Err(CommerceServiceError::validation(
                "level_no must be a positive integer",
            ));
        }
        if customer_revenue_ratio_per_10000 < 0 || join_fee_commission_ratio_per_10000 < 0 {
            return Err(CommerceServiceError::validation(
                "commission ratios must not be negative",
            ));
        }
        if join_fee_cents < 0 {
            return Err(CommerceServiceError::validation(
                "join_fee must not be negative",
            ));
        }
        Ok(Self {
            level_no,
            name,
            customer_revenue_ratio_per_10000,
            join_fee_commission_ratio_per_10000,
            join_fee_cents,
            sort_order,
        })
    }
}

#[derive(Clone, Debug)]
pub struct UpdatePartnerLevelCommand {
    pub level_id: i64,
    pub name: String,
    pub customer_revenue_ratio_per_10000: i64,
    pub join_fee_commission_ratio_per_10000: i64,
    pub join_fee_cents: i64,
    pub status: String,
    pub sort_order: i32,
}

impl UpdatePartnerLevelCommand {
    pub fn new(
        level_id: i64,
        name: &str,
        customer_revenue_ratio_per_10000: i64,
        join_fee_commission_ratio_per_10000: i64,
        join_fee_cents: i64,
        status: &str,
        sort_order: i32,
    ) -> Result<Self, CommerceServiceError> {
        let name = require_non_empty("name", name)?;
        let status = require_non_empty("status", status)?;
        if level_id <= 0 {
            return Err(CommerceServiceError::validation(
                "level_id must be a positive integer",
            ));
        }
        if customer_revenue_ratio_per_10000 < 0 || join_fee_commission_ratio_per_10000 < 0 {
            return Err(CommerceServiceError::validation(
                "commission ratios must not be negative",
            ));
        }
        if join_fee_cents < 0 {
            return Err(CommerceServiceError::validation(
                "join_fee must not be negative",
            ));
        }
        Ok(Self {
            level_id,
            name,
            customer_revenue_ratio_per_10000,
            join_fee_commission_ratio_per_10000,
            join_fee_cents,
            status,
            sort_order,
        })
    }
}

#[derive(Clone, Debug)]
pub struct DeletePartnerLevelCommand {
    pub level_id: i64,
}

impl DeletePartnerLevelCommand {
    pub fn new(level_id: i64) -> Result<Self, CommerceServiceError> {
        if level_id <= 0 {
            return Err(CommerceServiceError::validation(
                "level_id must be a positive integer",
            ));
        }
        Ok(Self { level_id })
    }
}

#[derive(Clone, Debug)]
pub struct CreatePartnerCommand {
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub email: String,
    pub level_no: i32,
    pub parent_partner_id: Option<i64>,
    /// None = the partner has no bound IAM user account yet; it can be bound
    /// later via `BindPartnerUserAccountCommand`.
    pub user_account_id: Option<i64>,
    pub remark: String,
}

impl CreatePartnerCommand {
    pub fn new(
        name: &str,
        contact_name: &str,
        phone: &str,
        email: &str,
        level_no: i32,
        parent_partner_id: Option<i64>,
        user_account_id: Option<i64>,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        let name = require_non_empty("name", name)?;
        if level_no <= 0 {
            return Err(CommerceServiceError::validation(
                "level_no must be a positive integer",
            ));
        }
        if let Some(user_account_id) = user_account_id {
            if user_account_id <= 0 {
                return Err(CommerceServiceError::validation(
                    "user_account_id must be a positive integer",
                ));
            }
        }
        Ok(Self {
            name,
            contact_name: contact_name.trim().to_string(),
            phone: phone.trim().to_string(),
            email: email.trim().to_string(),
            level_no,
            parent_partner_id,
            user_account_id,
            remark: remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct BindPartnerUserAccountCommand {
    pub partner_id: i64,
    pub user_account_id: i64,
}

impl BindPartnerUserAccountCommand {
    pub fn new(partner_id: i64, user_account_id: i64) -> Result<Self, CommerceServiceError> {
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        if user_account_id <= 0 {
            return Err(CommerceServiceError::validation(
                "user_account_id must be a positive integer",
            ));
        }
        Ok(Self {
            partner_id,
            user_account_id,
        })
    }
}

#[derive(Clone, Debug)]
pub struct UpdatePartnerCommand {
    pub partner_id: i64,
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub email: String,
    pub level_no: i32,
    pub status: String,
    pub remark: String,
}

impl UpdatePartnerCommand {
    pub fn new(
        partner_id: i64,
        name: &str,
        contact_name: &str,
        phone: &str,
        email: &str,
        level_no: i32,
        status: &str,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        let name = require_non_empty("name", name)?;
        let status = require_non_empty("status", status)?;
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        if level_no <= 0 {
            return Err(CommerceServiceError::validation(
                "level_no must be a positive integer",
            ));
        }
        Ok(Self {
            partner_id,
            name,
            contact_name: contact_name.trim().to_string(),
            phone: phone.trim().to_string(),
            email: email.trim().to_string(),
            level_no,
            status,
            remark: remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct CreateJoinFeePaymentCommand {
    pub partner_id: i64,
    pub amount_cents: i64,
    pub currency: String,
    pub payment_method: String,
    pub remark: String,
}

impl CreateJoinFeePaymentCommand {
    pub fn new(
        partner_id: i64,
        amount_cents: i64,
        currency: &str,
        payment_method: &str,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        let currency = require_non_empty("currency", currency)?;
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        if amount_cents <= 0 {
            return Err(CommerceServiceError::validation(
                "amount must be a positive amount",
            ));
        }
        Ok(Self {
            partner_id,
            amount_cents,
            currency,
            payment_method: payment_method.trim().to_string(),
            remark: remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct BindCustomerCommand {
    pub partner_id: i64,
    pub customer_user_id: i64,
    pub binding_type: String,
}

impl BindCustomerCommand {
    pub fn new(
        partner_id: i64,
        customer_user_id: i64,
        binding_type: &str,
    ) -> Result<Self, CommerceServiceError> {
        let binding_type = require_non_empty("binding_type", binding_type)?;
        if partner_id <= 0 || customer_user_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id and customer_user_id must be positive integers",
            ));
        }
        Ok(Self {
            partner_id,
            customer_user_id,
            binding_type,
        })
    }
}

#[derive(Clone, Debug)]
pub struct UnbindCustomerCommand {
    pub binding_id: i64,
}

impl UnbindCustomerCommand {
    pub fn new(binding_id: i64) -> Result<Self, CommerceServiceError> {
        if binding_id <= 0 {
            return Err(CommerceServiceError::validation(
                "binding_id must be a positive integer",
            ));
        }
        Ok(Self { binding_id })
    }
}

#[derive(Clone, Debug)]
pub struct CreateManualCommissionEventCommand {
    pub source_ref: String,
    pub customer_user_id: i64,
    pub base_amount_cents: i64,
    pub event_at: String,
    pub remark: String,
}

impl CreateManualCommissionEventCommand {
    pub fn new(
        source_ref: &str,
        customer_user_id: i64,
        base_amount_cents: i64,
        event_at: &str,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        let source_ref = require_non_empty("source_ref", source_ref)?;
        if customer_user_id <= 0 {
            return Err(CommerceServiceError::validation(
                "customer_user_id must be a positive integer",
            ));
        }
        if base_amount_cents <= 0 {
            return Err(CommerceServiceError::validation(
                "base_amount must be a positive amount",
            ));
        }
        Ok(Self {
            source_ref,
            customer_user_id,
            base_amount_cents,
            event_at: event_at.trim().to_string(),
            remark: remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct RunCommissionSettlementCommand {
    pub limit: i64,
}

impl RunCommissionSettlementCommand {
    pub fn new(limit: i64) -> Result<Self, CommerceServiceError> {
        if limit <= 0 {
            return Err(CommerceServiceError::validation(
                "limit must be a positive integer",
            ));
        }
        Ok(Self { limit })
    }
}

#[derive(Clone, Debug)]
pub struct CreateLedgerAdjustmentCommand {
    pub partner_id: i64,
    pub amount_cents: i64,
    pub remark: String,
}

impl CreateLedgerAdjustmentCommand {
    pub fn new(
        partner_id: i64,
        amount_cents: i64,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        let remark = require_non_empty("remark", remark)?;
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        if amount_cents == 0 {
            return Err(CommerceServiceError::validation("amount must not be zero"));
        }
        Ok(Self {
            partner_id,
            amount_cents,
            remark,
        })
    }
}

#[derive(Clone, Debug)]
pub struct CreateWithdrawalCommand {
    pub partner_id: i64,
    pub amount_cents: i64,
    pub remark: String,
}

impl CreateWithdrawalCommand {
    pub fn new(
        partner_id: i64,
        amount_cents: i64,
        remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        if partner_id <= 0 {
            return Err(CommerceServiceError::validation(
                "partner_id must be a positive integer",
            ));
        }
        if amount_cents <= 0 {
            return Err(CommerceServiceError::validation(
                "amount must be a positive amount",
            ));
        }
        Ok(Self {
            partner_id,
            amount_cents,
            remark: remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct ReviewWithdrawalCommand {
    pub withdrawal_id: i64,
    pub approve: bool,
    pub review_remark: String,
}

impl ReviewWithdrawalCommand {
    pub fn new(
        withdrawal_id: i64,
        approve: bool,
        review_remark: &str,
    ) -> Result<Self, CommerceServiceError> {
        if withdrawal_id <= 0 {
            return Err(CommerceServiceError::validation(
                "withdrawal_id must be a positive integer",
            ));
        }
        Ok(Self {
            withdrawal_id,
            approve,
            review_remark: review_remark.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug)]
pub struct PayWithdrawalCommand {
    pub withdrawal_id: i64,
    pub remark: String,
}

impl PayWithdrawalCommand {
    pub fn new(withdrawal_id: i64, remark: &str) -> Result<Self, CommerceServiceError> {
        if withdrawal_id <= 0 {
            return Err(CommerceServiceError::validation(
                "withdrawal_id must be a positive integer",
            ));
        }
        Ok(Self {
            withdrawal_id,
            remark: remark.trim().to_string(),
        })
    }
}
