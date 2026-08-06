# migrations/postgres

Versioned partner database migrations.

Convention: `{version}_{name}.up.sql` / `{version}_{name}.down.sql`.

Lifecycle authority: `../sdkwork-specs/DATABASE_FRAMEWORK_SPEC.md`. Run via `pnpm db:migrate` (sdkwork-database CLI).
