-- sdkwork:migration
-- id: 0001_organization_id_not_null
-- engine: postgres
-- module: sdkwork-partner
-- purpose: Enforce organization_id NOT NULL DEFAULT on all tables in the
--   consolidated baseline. NULL rows (pre-standard data anomalies) are
--   backfilled with the platform sentinel before NOT NULL is set, and
--   NOT NULL columns without an explicit default receive the sentinel
--   default, keeping existing deployments consistent with fresh baseline
--   installs.
-- reversible: false
-- rollback: forward-fix (sentinel backfill is the canonical fix; NULL
--   organization rows are data anomalies)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE partner_level ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_level SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_level ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_level ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_commission_config ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_commission_config SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_commission_config ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_commission_config ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_partner ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_partner SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_partner ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_partner ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_customer_binding ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_customer_binding SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_customer_binding ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_customer_binding ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_join_fee_payment ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_join_fee_payment SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_join_fee_payment ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_join_fee_payment ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_commission_event ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_commission_event SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_commission_event ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_commission_event ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_commission_settlement ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_commission_settlement SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_commission_settlement ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_commission_settlement ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_commission_distribution ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_commission_distribution SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_commission_distribution ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_commission_distribution ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_withdrawal ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_withdrawal SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_withdrawal ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_withdrawal ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_stat_snapshot ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_stat_snapshot SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_stat_snapshot ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_stat_snapshot ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE partner_audit_log ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0;
UPDATE partner_audit_log SET organization_id = 0 WHERE organization_id IS NULL;
ALTER TABLE partner_audit_log ALTER COLUMN organization_id SET DEFAULT 0;
ALTER TABLE partner_audit_log ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
