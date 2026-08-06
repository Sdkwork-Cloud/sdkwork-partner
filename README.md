# sdkwork-partner
repository-kind: application

SDKWork Partner capability workspace — 多级合作伙伴（代理商）管理体系。

- Domain: `commerce`
- Capability: `partner`
- Backend API prefix: `/backend/v3/api/partners`
- App API prefix: `/app/v3/api/partners` (二期，代理商自助端)
- Database module: `partner` (table prefix `partner_`)
- SDK family: `sdkwork-partner-backend-sdk` (`@sdkwork/partner-backend-sdk`)

## Standards

- Agent entrypoint: [`AGENTS.md`](AGENTS.md)
- Global standards router: `../sdkwork-specs/README.md`
- Documentation canon: [`docs/product/prd/PRD.md`](docs/product/prd/PRD.md), [`docs/architecture/tech/TECH_ARCHITECTURE.md`](docs/architecture/tech/TECH_ARCHITECTURE.md)

## Workspace Layout

| Path | Purpose |
| --- | --- |
| `crates/` | Rust route, service, repository, host, and assembly crates |
| `apis/` | Authored Partner API contracts (backend-api authority) |
| `sdks/` | Partner SDK family `sdkwork-partner-backend-sdk` and generator-owned artifacts |
| `database/` | Partner database lifecycle assets (module `partner`) |
| `apps/sdkwork-partner-pc/` | PC React application root (standalone demo + admin domain packages) |
| `apps/sdkwork-partner-common/packages/` | Shared TypeScript contracts |
| `specs/` | Repository-wide machine contracts |
| `tools/` | Contract/SDK generation and validation entrypoints |
| `docs/` | PRD and technical architecture canon |

## Quick Start

```bash
pnpm install
pnpm verify
cargo test --workspace
```
