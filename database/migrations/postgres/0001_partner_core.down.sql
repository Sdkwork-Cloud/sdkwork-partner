-- 0001_partner_core.down.sql
-- sdkwork:migration
-- id: 0001_partner_core
-- engine: postgres
-- module: sdkwork-partner
-- purpose: reverse partner (multi-level agent) management schema.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: advisory
-- lock_timeout: 15000
-- statement_timeout: 60000
-- reversible: true

DROP TABLE IF EXISTS partner_audit_log;
DROP TABLE IF EXISTS partner_stat_snapshot;
DROP TABLE IF EXISTS partner_withdrawal;
DROP TABLE IF EXISTS partner_ledger_entry;
DROP TABLE IF EXISTS partner_wallet;
DROP TABLE IF EXISTS partner_commission_distribution;
DROP TABLE IF EXISTS partner_commission_settlement;
DROP TABLE IF EXISTS partner_commission_event;
DROP TABLE IF EXISTS partner_join_fee_payment;
DROP TABLE IF EXISTS partner_customer_binding;
DROP TABLE IF EXISTS partner_partner;
DROP TABLE IF EXISTS partner_commission_config;
DROP TABLE IF EXISTS partner_level;
