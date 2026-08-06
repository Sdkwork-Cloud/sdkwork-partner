//! Row -> item mapping helpers for the partner admin repository.

use sdkwork_commerce_partner_service::backend_admin::*;
use sqlx::Row;

pub fn map_partner(row: &sqlx::postgres::PgRow) -> PartnerItem {
    PartnerItem {
        id: row.get("id"),
        uuid: row.get("uuid"),
        name: row.get("name"),
        contact_name: row.get("contact_name"),
        phone: row.get("phone"),
        email: row.get("email"),
        level_no: row.get("level_no"),
        parent_partner_id: row.get("parent_partner_id"),
        user_account_id: row.get("user_account_id"),
        status: row.get("status"),
        join_fee_amount: row.get("join_fee_amount"),
        join_fee_status: row.get("join_fee_status"),
        joined_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("joined_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        owner_id: row.get("owner_id"),
        remark: row.get("remark"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
        updated_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("updated_at")
            .to_rfc3339(),
    }
}

pub fn map_partner_level(row: &sqlx::postgres::PgRow) -> PartnerLevelItem {
    PartnerLevelItem {
        id: row.get("id"),
        level_no: row.get("level_no"),
        name: row.get("name"),
        customer_revenue_ratio: row.get("customer_revenue_ratio"),
        join_fee_commission_ratio: row.get("join_fee_commission_ratio"),
        join_fee: row.get("join_fee"),
        status: row.get("status"),
        sort_order: row.get("sort_order"),
    }
}

pub fn map_join_fee_payment(row: &sqlx::postgres::PgRow) -> JoinFeePaymentItem {
    JoinFeePaymentItem {
        id: row.get("id"),
        partner_id: row.get("partner_id"),
        amount: row.get("amount"),
        currency: row.get("currency"),
        status: row.get("status"),
        payment_method: row.get("payment_method"),
        paid_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("paid_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        paid_by: row.get("paid_by"),
        remark: row.get("remark"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
    }
}

pub fn map_customer_binding(row: &sqlx::postgres::PgRow) -> CustomerBindingItem {
    CustomerBindingItem {
        id: row.get("id"),
        partner_id: row.get("partner_id"),
        customer_user_id: row.get("customer_user_id"),
        binding_type: row.get("binding_type"),
        status: row.get("status"),
        bound_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("bound_at")
            .to_rfc3339(),
        bound_by: row.get("bound_by"),
        unbound_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("unbound_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        unbound_by: row.get("unbound_by"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
    }
}

pub fn map_commission_event(row: &sqlx::postgres::PgRow) -> CommissionEventItem {
    CommissionEventItem {
        id: row.get("id"),
        source_type: row.get("source_type"),
        source_ref: row.get("source_ref"),
        customer_user_id: row.get("customer_user_id"),
        base_amount: row.get("base_amount"),
        event_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("event_at")
            .to_rfc3339(),
        status: row.get("status"),
        settled_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("settled_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        remark: row.get("remark"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
    }
}

pub fn map_settlement(
    row: &sqlx::postgres::PgRow,
    distributions: &[sqlx::postgres::PgRow],
) -> SettlementItem {
    SettlementItem {
        id: row.get("id"),
        event_id: row.get("event_id"),
        base_amount: row.get("base_amount"),
        distributed_amount: row.get("distributed_amount"),
        receiver_count: row.get("receiver_count"),
        status: row.get("status"),
        computed_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("computed_at")
            .to_rfc3339(),
        remark: row.get("remark"),
        distributions: distributions.iter().map(map_distribution).collect(),
    }
}

pub fn map_distribution(row: &sqlx::postgres::PgRow) -> DistributionItem {
    DistributionItem {
        id: row.get("id"),
        settlement_id: row.get("settlement_id"),
        receiver_partner_id: row.get("receiver_partner_id"),
        level_offset: row.get("level_offset"),
        ratio: row.get("ratio"),
        base_amount: row.get("base_amount"),
        amount: row.get("amount"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
    }
}

pub fn map_ledger_entry(row: &sqlx::postgres::PgRow) -> LedgerEntryItem {
    LedgerEntryItem {
        id: row.get("id"),
        partner_id: row.get("partner_id"),
        entry_type: row.get("entry_type"),
        direction: row.get("direction"),
        amount: row.get("amount"),
        balance_after: row.get("balance_after"),
        ref_type: row.get("ref_type"),
        ref_id: row.get("ref_id"),
        operator_id: row.get("operator_id"),
        remark: row.get("remark"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
    }
}

pub fn map_withdrawal(row: &sqlx::postgres::PgRow) -> WithdrawalItem {
    WithdrawalItem {
        id: row.get("id"),
        partner_id: row.get("partner_id"),
        amount: row.get("amount"),
        status: row.get("status"),
        reviewed_by: row.get("reviewed_by"),
        reviewed_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("reviewed_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        review_remark: row.get("review_remark"),
        paid_at: row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("paid_at")
            .unwrap_or(None)
            .map(|value| value.to_rfc3339()),
        paid_by: row.get("paid_by"),
        remark: row.get("remark"),
        created_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339(),
        updated_at: row
            .get::<chrono::DateTime<chrono::Utc>, _>("updated_at")
            .to_rfc3339(),
    }
}

pub fn map_stat_snapshot(row: &sqlx::postgres::PgRow) -> StatSnapshotItem {
    StatSnapshotItem {
        id: row.get("id"),
        partner_id: row.get("partner_id"),
        period_start: row
            .get::<chrono::DateTime<chrono::Utc>, _>("period_start")
            .to_rfc3339(),
        period_end: row
            .get::<chrono::DateTime<chrono::Utc>, _>("period_end")
            .to_rfc3339(),
        period_type: row.get("period_type"),
        join_fee_total: row.get("join_fee_total"),
        customer_count: row.get("customer_count"),
        revenue_base: row.get("revenue_base"),
        commission_earned: row.get("commission_earned"),
        downstream_partner_count: row.get("downstream_partner_count"),
    }
}
