-- 001_levels_locale.sql
-- sdkwork:seed-locale
-- module: partner
-- locale: zh-CN
-- purpose: overwrite the common (English) level catalog display fields with
--   Simplified Chinese text so the installed default locale shows the
--   localized commercial ladder. Re-seeding is idempotent; rows keyed by the
--   fixed seed primary keys.
--
-- 默认等级体系（7 级，级差制返佣，全员付费加盟 ¥5,999 起）：
--   L1 普通代理 -> L2 银牌代理 -> L3 金牌代理 -> L4 战略代理
--   -> L5 城市合伙人 -> L6 省级代理 -> L7 区域总代
-- 权益按 返佣权益 / 成长赋能 / 运营支持 / 市场激励 / 战略共建 五类规划。
-- 完整运营与销售方案见 docs/product/ops/partner-tier-program.md。

UPDATE partner_level SET name = '普通代理', updated_at = CURRENT_TIMESTAMP WHERE id = 1001;
UPDATE partner_level SET name = '银牌代理', updated_at = CURRENT_TIMESTAMP WHERE id = 1002;
UPDATE partner_level SET name = '金牌代理', updated_at = CURRENT_TIMESTAMP WHERE id = 1003;
UPDATE partner_level SET name = '战略代理', updated_at = CURRENT_TIMESTAMP WHERE id = 1004;
UPDATE partner_level SET name = '城市合伙人', updated_at = CURRENT_TIMESTAMP WHERE id = 1005;
UPDATE partner_level SET name = '省级代理', updated_at = CURRENT_TIMESTAMP WHERE id = 1006;
UPDATE partner_level SET name = '区域总代', updated_at = CURRENT_TIMESTAMP WHERE id = 1007;

-- L1 普通代理（¥5,999 加盟费，入门分销档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 10% 返佣","sort":1},' ||
               '{"code":"referral_link","name":"专属推广链接","value":"独立推广链接与客户归属追踪","sort":2},' ||
               '{"code":"marketing_kit","name":"宣传物料模板","value":"横幅、海报与推广文案模板","sort":3},' ||
               '{"code":"onboarding_training","name":"新手培训课程","value":"自学式入驻培训视频课程","sort":4},' ||
               '{"code":"online_support","name":"标准在线客服","value":"工作时间在线客服支持","sort":5}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1001;

-- L2 银牌代理（¥9,999 加盟费，业绩成长档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 12% 返佣","sort":1},' ||
               '{"code":"performance_rank","name":"业绩榜单展示","value":"月度伙伴业绩榜单曝光","sort":2},' ||
               '{"code":"advanced_training","name":"进阶培训课程","value":"销售与产品深度进阶课程","sort":3},' ||
               '{"code":"leads_monthly","name":"商机线索","value":"每月 3 条优质商机线索","sort":4},' ||
               '{"code":"tech_sla","name":"技术支持 SLA","value":"次日响应的技术支持服务","sort":5}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1002;

-- L3 金牌代理（¥19,999 加盟费，核心渠道主力档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 15% 返佣","sort":1},' ||
               '{"code":"account_manager","name":"专属客户经理","value":"一对一专属客户经理支持","sort":2},' ||
               '{"code":"leads_monthly","name":"商机线索","value":"每月 10 条优质商机线索","sort":3},' ||
               '{"code":"region_protection","name":"城市区域保护","value":"所属城市市场保护","sort":4},' ||
               '{"code":"annual_rebate","name":"年度阶梯返利","value":"年度业绩达标额外返利","sort":5},' ||
               '{"code":"certification","name":"代理认证证书","value":"官方认证伙伴标识","sort":6}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1003;

-- L4 战略代理（¥49,999 加盟费，区域经营高价值档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 18% 返佣","sort":1},' ||
               '{"code":"account_manager","name":"专属客户经理","value":"优先级一对一专属客户经理","sort":2},' ||
               '{"code":"co_marketing","name":"联合营销支持","value":"联合营销活动与联合品牌资源","sort":3},' ||
               '{"code":"quarterly_incentive","name":"季度激励计划","value":"业绩达标季度奖金","sort":4},' ||
               '{"code":"trade_show","name":"行业展会名额","value":"行业展会与活动名额","sort":5},' ||
               '{"code":"custom_solution","name":"定制解决方案","value":"定制化方案咨询支持","sort":6},' ||
               '{"code":"priority_settlement","name":"优先结算","value":"更快的返佣结算周期","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1004;

-- L5 城市合伙人（¥99,999 加盟费，城市独家经营档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 22% 返佣","sort":1},' ||
               '{"code":"city_exclusive","name":"城市独家授权","value":"所属城市独家经营授权","sort":2},' ||
               '{"code":"leads_priority","name":"商机池优先分配","value":"每月 20 条优先商机线索","sort":3},' ||
               '{"code":"co_branding","name":"联合市场投放","value":"总部共担的联合品牌投放","sort":4},' ||
               '{"code":"dedicated_api","name":"专属 API 通道","value":"专属 API 通道与容量保障","sort":5},' ||
               '{"code":"annual_summit","name":"年度伙伴峰会","value":"年度伙伴峰会邀请","sort":6},' ||
               '{"code":"express_settlement","name":"快速结算通道","value":"更快的返佣结算通道","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1005;

-- L6 省级代理（¥199,999 加盟费，省域运营与渠道管理档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 26% 返佣","sort":1},' ||
               '{"code":"province_exclusive","name":"省级区域保护","value":"所属省域市场保护","sort":2},' ||
               '{"code":"leads_priority","name":"商机池优先分配","value":"每月 50 条优先商机线索","sort":3},' ||
               '{"code":"presales_consultant","name":"专属售前方案顾问","value":"企业级大单方案咨询支持","sort":4},' ||
               '{"code":"solution_architect","name":"专属技术架构师","value":"大型项目架构支持","sort":5},' ||
               '{"code":"private_deploy","name":"私有化部署支持","value":"私有化/定制部署交付支持","sort":6},' ||
               '{"code":"channel_conference","name":"省级渠道大会主办","value":"省级渠道活动主办权","sort":7}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1006;

-- L7 区域总代（¥499,999 加盟费，大区总经销深度共建档）
UPDATE partner_level SET
    benefits = ('[{"code":"commission_pool","name":"客户消费返佣池","value":"客户收益利润 30% 返佣","sort":1},' ||
               '{"code":"region_exclusive","name":"大区独家授权","value":"所属大区独家经销授权","sort":2},' ||
               '{"code":"region_allowance","name":"区域管理津贴","value":"下级渠道业绩管理津贴","sort":3},' ||
               '{"code":"joint_solution","name":"联合解决方案共建","value":"与总部联合立项共建方案","sort":4},' ||
               '{"code":"rnd_access","name":"专属研发资源通道","value":"专属研发支持通道","sort":5},' ||
               '{"code":"custom_sla","name":"定制级 SLA 合同","value":"协商定制服务等级协议","sort":6},' ||
               '{"code":"summit_host","name":"年度峰会主办/演讲","value":"年度伙伴峰会主办与演讲权","sort":7},' ||
               '{"code":"equity_plan","name":"战略投资/期权计划","value":"战略投资或期权激励计划","sort":8}]')::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1007;
