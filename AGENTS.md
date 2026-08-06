# Repository Guidelines

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Use `../sdkwork-specs/README.md` as the task router and `../sdkwork-specs/AGENTS_SPEC.md` for this entrypoint. Do not copy global standards into this repository. If the relative specs path does not resolve, stop and report the broken workspace layout.

## Application Identity

Read `sdkwork.app.config.json` when changing application behavior, runtime config, SDK wiring, release metadata, packaging, app-owned capabilities, or deployment metadata. Stop if the manifest is missing, empty, or ambiguous.

- Domain: `commerce`
- Capability: `partner`
- Table prefix: `partner_`
- App API prefix: `/app/v3/api/partners`
- Backend API prefix: `/backend/v3/api/partners`
- PC application root: `apps/sdkwork-partner-pc/`

## Local Dictionary Structure

- `AGENTS.md`: repository execution rules and standards router.
- `.sdkwork/`: local skills, plugins, manifests, and AI workspace metadata.
- `apps/sdkwork-partner-pc/`: PC React application root.
- `apps/sdkwork-partner-common/packages/`: shared TypeScript contracts and service normalization.
- `specs/`: repository-wide machine contracts.
- `apis/`: authored Partner API contracts.
- `sdks/`: Partner SDK families and generator-owned artifacts.
- `crates/`: Rust routes, services, repositories, hosts, and gateways.
- `database/`: Partner database lifecycle assets.
- `etc/`: deployable source configuration and environment profiles.
- `deployments/`, `scripts/`, `tools/`, `docs/`, `tests/`: deployment, automation, documentation, and verification assets.
- `package.json`, `Cargo.toml`, `pnpm-workspace.yaml`: native build and dependency authorities.

Documentation Canon: [`docs/product/prd/PRD.md`](docs/product/prd/PRD.md) and [`docs/architecture/tech/TECH_ARCHITECTURE.md`](docs/architecture/tech/TECH_ARCHITECTURE.md).

## Spec Resolution Order

Use dynamic progressive loading before reading implementation files. Resolve the repository or application root and task boundary first. Read the applicable app manifest and nearest module `specs/component.spec.json`, then use the matching row in `../sdkwork-specs/README.md` to load only task-specific global specs before implementation files. Expand progressively only when evidence crosses another boundary. Language-specific specs are on-demand only.

## Required Specs By Task Type

- Agent/workflow changes: `../sdkwork-specs/AGENTS_SPEC.md` and `../sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md`.
- TypeScript or Node changes: `../sdkwork-specs/CODE_STYLE_SPEC.md`, `../sdkwork-specs/NAMING_SPEC.md`, and `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`.
- React UI changes: `../sdkwork-specs/FRONTEND_CODE_SPEC.md`, `../sdkwork-specs/FRONTEND_SPEC.md`, `../sdkwork-specs/UI_ARCHITECTURE_SPEC.md`, and `../sdkwork-specs/APP_PC_REACT_UI_SPEC.md`.
- Rust/runtime changes: `../sdkwork-specs/RUST_CODE_SPEC.md`, `../sdkwork-specs/WEB_FRAMEWORK_SPEC.md`, `../sdkwork-specs/WEB_BACKEND_SPEC.md`, and the applicable runtime/database spec.
- SDK generation or consumption: `../sdkwork-specs/SDK_SPEC.md`, `../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md`, `../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md`, and `../sdkwork-specs/API_SPEC.md`.
- API contract changes: `../sdkwork-specs/API_SPEC.md`; list/search work also loads `../sdkwork-specs/PAGINATION_SPEC.md`.
- Database changes: `../sdkwork-specs/DATABASE_FRAMEWORK_SPEC.md`, `../sdkwork-specs/SUBJECT_ID_SPEC.md`, and applicable database specs.
- Source configuration changes: `../sdkwork-specs/SOURCE_CONFIG_SPEC.md` (this root owns `etc/`).
- Package/release changes: `../sdkwork-specs/PNPM_SCRIPT_SPEC.md`, `../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md`, `../sdkwork-specs/RELEASE_SPEC.md`, and `../sdkwork-specs/SUPPLY_CHAIN_SECURITY_SPEC.md`.

## Code Style Rules

Use native workspace helpers and `@sdkwork/utils`; do not create local duplicates. Generated output under `sdks/**/generated/**` is generator-owned. Keep app/backend API boundaries separate, use `sdkwork-web-framework` for Rust HTTP response mapping, and do not bypass generated/composed SDKs with raw HTTP or manual auth headers.

## Build, Test, And Verification

Use repository scripts as command authority. Run narrow checks before `pnpm verify`. Relevant checks include:

```bash
node ../sdkwork-specs/tools/check-agent-workflow-standard.mjs --root .
node ../sdkwork-specs/tools/check-application-layering.mjs --root .
node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
pnpm check
pnpm verify
```

## Agent Execution Rules

Inspect dirty worktree changes before editing and preserve unrelated user work. Use exact contracts before inference, never hand-edit generated SDK output, and stop when an owner contract, SDK method, app manifest, or required relative spec is ambiguous or missing. Record command evidence before claiming completion.

## Task-Specific Standards Routing

- App SDK consumer work loads `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`, then runs `check-app-sdk-consumer-imports.mjs`.
- HTTP API response work loads `API_SPEC.md`, then runs `check-api-operation-patterns.mjs` and `check-api-response-envelope.mjs`.
- List and search work loads `PAGINATION_SPEC.md` and `API_SPEC.md`, then runs `check-pagination.mjs`.

## Human Review Rules

Request human review before breaking public contracts, changing application identity, changing security/auth behavior, changing database migrations, changing generated SDK ownership, using production credentials, changing release/deployment governance, or performing destructive cleanup.
