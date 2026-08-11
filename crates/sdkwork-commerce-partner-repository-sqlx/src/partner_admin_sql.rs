//! Hand-written SQL constants for the partner admin repository.
//!
//! Scoping convention: `$1 = tenant_id`, `$2 = organization_id` everywhere.
//! Money columns are read via `::text` casts and written via `::numeric`
//! parameter casts so the repository never depends on BigDecimal types.

/// Select a partner row (single by id).
pub const SELECT_PARTNER_BY_ID: &str = r#"
SELECT p.id, p.uuid, p.name, p.contact_name, p.phone, p.email, p.level_no,
       p.parent_partner_id, p.user_account_id, p.status, p.join_fee_amount::text,
       p.join_fee_status, p.joined_at, p.owner_id, p.remark, p.created_at, p.updated_at
FROM partner_partner p
WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.id = $3 AND p.deleted_at IS NULL
"#;

/// Insert a partner row.
pub const INSERT_PARTNER: &str = r#"
INSERT INTO partner_partner
    (id, uuid, tenant_id, organization_id, name, contact_name, phone, email,
     level_no, parent_partner_id, user_account_id, status, join_fee_amount,
     join_fee_status, joined_at, owner_id, remark)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14, $15, $16, $17)
"#;

/// Count partners (list query with filters).
pub const COUNT_PARTNERS: &str = r#"
SELECT COUNT(*) FROM partner_partner p
WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL
  AND ($3::text IS NULL OR p.status = $3)
  AND ($4::integer IS NULL OR p.level_no = $4)
  AND ($5::text IS NULL OR p.name ILIKE '%' || $5 || '%' OR p.contact_name ILIKE '%' || $5 || '%' OR p.phone ILIKE '%' || $5 || '%' OR p.id::text = $5)
  AND ($6::timestamptz IS NULL OR p.created_at >= $6::timestamptz)
  AND ($7::timestamptz IS NULL OR p.created_at < $7::timestamptz)
  AND ($8::text IS NULL OR p.join_fee_status = $8)
"#;

/// List partners (list query with filters, ordered).
pub const LIST_PARTNERS: &str = r#"
SELECT p.id, p.uuid, p.name, p.contact_name, p.phone, p.email, p.level_no,
       p.parent_partner_id, p.user_account_id, p.status, p.join_fee_amount::text,
       p.join_fee_status, p.joined_at, p.owner_id, p.remark, p.created_at, p.updated_at
FROM partner_partner p
WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL
  AND ($3::text IS NULL OR p.status = $3)
  AND ($4::integer IS NULL OR p.level_no = $4)
  AND ($5::text IS NULL OR p.name ILIKE '%' || $5 || '%' OR p.contact_name ILIKE '%' || $5 || '%' OR p.phone ILIKE '%' || $5 || '%' OR p.id::text = $5)
  AND ($6::timestamptz IS NULL OR p.created_at >= $6::timestamptz)
  AND ($7::timestamptz IS NULL OR p.created_at < $7::timestamptz)
  AND ($8::text IS NULL OR p.join_fee_status = $8)
ORDER BY p.created_at DESC, p.id DESC
LIMIT $9 OFFSET $10
"#;

/// Recursive ancestor chain (self first, then parents upward) with level
/// commission ratios resolved from the level table.
pub const SELECT_ANCESTOR_CHAIN: &str = r#"
WITH RECURSIVE ancestors AS (
    SELECT p.id, p.parent_partner_id, p.level_no, p.status, 0 AS depth
    FROM partner_partner p
    WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.id = $3 AND p.deleted_at IS NULL
    UNION ALL
    SELECT p.id, p.parent_partner_id, p.level_no, p.status, a.depth + 1
    FROM partner_partner p
    JOIN ancestors a ON p.id = a.parent_partner_id
    WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL
)
SELECT a.id, a.level_no, a.status, a.depth,
       COALESCE(l.customer_revenue_ratio, 0)::text AS customer_ratio,
       COALESCE(l.join_fee_commission_ratio, 0)::text AS join_fee_ratio
FROM ancestors a
LEFT JOIN partner_level l
  ON l.tenant_id = $1 AND l.organization_id = $2 AND l.level_no = a.level_no AND l.deleted_at IS NULL
ORDER BY a.depth
"#;

/// Count descendants of a partner (whole subtree).
pub const COUNT_DESCENDANTS: &str = r#"
WITH RECURSIVE descendants AS (
    SELECT p.id, p.parent_partner_id
    FROM partner_partner p
    WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.id = $3 AND p.deleted_at IS NULL
    UNION ALL
    SELECT p.id, p.parent_partner_id
    FROM partner_partner p
    JOIN descendants d ON p.parent_partner_id = d.id
    WHERE p.tenant_id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL
)
SELECT COUNT(*) - 1 FROM descendants
"#;

/// Active customer binding for a customer user.
pub const SELECT_ACTIVE_BINDING_FOR_CUSTOMER: &str = r#"
SELECT id, partner_id, customer_user_id, binding_type, status,
       bound_at, bound_by, unbound_at, unbound_by, created_at
FROM partner_customer_binding
WHERE tenant_id = $1 AND organization_id = $2 AND customer_user_id = $3 AND status = 'ACTIVE'
"#;

/// Insert a customer binding.
pub const INSERT_CUSTOMER_BINDING: &str = r#"
INSERT INTO partner_customer_binding
    (id, uuid, tenant_id, organization_id, partner_id, customer_user_id,
     binding_type, status, bound_at, bound_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', CURRENT_TIMESTAMP, $8)
"#;

/// Insert a commission event (idempotent unique source key).
pub const INSERT_COMMISSION_EVENT: &str = r#"
INSERT INTO partner_commission_event
    (id, uuid, tenant_id, organization_id, source_type, source_ref,
     customer_user_id, base_amount, event_at, status, remark)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9, 'PENDING', $10)
"#;

/// Lock and page pending commission events for settlement.
pub const SELECT_PENDING_EVENTS_FOR_SETTLEMENT: &str = r#"
SELECT id, source_type, source_ref, customer_user_id, base_amount::text, event_at
FROM partner_commission_event
WHERE tenant_id = $1 AND organization_id = $2 AND status = 'PENDING'
ORDER BY event_at ASC, id ASC
LIMIT $3
FOR UPDATE SKIP LOCKED
"#;

/// Mark a commission event settled.
pub const UPDATE_EVENT_SETTLED: &str = r#"
UPDATE partner_commission_event
SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP, settled_by = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
"#;

/// Mark a commission event skipped.
pub const UPDATE_EVENT_SKIPPED: &str = r#"
UPDATE partner_commission_event
SET status = 'SKIPPED', settled_at = CURRENT_TIMESTAMP, settled_by = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
"#;

/// Insert a commission settlement batch.
pub const INSERT_SETTLEMENT: &str = r#"
INSERT INTO partner_commission_settlement
    (id, uuid, tenant_id, organization_id, event_id, base_amount, distributed_amount,
     receiver_count, status, computed_at, computed_by, remark)
VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8, $9, CURRENT_TIMESTAMP, $10, $11)
"#;

/// Insert a commission distribution.
pub const INSERT_DISTRIBUTION: &str = r#"
INSERT INTO partner_commission_distribution
    (id, uuid, tenant_id, organization_id, settlement_id, receiver_partner_id,
     level_offset, ratio, base_amount, amount, account_ledger_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10::numeric, $11)
"#;

/// Insert a join fee payment.
pub const INSERT_JOIN_FEE_PAYMENT: &str = r#"
INSERT INTO partner_join_fee_payment
    (id, uuid, tenant_id, organization_id, partner_id, amount, currency, status,
     payment_method, paid_at, paid_by, remark)
VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, 'PAID', $8, CURRENT_TIMESTAMP, $9, $10)
RETURNING id, partner_id, amount::text, currency, status, payment_method, paid_at, paid_by, remark, created_at
"#;

/// Mark a partner's join fee as paid.
pub const UPDATE_PARTNER_JOIN_FEE_PAID: &str = r#"
UPDATE partner_partner
SET join_fee_status = 'PAID',
    join_fee_amount = COALESCE(join_fee_amount, 0) + $3::numeric,
    joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
"#;

/// Insert a withdrawal.
pub const INSERT_WITHDRAWAL: &str = r#"
INSERT INTO partner_withdrawal
    (id, uuid, tenant_id, organization_id, partner_id, amount, status, hold_id, remark)
VALUES ($1, $2, $3, $4, $5, $6::numeric, 'PENDING', $7, $8)
RETURNING id, partner_id, amount::text, status, hold_id, reviewed_by, reviewed_at, review_remark,
          paid_at, paid_by, remark, created_at, updated_at
"#;

/// Select a withdrawal by id.
///
/// Locked for update: every use site mutates the withdrawal inside its own
/// write transaction (review/pay). The row lock serializes concurrent review
/// attempts so a single withdrawal can never be both approved and rejected.
pub const SELECT_WITHDRAWAL_BY_ID: &str = r#"
SELECT id, partner_id, amount::text, status, hold_id, reviewed_by, reviewed_at, review_remark,
       paid_at, paid_by, remark, created_at, updated_at
FROM partner_withdrawal
WHERE tenant_id = $1 AND organization_id = $2 AND id = $3
FOR UPDATE
"#;

/// Insert a partner audit log row.
pub const INSERT_AUDIT_LOG: &str = r#"
INSERT INTO partner_audit_log
    (id, uuid, tenant_id, organization_id, operator_id, operator_type, action,
     target_type, target_id, request_id, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
"#;
