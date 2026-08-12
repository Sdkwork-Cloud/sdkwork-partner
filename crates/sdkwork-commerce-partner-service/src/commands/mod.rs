//! Validated write commands for the partner admin surface.

use crate::validation::require_non_empty;
use sdkwork_contract_service::CommerceServiceError;
use serde::Deserialize as _;

/// One structured benefit (权益) entry granted by a partner level.
///
/// Benefits are stored as a JSONB array on `partner_level` so operators can
/// plan and maintain the entitlement ladder of every level from the admin UI
/// without schema changes.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelBenefitItem {
    /// Stable machine-readable benefit key (e.g. `account_manager`).
    pub code: String,
    /// Display name of the benefit (e.g. 专属客户经理).
    pub name: String,
    /// Display value of the benefit (e.g. 月 10 条商机线索). `None` when the
    /// operator did not provide one (or the JSONB holds `null`); normalized
    /// to `None` from blank strings. Omitted from serialized output so the
    /// API never emits a bare `null`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    /// Display sort order within the level's benefit list. Missing or `null`
    /// JSONB entries deserialize as 0 so one malformed field cannot wipe the
    /// whole ladder.
    #[serde(default, deserialize_with = "deserialize_sort_or_zero")]
    pub sort: i32,
}

/// Deserialize `sort` tolerantly: missing fields (serde `default`) and
/// explicit `null` both become 0 instead of failing the whole benefit list.
fn deserialize_sort_or_zero<'de, D>(deserializer: D) -> Result<i32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<i32>::deserialize(deserializer).map(|value| value.unwrap_or(0))
}

impl LevelBenefitItem {
    pub fn new(
        code: &str,
        name: &str,
        value: Option<&str>,
        sort: i32,
    ) -> Result<Self, CommerceServiceError> {
        let code = require_non_empty("benefit.code", code)?;
        let name = require_non_empty("benefit.name", name)?;
        if sort < 0 {
            return Err(CommerceServiceError::validation(
                "benefit.sort must not be negative",
            ));
        }
        Ok(Self {
            code,
            name,
            value: value
                .map(str::trim)
                .filter(|trimmed| !trimmed.is_empty())
                .map(str::to_string),
            sort,
        })
    }
}

/// Validate a level's benefit list; returns the normalized list.
fn validate_benefits(
    benefits: &[LevelBenefitItem],
) -> Result<Vec<LevelBenefitItem>, CommerceServiceError> {
    let mut normalized = Vec::with_capacity(benefits.len());
    for benefit in benefits {
        normalized.push(LevelBenefitItem::new(
            &benefit.code,
            &benefit.name,
            benefit.value.as_deref(),
            benefit.sort,
        )?);
    }
    Ok(normalized)
}

#[derive(Clone, Debug)]
pub struct UpdateCommissionConfigCommand {
    pub enabled: bool,
    pub usage_settlement_enabled: bool,
    pub recharge_enabled: bool,
    pub max_commission_depth: i64,
    pub currency: String,
    pub min_withdrawal_amount: i64,
    /// Platform gross profit margin, per-10000 (40.00% -> 4000).
    pub profit_margin_per_10000: i64,
}

impl UpdateCommissionConfigCommand {
    pub fn new(
        enabled: bool,
        usage_settlement_enabled: bool,
        recharge_enabled: bool,
        max_commission_depth: i64,
        currency: &str,
        min_withdrawal_amount: i64,
        profit_margin_per_10000: i64,
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
        if !(0..=10_000).contains(&profit_margin_per_10000) {
            return Err(CommerceServiceError::validation(
                "profit_margin_ratio must be within 0% and 100%",
            ));
        }
        Ok(Self {
            enabled,
            usage_settlement_enabled,
            recharge_enabled,
            max_commission_depth,
            currency,
            min_withdrawal_amount,
            profit_margin_per_10000,
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
    pub benefits: Vec<LevelBenefitItem>,
}

impl CreatePartnerLevelCommand {
    pub fn new(
        level_no: i32,
        name: &str,
        customer_revenue_ratio_per_10000: i64,
        join_fee_commission_ratio_per_10000: i64,
        join_fee_cents: i64,
        sort_order: i32,
        benefits: Vec<LevelBenefitItem>,
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
        let benefits = validate_benefits(&benefits)?;
        Ok(Self {
            level_no,
            name,
            customer_revenue_ratio_per_10000,
            join_fee_commission_ratio_per_10000,
            join_fee_cents,
            sort_order,
            benefits,
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
    pub benefits: Vec<LevelBenefitItem>,
}

impl UpdatePartnerLevelCommand {
    // Domain command constructor: parameters mirror the command fields
    // (clippy::too_many_arguments is the accepted pattern for command builders).
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        level_id: i64,
        name: &str,
        customer_revenue_ratio_per_10000: i64,
        join_fee_commission_ratio_per_10000: i64,
        join_fee_cents: i64,
        status: &str,
        sort_order: i32,
        benefits: Vec<LevelBenefitItem>,
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
        let benefits = validate_benefits(&benefits)?;
        Ok(Self {
            level_id,
            name,
            customer_revenue_ratio_per_10000,
            join_fee_commission_ratio_per_10000,
            join_fee_cents,
            status,
            sort_order,
            benefits,
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
    // Domain command constructor: parameters mirror the command fields
    // (clippy::too_many_arguments is the accepted pattern for command builders).
    #[allow(clippy::too_many_arguments)]
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
    /// `None` = top-level partner (clears the current parent).
    pub parent_partner_id: Option<i64>,
    /// `None` = no bound IAM user account (clears the current binding).
    pub user_account_id: Option<i64>,
    pub status: String,
    pub remark: String,
}

impl UpdatePartnerCommand {
    // Domain command constructor: parameters mirror the command fields
    // (clippy::too_many_arguments is the accepted pattern for command builders).
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        partner_id: i64,
        name: &str,
        contact_name: &str,
        phone: &str,
        email: &str,
        level_no: i32,
        parent_partner_id: Option<i64>,
        user_account_id: Option<i64>,
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
        if let Some(parent_partner_id) = parent_partner_id {
            if parent_partner_id <= 0 {
                return Err(CommerceServiceError::validation(
                    "parent_partner_id must be a positive integer",
                ));
            }
        }
        if let Some(user_account_id) = user_account_id {
            if user_account_id <= 0 {
                return Err(CommerceServiceError::validation(
                    "user_account_id must be a positive integer",
                ));
            }
        }
        Ok(Self {
            partner_id,
            name,
            contact_name: contact_name.trim().to_string(),
            phone: phone.trim().to_string(),
            email: email.trim().to_string(),
            level_no,
            parent_partner_id,
            user_account_id,
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
    /// Client-generated idempotency key: repeated submissions with the same
    /// key replay the original payment instead of creating a duplicate
    /// payment and duplicate ancestor commission.
    pub idempotency_key: Option<String>,
}

impl CreateJoinFeePaymentCommand {
    pub fn new(
        partner_id: i64,
        amount_cents: i64,
        currency: &str,
        payment_method: &str,
        remark: &str,
        idempotency_key: Option<&str>,
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
        let idempotency_key = idempotency_key.map(str::trim).filter(|k| !k.is_empty());
        if let Some(key) = idempotency_key {
            if key.len() > 128 {
                return Err(CommerceServiceError::validation(
                    "idempotency_key must not exceed 128 characters",
                ));
            }
        }
        Ok(Self {
            partner_id,
            amount_cents,
            currency,
            payment_method: payment_method.trim().to_string(),
            remark: remark.trim().to_string(),
            idempotency_key: idempotency_key.map(str::to_string),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_partner_command_accepts_optional_relations() {
        let command = UpdatePartnerCommand::new(
            1,
            "partner-a",
            "",
            "",
            "",
            1,
            Some(10),
            Some(20),
            "ACTIVE",
            "",
        )
        .expect("valid update command");
        assert_eq!(command.partner_id, 1);
        assert_eq!(command.parent_partner_id, Some(10));
        assert_eq!(command.user_account_id, Some(20));
    }

    #[test]
    fn update_partner_command_accepts_null_relations() {
        let command =
            UpdatePartnerCommand::new(1, "partner-a", "", "", "", 1, None, None, "ACTIVE", "")
                .expect("valid update command");
        assert_eq!(command.parent_partner_id, None);
        assert_eq!(command.user_account_id, None);
    }

    #[test]
    fn update_partner_command_rejects_invalid_relations() {
        assert!(
            UpdatePartnerCommand::new(1, "a", "", "", "", 1, Some(0), None, "ACTIVE", "").is_err()
        );
        assert!(
            UpdatePartnerCommand::new(1, "a", "", "", "", 1, Some(-5), None, "ACTIVE", "").is_err()
        );
        assert!(
            UpdatePartnerCommand::new(1, "a", "", "", "", 1, None, Some(0), "ACTIVE", "").is_err()
        );
        assert!(
            UpdatePartnerCommand::new(1, "a", "", "", "", 1, None, Some(-5), "ACTIVE", "").is_err()
        );
    }

    #[test]
    fn update_partner_command_rejects_blank_name_and_bad_ids() {
        assert!(
            UpdatePartnerCommand::new(0, "a", "", "", "", 1, None, None, "ACTIVE", "").is_err()
        );
        assert!(UpdatePartnerCommand::new(1, "", "", "", "", 1, None, None, "ACTIVE", "").is_err());
        assert!(
            UpdatePartnerCommand::new(1, "a", "", "", "", 0, None, None, "ACTIVE", "").is_err()
        );
        assert!(UpdatePartnerCommand::new(1, "a", "", "", "", 1, None, None, "", "").is_err());
    }

    #[test]
    fn level_commands_accept_benefit_list() {
        let benefits = vec![
            LevelBenefitItem::new("commission_rate", "返佣比例", Some("30%"), 1).unwrap(),
            LevelBenefitItem::new("account_manager", "专属客户经理", Some(""), 2).unwrap(),
        ];
        let create = CreatePartnerLevelCommand::new(
            5,
            "城市合伙人",
            3000,
            2000,
            20_000_000,
            5,
            benefits.clone(),
        )
        .expect("valid create command");
        assert_eq!(create.benefits.len(), 2);
        assert_eq!(create.benefits[0].code, "commission_rate");
        let update = UpdatePartnerLevelCommand::new(
            1,
            "城市合伙人",
            3000,
            2000,
            20_000_000,
            "ACTIVE",
            5,
            benefits,
        )
        .expect("valid update command");
        // Blank values are normalized to None.
        assert_eq!(update.benefits[1].value, None);
        assert_eq!(update.benefits[0].value.as_deref(), Some("30%"));
    }

    #[test]
    fn benefit_item_normalizes_null_and_blank_values() {
        assert_eq!(
            LevelBenefitItem::new("code", "名称", None, 1)
                .unwrap()
                .value,
            None
        );
        assert_eq!(
            LevelBenefitItem::new("code", "名称", Some("  "), 1)
                .unwrap()
                .value,
            None
        );
        let parsed: LevelBenefitItem =
            serde_json::from_str(r#"{"code":"c","name":"n","value":null}"#).unwrap();
        assert_eq!(parsed.value, None);
        assert_eq!(parsed.sort, 0);
        // Explicit JSONB nulls in sort and value must not wipe the entry.
        let parsed: LevelBenefitItem =
            serde_json::from_str(r#"{"code":"c","name":"n","value":null,"sort":null}"#).unwrap();
        assert_eq!(parsed.value, None);
        assert_eq!(parsed.sort, 0);
        let parsed: LevelBenefitItem =
            serde_json::from_str(r#"{"code":"c","name":"n","sort":7}"#).unwrap();
        assert_eq!(parsed.sort, 7);
        // Serialized output omits a missing value instead of emitting null.
        let item = LevelBenefitItem::new("code", "名称", None, 1).unwrap();
        assert_eq!(
            serde_json::to_string(&item).unwrap(),
            r#"{"code":"code","name":"名称","sort":1}"#
        );
    }

    #[test]
    fn level_commands_reject_invalid_benefits() {
        // LevelBenefitItem::new() already rejects invalid entries, so build
        // raw structs to exercise the command-level validation path.
        let bad_code = vec![LevelBenefitItem {
            code: String::new(),
            name: "名称".to_string(),
            value: Some("值".to_string()),
            sort: 1,
        }];
        assert!(CreatePartnerLevelCommand::new(1, "a", 1000, 800, 0, 1, bad_code).is_err());
        let bad_name = vec![LevelBenefitItem {
            code: "code".to_string(),
            name: "  ".to_string(),
            value: Some("值".to_string()),
            sort: 1,
        }];
        assert!(
            UpdatePartnerLevelCommand::new(1, "a", 1000, 800, 0, "ACTIVE", 1, bad_name).is_err()
        );
        let bad_sort = vec![LevelBenefitItem {
            code: "code".to_string(),
            name: "名称".to_string(),
            value: Some("值".to_string()),
            sort: -1,
        }];
        assert!(CreatePartnerLevelCommand::new(1, "a", 1000, 800, 0, 1, bad_sort).is_err());
        assert!(CreatePartnerLevelCommand::new(1, "a", 1000, 800, 0, 1, vec![]).is_ok());
    }
}
