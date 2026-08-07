# 多级合作伙伴体系 — 技术架构

## 1. 概览

`sdkwork-partner` 是标准 SDKWork 能力工作区（镜像 `sdkwork-promotion` 形态），提供多级合作伙伴（代理商）管理体系。宿主应用（如 `sdkwork-cloudrouter`）以联邦能力方式接入：路由 merge、数据库模块注册、SDK 消费。

## 2. 目录与包布局

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 路由 | `crates/sdkwork-routes-partner-backend-api` | HTTP 路由适配 + ACL + route manifest |
| 服务 | `crates/sdkwork-commerce-partner-service` | 业务规则（commands/queries/domain/ports/backend_admin） |
| 仓储 | `crates/sdkwork-commerce-partner-repository-sqlx` | SQLx 访问，事务 + 递归 CTE |
| 数据库宿主 | `crates/sdkwork-partner-database-host` | 数据库模块加载与生命周期 |
| 服务宿主 | `crates/sdkwork-partner-service-host` | 服务容器 + capture/settlement worker |
| 装配 | `crates/sdkwork-api-partner-assembly` | host-neutral API 装配 |
| 独立网关 | `crates/sdkwork-api-partner-standalone-gateway` | standalone binary `partner-server` |
| 数据库 | `database/` | module `partner`，表前缀 `partner_` |
| 契约 | `apis/backend-api/partner/` | OpenAPI 权威契约 |
| SDK | `sdks/sdkwork-partner-backend-sdk/` | `@sdkwork/partner-backend-sdk` |

## 3. 领域模型

11 张表：`partner_level`、`partner_commission_config`、`partner`、`partner_customer_binding`、`partner_join_fee_payment`、`partner_commission_event`、`partner_commission_settlement`、`partner_commission_distribution`、`partner_withdrawal`、`partner_stat_snapshot`、`partner_audit_log`。合作伙伴钱包与流水不落本模块表：余额/冻结/累计/流水统一存于 sdkwork-account 账户域（`acct_account`/`acct_ledger_entry`，`owner_type=PARTNER`、`account_purpose=SETTLEMENT`、asset `cash`），提现冻结走 `acct_hold`（0002 迁移废弃 `partner_wallet`/`partner_ledger_entry`）。

## 4. 提成引擎

- 金额以分（i64）计算，落库 NUMERIC(18,2)。
- 舍入：逐级四舍五入，末位吸收剩余，保证 Σ = 总额。
- 幂等：事件唯一键 `(source_type, source_ref)`；结算单事务内写 settlement + distributions + 审计；提成入账经账户端口（`PartnerWalletPort` → `PartnerAccountWalletAdapter`），幂等键 `commission:{event_id}:{partner_id}` / `join-fee:{payment_id}:{partner_id}`。
- 余额写入只经账户端口：结算/加盟费提成 → Credit；提现 → Hold/Release/Settle（`partner_withdrawal.hold_id`）；调账 → Credit/Debit（`commission_adjustment`）。

## 5. 收益事件链路

- capture worker（`PARTNER_COMMISSION_CAPTURE_INTERVAL_SECONDS`，默认 300，可关）：读 `commerce_usage_statement`（已结算）+ 充值支付成功记录 → 写 PENDING 事件；表不可用时跳过（standalone 走手工登记）。
- settlement worker / 管理端手动触发：PENDING → 逐级分配 → SETTLED；无绑定或无 ACTIVE 代理 → SKIPPED。

## 6. 联邦接入（宿主侧触点）

- `Cargo.toml [workspace.dependencies]`：`sdkwork_routes_partner_backend_api` 等。
- 后端路由：`build_backend_partner_router(PartnerAdminService::new(PostgresPartnerAdminRepository::new(commerce_pool, Arc::new(PartnerAccountWalletAdapter::new(commerce_pool.clone())))))` → `.merge(partner_router)`。
- 数据库：`DatabaseModuleRegistry::builder().register(sdkwork_partner_database_host::database_module()...)`。
- 前端：`getSdkworkPartnerBackendSdkClient()` + 宿主 admin 包路由/菜单注册。
