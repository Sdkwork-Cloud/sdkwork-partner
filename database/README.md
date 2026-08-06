# database

- **Purpose**: Partner database lifecycle assets (module partner).
- **Owner**: sdkwork-partner
- **Related specs**: `../sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md` and task-matrix rows from `../sdkwork-specs/README.md`
- **Verification**: `pnpm check` / `pnpm verify` (canonical scripts)

## Initialization state

This module is in **initialization state** for greenfield deployments:

1. **Baseline** — `database/ddl/baseline/{engine}/0001_partner_baseline.sql` contains the full DDL snapshot.
2. **Migrations** — `database/migrations/{engine}/` is reserved for post-GA incremental schema changes only. It is intentionally empty at initialization.
3. **Drift** — run `pnpm db:drift:check` before release.

## Commands

```bash
pnpm run db:validate
pnpm run db:materialize:contract
pnpm run db:plan
pnpm run db:init
pnpm run db:migrate
pnpm run db:seed
pnpm run db:status
pnpm run db:drift:check
```
