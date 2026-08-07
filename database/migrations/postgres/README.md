# migrations/postgres

Pre-launch the partner schema is consolidated on the single greenfield
baseline: `database/ddl/baseline/postgres/0001_partner_baseline.sql`.
The baseline already folds the wallet-unification migration
(0002_partner_wallet_account: `account_ledger_id` rename, `hold_id` column,
retired `partner_wallet`/`partner_ledger_entry` tables). No ordered
post-baseline migrations exist while the app is pre-launch; shared development
schemas converge by resetting the module state to the baseline.
