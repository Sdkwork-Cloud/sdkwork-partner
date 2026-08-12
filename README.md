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
| `specs/` | Repository-wide machine contracts |
| `tools/` | Contract/SDK generation and validation entrypoints |
| `docs/` | PRD and technical architecture canon |

## Quick Start

```bash
pnpm install
pnpm verify
cargo test --workspace
```

## 数据初始化（快速商业化落地）

安装后默认租户（100001）的等级目录与全局提成配置由数据库种子自动初始化，无需手工建数据：

- **7 级商业默认目录**：普通代理 → 银牌代理 → 金牌代理 → 战略代理 → 城市合伙人 → 省级代理 → 区域总代，含级差返佣池（客户 10%–30%、加盟费 8%–20%）、付费加盟阶梯（¥5,999–¥499,999，全员付费加盟）与每级权益清单（`partner_level.benefits`）；完整运营与销售方案见 `docs/product/ops/partner-tier-program.md`。
- **触发方式**：宿主（cloudrouter）设置 `SDKWORK_DATABASE_SEED_ON_BOOT=true` 时启动自动执行；独立部署时执行 `pnpm db:seed`（sdkwork-database-cli `seed`）。
- **幂等与可运营**：种子使用 `ON CONFLICT DO NOTHING`，重复执行或重启不会覆盖运营后续修改的等级、比例与权益；等级/比例/权益均可从管理端「等级与返佣比例」页面调整。
- **返佣模型**：级差制（differential）+ 利润返佣——客户收益返佣基数 = 客户收益 × 平台毛利率（默认 40%），直接销售伙伴拿满本级提成池，上级按本级与链条已见最高比例的差额提取；任意链条总提成恒等于链条最高比例（相对利润基数，折合收入不超过 12%），平台毛利按构造可控。
