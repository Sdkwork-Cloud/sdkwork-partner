-- sdkwork:migration
-- id: 0002_partner_user_account_nullable
-- engine: postgres
-- module: sdkwork-partner
-- purpose: Allow partners to be created without a bound IAM user account;
--   the account is bindable later from the admin partner list. PostgreSQL
--   unique indexes treat NULLs as distinct, so the existing
--   uk_partner_partner_tenant_user index keeps enforcing one partner per
--   bound account without blocking multiple unbound partners.
-- reversible: false
-- rollback: forward-fix (NULL user_account_id rows are the canonical new state)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE partner_partner ALTER COLUMN user_account_id DROP NOT NULL;

COMMIT;
