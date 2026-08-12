//! Commercial default level catalog (单一事实源).
//!
//! This is the single source of truth for the seven-tier agency pyramid used
//! by both the install-time seed (`database/seeds/common/001_bootstrap.sql`,
//! locale files in `database/seeds/locales/<locale>/`) and the admin
//! "restore defaults" operation (`restore_default_levels`). Keep the seed SQL
//! and these constants in sync: names, ratios, join fees, and the benefit
//! ladder must match what `001_levels_locale.sql` (zh-CN) produces.
//!
//! Tier design and go-to-market plan: `docs/product/ops/partner-tier-program.md`.

use crate::commands::LevelBenefitItem;

/// One default level definition.
#[derive(Clone, Debug)]
pub struct DefaultLevelCatalogEntry {
    pub level_no: i32,
    /// zh-CN display name (matches the zh-CN locale seed).
    pub name: &'static str,
    /// Customer revenue commission pool, per-10000 (10% -> 1000).
    pub customer_revenue_ratio_per_10000: i64,
    /// Join-fee commission pool, per-10000 (8% -> 800).
    pub join_fee_commission_ratio_per_10000: i64,
    /// Join fee in integer minor units (¥5,999 -> 599900).
    pub join_fee_cents: i64,
    pub sort_order: i32,
    /// (code, name, value, sort) tuples; converted on demand.
    pub benefits: &'static [(&'static str, &'static str, &'static str, i32)],
}

impl DefaultLevelCatalogEntry {
    /// Converts the const tuple ladder into validated benefit items.
    pub fn benefits_as_items(&self) -> Vec<LevelBenefitItem> {
        self.benefits
            .iter()
            .map(|(code, name, value, sort)| {
                LevelBenefitItem::new(code, name, Some(value), *sort)
                    .expect("static catalog benefit")
            })
            .collect()
    }
}

/// Seven-tier agency pyramid with paid onboarding from ¥5,999.
pub static DEFAULT_LEVEL_CATALOG: &[DefaultLevelCatalogEntry] = &[
    DefaultLevelCatalogEntry {
        level_no: 1,
        name: "普通代理",
        customer_revenue_ratio_per_10000: 1000,
        join_fee_commission_ratio_per_10000: 800,
        join_fee_cents: 599_900,
        sort_order: 1,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 10% 返佣",
                1,
            ),
            (
                "referral_link",
                "专属推广链接",
                "独立推广链接与客户归属追踪",
                2,
            ),
            (
                "marketing_kit",
                "宣传物料模板",
                "横幅、海报与推广文案模板",
                3,
            ),
            (
                "onboarding_training",
                "新手培训课程",
                "自学式入驻培训视频课程",
                4,
            ),
            ("online_support", "标准在线客服", "工作时间在线客服支持", 5),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 2,
        name: "银牌代理",
        customer_revenue_ratio_per_10000: 1200,
        join_fee_commission_ratio_per_10000: 1000,
        join_fee_cents: 999_900,
        sort_order: 2,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 12% 返佣",
                1,
            ),
            (
                "performance_rank",
                "业绩榜单展示",
                "月度伙伴业绩榜单曝光",
                2,
            ),
            (
                "advanced_training",
                "进阶培训课程",
                "销售与产品深度进阶课程",
                3,
            ),
            ("leads_monthly", "商机线索", "每月 3 条优质商机线索", 4),
            ("tech_sla", "技术支持 SLA", "次日响应的技术支持服务", 5),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 3,
        name: "金牌代理",
        customer_revenue_ratio_per_10000: 1500,
        join_fee_commission_ratio_per_10000: 1200,
        join_fee_cents: 1_999_900,
        sort_order: 3,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 15% 返佣",
                1,
            ),
            (
                "account_manager",
                "专属客户经理",
                "一对一专属客户经理支持",
                2,
            ),
            ("leads_monthly", "商机线索", "每月 10 条优质商机线索", 3),
            ("region_protection", "城市区域保护", "所属城市市场保护", 4),
            ("annual_rebate", "年度阶梯返利", "年度业绩达标额外返利", 5),
            ("certification", "代理认证证书", "官方认证伙伴标识", 6),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 4,
        name: "战略代理",
        customer_revenue_ratio_per_10000: 1800,
        join_fee_commission_ratio_per_10000: 1400,
        join_fee_cents: 4_999_900,
        sort_order: 4,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 18% 返佣",
                1,
            ),
            (
                "account_manager",
                "专属客户经理",
                "优先级一对一专属客户经理",
                2,
            ),
            (
                "co_marketing",
                "联合营销支持",
                "联合营销活动与联合品牌资源",
                3,
            ),
            ("quarterly_incentive", "季度激励计划", "业绩达标季度奖金", 4),
            ("trade_show", "行业展会名额", "行业展会与活动名额", 5),
            ("custom_solution", "定制解决方案", "定制化方案咨询支持", 6),
            ("priority_settlement", "优先结算", "更快的返佣结算周期", 7),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 5,
        name: "城市合伙人",
        customer_revenue_ratio_per_10000: 2200,
        join_fee_commission_ratio_per_10000: 1600,
        join_fee_cents: 9_999_900,
        sort_order: 5,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 22% 返佣",
                1,
            ),
            ("city_exclusive", "城市独家授权", "所属城市独家经营授权", 2),
            (
                "leads_priority",
                "商机池优先分配",
                "每月 20 条优先商机线索",
                3,
            ),
            ("co_branding", "联合市场投放", "总部共担的联合品牌投放", 4),
            (
                "dedicated_api",
                "专属 API 通道",
                "专属 API 通道与容量保障",
                5,
            ),
            ("annual_summit", "年度伙伴峰会", "年度伙伴峰会邀请", 6),
            (
                "express_settlement",
                "快速结算通道",
                "更快的返佣结算通道",
                7,
            ),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 6,
        name: "省级代理",
        customer_revenue_ratio_per_10000: 2600,
        join_fee_commission_ratio_per_10000: 1800,
        join_fee_cents: 19_999_900,
        sort_order: 6,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 26% 返佣",
                1,
            ),
            ("province_exclusive", "省级区域保护", "所属省域市场保护", 2),
            (
                "leads_priority",
                "商机池优先分配",
                "每月 50 条优先商机线索",
                3,
            ),
            (
                "presales_consultant",
                "专属售前方案顾问",
                "企业级大单方案咨询支持",
                4,
            ),
            (
                "solution_architect",
                "专属技术架构师",
                "大型项目架构支持",
                5,
            ),
            (
                "private_deploy",
                "私有化部署支持",
                "私有化/定制部署交付支持",
                6,
            ),
            (
                "channel_conference",
                "省级渠道大会主办",
                "省级渠道活动主办权",
                7,
            ),
        ],
    },
    DefaultLevelCatalogEntry {
        level_no: 7,
        name: "区域总代",
        customer_revenue_ratio_per_10000: 3000,
        join_fee_commission_ratio_per_10000: 2000,
        join_fee_cents: 49_999_900,
        sort_order: 7,
        benefits: &[
            (
                "commission_pool",
                "客户消费返佣池",
                "客户收益利润 30% 返佣",
                1,
            ),
            (
                "region_exclusive",
                "大区独家授权",
                "所属大区独家经销授权",
                2,
            ),
            (
                "region_allowance",
                "区域管理津贴",
                "下级渠道业绩管理津贴",
                3,
            ),
            (
                "joint_solution",
                "联合解决方案共建",
                "与总部联合立项共建方案",
                4,
            ),
            ("rnd_access", "专属研发资源通道", "专属研发支持通道", 5),
            ("custom_sla", "定制级 SLA 合同", "协商定制服务等级协议", 6),
            (
                "summit_host",
                "年度峰会主办/演讲",
                "年度伙伴峰会主办与演讲权",
                7,
            ),
            (
                "equity_plan",
                "战略投资/期权计划",
                "战略投资或期权激励计划",
                8,
            ),
        ],
    },
];
