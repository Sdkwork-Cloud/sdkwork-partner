# SDKWork Partner Backend API Changelog

## 0.6.0

- **Partner join (伙伴计划) application review**: four new endpoints manage
  join applications submitted through the new app-api surface.
  - `GET /backend/v3/api/partners/applications` lists applications with
    status / applicant-type / keyword filters and pagination.
  - `GET /backend/v3/api/partners/applications/{applicationId}` retrieves an
    application including the locked inviter partner.
  - `POST /backend/v3/api/partners/applications/{applicationId}/approve`
    (commerce.partner.manage) approves the application (SUBMITTED → APPROVED)
    and creates the partner record in the same transaction through the
    existing partner creation path: status PENDING, bound to the applicant's
    IAM user, inviter chain from the submitted invite code, assigned level and
    a freshly generated invite code. Join fee registration and activation keep
    the existing management flow (join-fee payments → activate), so the
    settlement/commission engine is untouched.
  - `POST /backend/v3/api/partners/applications/{applicationId}/reject`
    (commerce.partner.manage) rejects with a required reason
    (SUBMITTED → REJECTED); the applicant may submit a new application.
  - Review actions are written to the existing audit log.
- Backed by migration 0006 (`partner_application` table +
  `partner_partner.invite_code`).

## 0.5.0

- **Profit-based rebate (利润返佣)**: customer revenue commissions are now
  allocated on the platform gross profit base `revenue × profit_margin_ratio`
  (new `CommissionConfigItem.profitMarginRatio`, default 40.00%, migration
  0005) instead of the full customer revenue amount. The commission event
  keeps the original revenue amount; settlements and distributions record the
  profit base actually allocated. Join-fee commissions keep the full join fee
  as their base. Level benefit copy and docs state the profit-based口径
  explicitly to avoid confusion between commercial operations and settlement
  math (a 30% pool on a 40% margin pays at most 12% of revenue).
- New `POST /backend/v3/api/partners/levels/restore_defaults` restores the
  commercial default level catalog (`fill` revives missing/deleted default
  levels only; `reset` also overwrites the active default levels with catalog
  values; operator-created levels beyond the catalog are never touched).

## 0.4.0

- Commission allocation upgraded to the industry-standard **differential (级差)
  model**: the partner that owns the revenue source keeps its full level
  ratio, and each ancestor earns the positive difference against the highest
  ratio below it in the chain. The aggregated payout therefore equals the
  highest ratio in the chain and can never exceed it, keeping the platform
  margin bounded by construction regardless of chain depth. The engine still
  rejects configurations above 100% and preserves depth caps, zero-ratio
  skipping, and remainder absorption.
- `PartnerLevelItem` now includes `benefits`, a structured benefit (权益)
  ladder (`LevelBenefitItem`: `code`/`name`/`value`/`sort`) granted by each
  level; `AdminPartnerLevelCreateRequest` and `AdminPartnerLevelUpdateRequest`
  accept the same shape (backed by the `partner_level.benefits` JSONB column,
  migration 0004).
- Install-time seed data (tenant 100001): a commercial default catalog of
  seven partner levels forming the full agency pyramid (Agent / Silver /
  Gold / Strategic / City Partner / Provincial Agent / Regional Distributor)
  with differential commission pools (10%–30%), join-fee commission pools
  (8%–20%), paid onboarding join fees (¥5,999–¥499,999), and per-level
  benefit ladders, plus the global commission config row (depth 3, CNY, min
  withdrawal ¥100). The tier design and go-to-market plan are documented in
  `docs/product/ops/partner-tier-program.md`. Seeds are idempotent
  (`ON CONFLICT DO NOTHING`) so operator edits are never overwritten by
  re-seeds or restarts; locale seed files localize level names and benefit
  copy for zh-CN and en-US.

## 0.3.0

- `AdminJoinFeePaymentCreateRequest` now accepts an optional `idempotencyKey`
  (max 128 chars): `POST /backend/v3/api/partners/{partnerId}/join_fee_payments`
  replays idempotently — a repeat submission with the same key returns the
  original payment instead of creating a duplicate payment and duplicate
  ancestor commission. Backed by the new partial unique index
  `uk_partner_join_fee_payment_idempotency` (migration 0003). Legacy clients
  without a key keep the previous behavior.

## 0.2.0

- Removed `GET /backend/v3/api/partners/{partnerId}/customers`
  (`customerBindings.list`) and `GET /backend/v3/api/partners/{partnerId}/join_fee_payments`
  (`joinFeePayments.list`): both per-partner variants duplicated the global list
  operations, which already support `partner_id` filtering. Consumers use
  `GET /backend/v3/api/partners/customers` and
  `GET /backend/v3/api/partners/join_fee_payments` with the `partner_id` query
  parameter instead.
- Renamed `GET /backend/v3/api/partners/customers` to `customerBindings.list`
  (was `customerBindings.listAll`) and `GET /backend/v3/api/partners/join_fee_payments`
  to `joinFeePayments.list` (was `joinFeePayments.listAll`) to comply with the
  SDKWork operation-pattern standard (list actions use the `list` action).
- Removed `requestId` from the `AuditLogItem` response schema: the HTTP response
  envelope forbids the wire field `requestId` (API_SPEC §4.5). The internal
  `partner_audit_log.request_id` column remains for audit tracing and is not
  exposed through read APIs.
- Standardized list pagination parameters: every `.list` operation now declares
  `page` and `page_size` as `integer`/`int32` with `minimum: 1`,
  `page_size` `maximum: 200`, and defaults `1`/`20` (PAGINATION_SPEC §3).
