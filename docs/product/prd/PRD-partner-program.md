# 伙伴计划（加盟营销模块）产品设计报告 v1.0

> 状态：**一期已实施完成并通过验证**（2026-08-12）
> 领域属主：sdkwork-partner；宿主集成：sdkwork-cloudrouter
> 关联文档：`docs/product/prd/PRD.md`（多级合作伙伴体系）、`docs/product/ops/partner-tier-program.md`（运营销售方案）
> 技术命名：`sdkwork-partner-pc-join` / 路由 `/partner-join/*` / API `/app/v3/api/partner_join/*`（菜单展示名「伙伴计划」）；申请记录与经营实体分离（新表 `partner_application` + 复用现有伙伴创建/加盟/激活链路，结算引擎零改动）

---

## 1. 产品定位

### 1.1 一句话定位

> **伙伴计划是 SDKWork 生态面向公众（普通用户与组织）的独立营销模块，是"发展代理商"的营销体系入口**：从认知、申请、审核、加盟到经营与裂变，构成一条完整的代理商增长闭环。技术命名统一采用 **join（加盟）**，与"加盟费/加盟体系"既有术语一致。

### 1.2 边界界定（非 console / 非 admin）

| 面 | 定位 | 伙伴计划的边界 |
| --- | --- | --- |
| Console（用户控制台） | 已开通用户管理自身资源/账单/密钥 | **不归属**：伙伴计划不属于 console 功能，不走 `/console/*` |
| Admin（平台管理端） | 运营/管理员内部操作 | **不归属**：伙伴计划的用户触达面不在 admin；仅"审核/运营配置"是 admin 内部工具，作为支撑存在 |
| **伙伴计划 Join（本模块）** | **面向公众的独立营销模块** | 拥有独立站点地图（`/partner-join/*`）、独立包、独立用户面 API（app-api），由门户 Header 作为入口引导 |

### 1.3 营销体系全景（完整营销体系架构）

伙伴计划不是一张申请表，而是**完整营销体系的入口与载体**。体系按"获客 → 转化 → 经营 → 激励 → 数据"分层，伙伴计划覆盖其中用户可感知的全部环节：

```
┌────────────────────────────────────────────────────────────────┐
│  ① 品牌与内容层   伙伴计划品牌/标语、价值主张、等级与权益、案例、FAQ │
├────────────────────────────────────────────────────────────────┤
│  ② 获客层        公开落地页（SEO）· 专属推广链接/二维码（归属追踪）  │
│                  邀请码裂变（推荐人关系）· 宣传物料库（海报/话术）   │
│                  业绩榜单（社交证明与激励）                         │
├────────────────────────────────────────────────────────────────┤
│  ③ 转化层        申请（个人/组织）→ 审核 → 加盟费 → 正式开通        │
├────────────────────────────────────────────────────────────────┤
│  ④ 经营层        客户绑定/归属（防抢单）· 收益结算 · 提现 ·         │
│                  下级渠道管理（代理树）· 商机线索 · 培训认证         │
├────────────────────────────────────────────────────────────────┤
│  ⑤ 激励层        7 级返佣池（级差制）· 等级权益 · 季度考核/降级 ·    │
│                  年度返利/季度激励（权益体系）                      │
├────────────────────────────────────────────────────────────────┤
│  ⑥ 数据层        业绩统计 · 榜单 · 申请漏斗转化分析（运营）          │
└────────────────────────────────────────────────────────────────┘
         ▲                                                │
         └────── 伙伴计划 Join = 体系入口，串联所有环节 ──────┘
```

**现状与补齐关系**：④⑤⑥ 的后端引擎与管理工具已建成（结算/提成/提现/统计/等级权益）；**①②③ 是缺口** —— 本模块一期补齐 ①②③ 的用户触达面，并通过"伙伴自助端"（二期）把 ④ 开放给伙伴自助使用，形成完整闭环。

---

## 2. 目标与范围

### 2.1 一期（本期交付）：营销入口 + 申请转化闭环

1. 门户 Header 增加「伙伴计划」菜单，作为营销体系入口；
2. 公开营销落地页：价值主张、7 级体系（加盟费/返佣池/权益）、收益测算器、流程说明、FAQ、合规声明；
3. 申请转化：个人/组织申请表单、我的申请进度跟踪、审核结果反馈；
4. 邀请码裂变：现有伙伴的邀请码可传播，新申请通过后自动挂上级链（推荐人获得加盟费提成）；
5. 管理端审核支撑：申请列表/详情/通过（指定等级）/拒绝（必填原因），通过即生成伙伴记录并入现有体系（PENDING，语义与 admin 创建一致）；
6. 独立包与独立调试壳：`sdkwork-partner-pc-join` 可在 sdkwork-partner-pc 独立运行，也可被门户宿主装配。

### 2.2 二期（不在本期，架构预留）：经营与增长层开放

- **伙伴自助端**：专属推广链接/二维码管理与数据、客户自绑/归属查询、收益与结算明细、自助提现（原 PRD 二期）；
- **推广中心**：宣传物料库（海报/话术/FAQ 模板下载）、业绩榜单展示页、商机线索分配视图；
- **营销活动**：限时加盟费优惠/返利活动、年度峰会/培训报名、区域报备与保护流程自助化；
- **在线加盟**：加盟费在线支付（对接 sdkwork-payment）。

> 一期架构（路由、API 面、数据模型）为二期预留扩展位，避免返工。

---

## 3. 角色与使用场景

| 角色 | 说明 | 与模块的关系 |
| --- | --- | --- |
| 访客（未登录） | 潜在申请人/决策者 | 浏览落地页（公开），被营销内容转化 |
| 申请人（个人） | 已注册普通用户 | 提交申请、跟踪进度、接收结果 |
| 申请人（组织） | 组织代表 | 以组织主体申请，体现正规性 |
| 邀请人（现有伙伴） | 已开通代理商 | 通过邀请码/专属链接发展下级，获得加盟费提成（级差） |
| 审核管理员 | 平台运营（admin 内部支撑） | 审核申请、指定等级、登记加盟费、拒绝留原因 |

核心场景：

1. **入口获客**：访客在门户 Header 看到「伙伴计划」→ 落地页了解收益与等级 → 登录后申请；
2. **推荐裂变**：现有伙伴把邀请码/链接发给潜在伙伴 → 申请时填邀请码 → 通过后挂上级链 → 加盟费缴纳触发推荐人链提成（级差制，现有引擎）；
3. **审核开通**：管理员审核 → 通过（指定等级）→ 生成伙伴记录（PENDING）→ 登记加盟费 → ACTIVE → 开始发展客户；
4. **结果反馈**：申请人在「我的申请」查看状态流转，被拒绝可修改后重新申请；
5. **经营承接**（二期）：开通后伙伴进入自助端管理推广链接/客户/收益，运营端通过榜单与激励驱动增长。

---

## 4. 核心流程与状态机

### 4.1 端到端流程

```
访客 ──▶ 门户 Header「伙伴计划」
   │
   ▼
落地页（公开 /partner-join）
   ├─ 等级体系/收益测算/FAQ/案例
   │
   ├─▶ 登录（IAM 门户会话）──▶ 申请表单（/partner-join/apply）
   │                             ├─ 主体类型：个人 / 组织
   │                             ├─ 联系人/电话/邮箱（必填）
   │                             ├─ 主体名称（组织必填）
   │                             ├─ 期望等级（选填，提示以审核为准）
   │                             ├─ 邀请码（选填，实时校验 → 绑定推荐人）
   │                             └─ 业务简介（选填）
   │                                    │ 提交（幂等防重）
   │                                    ▼
   │                            我的申请（/partner-join/status）
   │                                    │
   └───────────────┬────────────────────┘
                   ▼
        管理端审核（/admin/partner/applications，内部支撑）
          ├─ 通过：指定等级 → 创建伙伴记录（PENDING） → 登记加盟费 → 激活 ACTIVE
          └─ 拒绝：必填原因 → 申请人可见，可修改后重新提交
```

### 4.2 申请状态机（申请记录独立；审核通过复用现有伙伴链路）

```
                 ┌─────────────┐
                 │  SUBMITTED  │◀───────────────────┐ 重新提交（新记录）
                 └─────┬───────┘                    │
          审核通过     │       审核拒绝/申请人撤回    │
                 ▼     ▼                            │
            ┌─────────┴──────────┐    ┌─────────────┴──────┐
            │ APPROVED           │    │ REJECTED / CANCELLED│
            │（已创建伙伴记录）   │    │（原因留审计）        │
            └─────────┬──────────┘    └────────────────────┘
                      │ 伙伴走现有链路（见下）
                      ▼
        伙伴记录（partner_partner）：创建即 PENDING（沿用现有语义"已入伙未激活"）
            → 登记加盟费（现有端点，join_fee_status → PAID）
            → 管理员激活（现有编辑流程）→ ACTIVE 参与结算
```

- **申请与经营分离**：申请 = `partner_application` 记录（审核生命周期）；伙伴 = `partner_partner` 记录（经营生命周期，**现有 PENDING/ACTIVE 语义零改动**）；
- **审核通过** = 事务内：申请置 APPROVED + 复用现有伙伴创建逻辑生成伙伴记录（status=`'PENDING'`、join_fee UNPAID、绑申请人、挂邀请人上级链、定等级、分配邀请码）→ 回填 `approved_partner_id`；
- **加盟与激活** = 完全走现有链路（登记加盟费置 PAID → 管理员激活 ACTIVE），结算引擎、伙伴列表、统计零改动；
- **一用户一有效申请**：`partner_application` 部分唯一索引（仅 SUBMITTED），防重复刷单；REJECTED/CANCELLED 后可重新提交（新记录，历史留审计）。

---

## 5. 业务规则

| # | 规则 | 说明 |
| --- | --- | --- |
| R1 | 公开与登录分层 | 落地页公开可看（营销获客）；提交申请/查看进度须登录（IAM 门户会话） |
| R2 | 一用户一有效申请 | `partner_application` 部分唯一索引（仅 SUBMITTED），防重复提交与恶意刷量；REJECTED/CANCELLED 后可重新提交 |
| R3 | 主体类型 | `INDIVIDUAL` / `ORGANIZATION`；组织必须填主体名称 |
| R4 | 期望等级仅意向 | 最终等级由管理员审核时指定；一期默认仅开通 L1–L3，L4+ 人工评估（防跳级套利） |
| R5 | 邀请码绑定关系 | 邀请码只绑定推荐人链（`inviter_partner_id` → `parent_partner_id`），不决定等级；校验失败不可提交 |
| R6 | 加盟费 | 一期沿用管理员登记付款（现有 `join_fee_payments`），登记即触发上级链加盟费提成（级差制，现有引擎）；在线支付二期 |
| R7 | 审核留痕 | 通过/拒绝均写 `partner_audit_log`，记录审核人、时间、意见 |
| R8 | 拒绝可重试 | 拒绝必填原因；申请人可修改后重新提交（新申请记录） |
| R9 | 账号绑定一致 | 审核通过创建伙伴时绑定申请人（`partner_partner.user_account_id`=申请人），人=伙伴账号一致 |
| R10 | 数据隔离 | 所有表沿用 `tenant_id / organization_id` 范式（默认 0） |
| R11 | 合规红线 | 仅按客户消费与加盟费计酬，禁止多层级拉人头计酬；申请/审核/加盟全程审计 |
| R12 | 邀请人有效性 | 邀请码须归属 ACTIVE 状态伙伴；被停用伙伴的邀请码失效并提示 |

---

## 6. 信息架构与页面设计

### 6.1 模块站点地图（独立于 console / admin）

```
/partner-join                       落地页（公开）
├─ /partner-join/apply              申请表单（需登录）
├─ /partner-join/status             我的申请（需登录）
├─ /partner-join/calculator         收益测算器（公开，可内嵌落地页）      [一期内嵌]
├─ /partner-join/benefits           等级权益总览（公开，可内嵌落地页）    [一期内嵌]
└─ 二期扩展
   ├─ /partner-join/console/*       伙伴自助端（推广链接/客户/收益/提现）
   ├─ /partner-join/promotion       推广中心（物料库/榜单/线索）
   └─ /partner-join/events          营销活动
```

### 6.2 门户 Header 入口（宿主集成）

- `Navbar.navLinks` 增加：**「伙伴计划」** → `/partner-join`（英文展示名 Partner Program，技术命名 join，展示名与技术命名分离）；
- 可见性：**常驻**（未登录也可见，落地页公开）；移动端菜单同步出现；
- i18n：`navigation.ts` 新增 `nav.partnerJoin`（en: Partner Program / zh-CN: 伙伴计划）；
- 菜单不进入 console 顶部导航结构（console 使用独立布局与导航），不进入 admin 侧边栏（admin 仅通过内部审核菜单触达）。

### 6.3 落地页（公开）

| 区块 | 内容 |
| --- | --- |
| Hero | 「加入伙伴计划，共享 AI 增长红利」+ 核心收益主张（客户返佣 10%–30%、加盟费提成 8%–20%）+ CTA「立即申请」 |
| 等级体系 | 7 级卡片：加盟费 / 客户返佣池 / 加盟费提成池 / 权益摘要（数据来自等级目录接口，随配置实时变化） |
| 收益测算 | 交互计算器：输入预估月消费额 → 按等级展示预估月收益（标注"示例口径：利润返佣"） |
| 流程说明 | 四步：提交申请 → 审核（1–3 个工作日）→ 缴纳加盟费 → 开通经营 |
| 案例与信任 | 伙伴案例/业绩数据（运营内容位，一期静态文案占位） |
| FAQ | 加盟费能否退款 / 需要什么资质 / 如何发展客户 / 如何获得邀请码 |
| 合规声明 | 返佣按客户消费与加盟费计酬，禁止多层级拉人头 |

### 6.4 申请表单（需登录）

- 主体类型切换：个人 / 组织（组织显示主体名称、统一社会信用代码选填）；
- 字段：联系人姓名*、联系电话*、邮箱*、主体名称（组织必填）、期望等级（下拉，提示"最终等级以审核为准"）、邀请码（选填，失焦实时校验：有效 → 展示推荐人名称与等级）、业务简介（选填）；
- 提交前二次确认（加盟费按审核等级收取提示）；
- 提交成功 → 跳转「我的申请」展示申请编号（伙伴记录 uuid）；
- 已有非终态申请 → 拦截并引导至「我的申请」。

### 6.5 我的申请（需登录）

- 状态时间线：提交 → 审核中 → 已通过 / 已拒绝 / 已撤回；
- 已通过：展示审核等级、加盟费金额、"待缴纳加盟费，运营将联系您"（一期线下/管理员登记）；
- 已拒绝：展示原因 + 「修改后重新申请」；
- 已完成：展示伙伴状态，二期引导进入自助端。

### 6.6 管理端审核（内部支撑，/admin/partner/applications）

- `adminModuleRegistry` 的 `partnerCenter` 下新增「伙伴计划申请」菜单项；
- 列表：状态/主体类型筛选、关键字搜索（联系人/电话/主体名）、分页、邀请人标记；
- 审核抽屉：详情 → 「通过」（选择等级，展示加盟费与返佣池，确认后创建伙伴记录 PENDING）→ 「拒绝」（必填原因）；
- 通过后快捷跳转「加盟费登记」，完成开通闭环。

---

## 7. API 设计（增量）

### 7.1 新增用户面：sdkwork-partner-app-api（营销面，门户会话鉴权）

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| GET | `/app/v3/api/partner_join` | 伙伴计划公开信息：等级目录（加盟费/返佣池/权益）、规则摘要、FAQ 内容源 | 公开 |
| POST | `/app/v3/api/partner_join/applications` | 提交申请（幂等：同用户重复提交返回原记录） | 门户会话 |
| GET | `/app/v3/api/partner_join/applications/mine` | 我的申请列表（含最新一条与状态时间线） | 门户会话 |
| POST | `/app/v3/api/partner_join/applications/{applicationId}/cancel` | 撤回申请（仅限本人、仅 PENDING） | 门户会话 |
| GET | `/app/v3/api/partner_join/invite_codes/{code}` | 邀请码校验（返回邀请人名称/等级，R12 校验） | 公开 |

### 7.2 扩展管理面：sdkwork-partner-backend-api（审核支撑，增量）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/backend/v3/api/partners/applications` | 申请列表（状态/主体类型/关键字/分页） |
| GET | `/backend/v3/api/partners/applications/{applicationId}` | 申请详情（含邀请人信息） |
| POST | `/backend/v3/api/partners/applications/{applicationId}/approve` | 通过：body `{ levelNo, remark? }` → 申请置 APPROVED + 复用现有创建逻辑生成伙伴记录（PENDING、绑用户、挂上级链、定等级、分配邀请码）+ 审计 |
| POST | `/backend/v3/api/partners/applications/{applicationId}/reject` | 拒绝：body `{ reason }`（必填）→ 状态流转 PENDING→REJECTED + 审计 |

> 二期扩展位：推广链接归属统计、物料目录、榜单、伙伴自助数据（客户/收益/提现）均沿 app-api 扩展，不在本契约冻结范围。

> 契约规范：遵循 `API_SPEC §13.6`（id 一律 `string + format: int64`）；全部经 SDK 访问，宿主禁止直连 HTTP。

### 7.3 与现有体系衔接

- 申请/审核为独立生命周期（`partner_application`）；`approve` 事务内**复用现有伙伴创建逻辑**生成 `partner_partner`（PENDING，语义与现有 admin 创建路径完全一致）；
- 加盟费沿用 `POST /backend/v3/api/partners/{partnerId}/join_fee_payments`（含幂等键），激活沿用现有编辑流程，零新接口；
- 结算/提成/提现/统计引擎零改动；伙伴列表/统计不出现申请噪音（PENDING 语义不变）。

---

## 8. 数据模型设计（轻量申请表 + 现有表最小扩展）

### 8.1 核心决策：申请与经营实体分离

- **申请生命周期** = 新表 `partner_application`（申请意图 + 审核结果），**不进经营主表**——伙伴列表、统计、结算、代理树零噪音、零耦合；
- **经营生命周期** = 现有 `partner_partner` 语义**零改动**（PENDING="已入伙未激活"，ACTIVE 参与结算）；
- **invite_code 概念分离**：`partner_partner.invite_code` = 伙伴自己的邀请码（裂变传播用）；申请表记录"填写的推荐人码" + 校验后的 `inviter_partner_id`。

### 8.2 新表 `partner_application`（迁移 0006）

```
partner_application
├─ id BIGINT PK / uuid VARCHAR(64) UNIQUE          （雪花 ID 范式）
├─ tenant_id / organization_id                     （默认 0，数据隔离）
├─ applicant_user_id BIGINT NOT NULL               （申请人 IAM 用户，R9）
├─ applicant_type VARCHAR(16) NOT NULL             （INDIVIDUAL / ORGANIZATION）
├─ subject_name VARCHAR(256) NOT NULL DEFAULT ''   （主体名称，组织必填）
├─ contact_name VARCHAR(128) NOT NULL
├─ contact_phone VARCHAR(32) NOT NULL
├─ contact_email VARCHAR(256) NOT NULL
├─ target_level_no INTEGER NOT NULL DEFAULT 1      （意向等级，R4，仅意向）
├─ invite_code VARCHAR(64) NOT NULL DEFAULT ''     （填写的推荐人邀请码，原始输入）
├─ inviter_partner_id BIGINT                       （校验后锁定的推荐人，R5）
├─ business_intro VARCHAR(2000) NOT NULL DEFAULT ''
├─ status VARCHAR(16) NOT NULL DEFAULT 'SUBMITTED' （状态机 §4.2）
├─ reviewer_user_id BIGINT                         （审核人）
├─ review_comment VARCHAR(1024) NOT NULL DEFAULT ''（通过意见/拒绝原因）
├─ reviewed_at TIMESTAMPTZ
├─ approved_partner_id BIGINT                      （通过后生成的伙伴记录，闭环引用）
├─ created_at / updated_at
└─ deleted_at / deleted_by
```

关键索引：

- 部分唯一索引 `(tenant_id, organization_id, applicant_user_id) WHERE status = 'SUBMITTED'`（R2 防重复提交）；
- 查询索引 `(tenant_id, organization_id, status, created_at, id)`、`(tenant_id, organization_id, inviter_partner_id, id)`。

### 8.3 存量表最小扩展

- `partner_partner` 新增一列 `invite_code VARCHAR(64)` + 部分唯一索引（非空唯一）——伙伴自己的邀请码（D4 联动）；
- 其余零改动；`partner_audit_log` 承载申请提交/审核/撤回全程留痕。

---

## 9. 工程方案

### 9.1 sdkwork-partner-pc 新增独立 package（本任务核心交付）

**新包：`sdkwork-partner-pc-join`**（surface: app；domain: commerce；capability: join）

```
apps/sdkwork-partner-pc/packages/sdkwork-partner-pc-join/
├─ package.json                    （exports "." → src/index.tsx）
├─ specs/component.spec.json       （surface: app，声明 appClientFactory 端口）
└─ src/
   ├─ index.tsx                    （PartnerJoin：sectionId 路由 → Landing/Apply/Status）
   ├─ pages/landingPage.tsx        （营销落地页 §6.3）
   ├─ pages/applyPage.tsx          （申请表单 §6.4）
   ├─ pages/myApplicationPage.tsx  （我的申请 §6.5）
   ├─ services/partnerJoinService.ts（app SDK 封装 + 幂等提交）
   └─ i18n/{en-US,zh-CN}/commerce/partner-join/*.ts
```

**独立性保障（非 console / 非 admin 的工程含义）**：

1. 包内自带 `configurePartnerJoinAppClientFactory` 端口（对齐 `partner-pc-admin-core` 模式），宿主绑定会话 SDK client；
2. sdkwork-partner-pc 调试壳 `main.tsx` 增加「伙伴计划」独立 section 装配（壳内伙伴计划页使用独立导航区域，不混入 admin 导航）；
3. 包不依赖任何 admin/console 模块，仅依赖 app SDK 与基础组件约定；
4. 二期页面（自助端/推广中心）在同一包内按 sectionId 扩展，站点地图与 `/partner-join/*` 路由一一对应。

### 9.2 管理端审核页归属（决策点 D2）

- **推荐**：审核页作为新 page 扩展进现有 `sdkwork-partner-pc-admin-partner`（复用其列表/抽屉/服务层模式）——审核是 admin 内部支撑工具，不污染营销模块的"公众独立"定位；
- 备选：独立建 `sdkwork-partner-pc-admin-join`（若希望伙伴计划链路完全独立成包）。

### 9.3 Cloud Router PC 宿主集成

1. `pnpm-workspace.yaml` 增加 glob：`../sdkwork-partner/apps/sdkwork-partner-pc/packages/sdkwork-partner-pc-join`（及新 app SDK）；
2. 新增 host 包 `sdkwork-cloudrouter-pc-partner-join`：import `@sdkwork/partner-pc-join`，绑定会话 SDK client，导出路由元素；
3. `App.tsx` 增加**门户级公共路由**（不属于 `/console/*`、不属于 `/admin/*`）：
   - `/partner-join`（公开落地页）
   - `/partner-join/apply`、`/partner-join/status`（`RequirePortalSession` 包裹）
   - 公共路由使用门户布局（AppShellLayout），与 console/admin 布局隔离；
4. `Navbar.tsx` `navLinks` 增加 `{ name: t('nav.partnerJoin'), href: '/partner-join' }`（常驻）；
5. i18n `navigation.ts` 增加 `nav.partnerJoin` 双语键；
6. 管理端：`adminModuleRegistry.ts` 在 `partnerCenter` 增加 `/admin/partner/applications` 菜单项并装配审核页。

### 9.4 后端交付物（partner 仓库）

1. 新契约 `apis/app-api/partner/sdkwork-partner-app-api.openapi.json` + 扩展 backend-api 契约；
2. 新 Rust crate `sdkwork-routes-partner-app-api`；扩展 service/repository（申请事务、approve 事务）；`database/migrations` 新增 `partner_application` 表 + `partner_partner.invite_code`；
3. 新 SDK 家族 `sdks/sdkwork-partner-app-sdk/sdkwork-partner-app-sdk-typescript`；backend SDK 重新生成；
4. 装配：`sdkwork-api-partner-assembly` / 网关接入新面。

---

## 10. 分期与实施步骤

**一期（本期交付）**：营销入口 + 申请转化闭环 + 独立包

1. partner 仓库：契约（app-api + backend-api 增量）→ migration → Rust service/routes → SDK 生成；
2. partner-pc：新建 `sdkwork-partner-pc-join`（Landing/Apply/Status）+ 调试壳独立 section + admin-partner 审核页扩展；
3. cloudrouter：workspace glob、host 包、门户公共路由、Navbar 菜单 + i18n、adminModuleRegistry；
4. 验证：契约校验（check-api-operation-patterns）、typecheck、SDK 集成测试、端到端手测（浏览→提交→审核→加盟→状态流转）。

**二期（架构预留）**：伙伴自助端（推广链接/客户/收益/提现）、推广中心（物料/榜单/线索）、营销活动、在线加盟支付、企业资质材料上传。

---

## 11. 验收标准

- 门户 Header 显示「伙伴计划」，菜单常驻，未登录可浏览落地页；
- `/partner-join/*` 全部位于门户公共路由（不属于 `/console/*`、`/admin/*`）；
- 落地页/申请/我的申请完整走通（含移动端菜单）；收益测算与等级数据实时来自接口；
- 申请幂等：重复提交返回原记录；非终态申请拦截；
- 邀请码校验（有效/失效）正确；审核通过后事务内创建伙伴（绑用户、定等级、挂上级链、分配邀请码，status=PENDING 与 admin 创建一致），登记加盟费触发推荐人链级差提成，与现有引擎结果一致；
- 拒绝必填原因；重新申请为独立新记录；全程审计可查；
- 用户面与管理面 API 全部经 SDK 访问；int64 契约合规；
- 新包在 sdkwork-partner-pc 调试壳（独立导航区域）与 Cloud Router 门户宿主均可独立装配运行。

---

## 12. 决策记录（一期已全部定稿并实施）

| # | 决策点 | 结论 |
| --- | --- | --- |
| D1 | 门户 Header 菜单位置与可见性 | 常驻（未登录可见，落地页公开）✅ 已实施 |
| D2 | 管理端审核页归属 | 扩展 `admin-partner`（内部支撑工具）✅ 已实施 |
| D3 | 加盟费缴纳 | 一期沿用管理员登记（现状），在线支付二期 ✅ 已实施 |
| D4 | 邀请码/推荐人 | 一期做（`invite_code` 列 + 校验端点，裂变闭环完整）✅ 已实施 |
| D5 | 模块技术命名 | `sdkwork-partner-pc-join` / `/partner-join/*` / `/app/v3/api/partner_join/*` ✅ 已实施 |
| D6 | 申请等级范围 | 一期仅 L1–L3 直通，L4+ 管理员人工评估 ✅ 已实施 |
| D7 | 二期自助端/推广中心归属 | 同一包内按 sectionId 扩展（`sdkwork-partner-pc-join`）✅ 已定 |
| D8 | 申请数据模型 | 新表 `partner_application`（申请与经营实体分离；复用伙伴记录方案因 5 项缺陷被否决）✅ 已实施 |
| D9 | 伙伴实体表命名 | 保持 `partner_partner` 不变 ✅ 已定 |

---

## 13. 风险与合规

- **合规红线**：返佣仅按客户消费与加盟费计酬，禁止拉人头计酬；申请/审核/加盟全程审计留痕；
- **数据安全**：申请人联系方式仅审核管理员可见；邀请码不泄露申请人个人信息；
- **防套利**：一用户一有效申请（R2）、等级管控（R4/R6）、邀请码只绑关系不定等级（R5）、失效邀请码拦截（R12）；
- **兼容风险**：`approve` 复用现有伙伴创建逻辑，需与现有 admin 创建路径保持同一事务语义与校验（唯一键冲突、上级链环校验、申请置 APPROVED 与伙伴创建同事务）；
- **契约漂移**：app-api 为新面，纳入 cloudrouter SDK 集成规范与契约校验工具链；
- **营销合规**：落地页收益测算必须标注"利润返佣示例口径"，禁止承诺保底收益。
