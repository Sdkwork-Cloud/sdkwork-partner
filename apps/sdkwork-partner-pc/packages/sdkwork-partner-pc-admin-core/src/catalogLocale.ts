/**
 * Display localization for the commercial default level catalog (admin copy).
 *
 * The backend stores one locale's display text per deployment (seeded by
 * `database/seeds/locales/<locale>/001_levels_locale.sql`), so level names and
 * benefit text can disagree with the UI language. These tables translate the
 * known default catalog into the active UI locale; admin-customized names and
 * values never match the known pairs and fall back to the raw backend text.
 *
 * Shared by the admin domain packages (`admin-commission`, `admin-partner`).
 * Keep the data tables in sync with the join package's `catalogLocale.ts`
 * (app-surface copy).
 */
const ZH = 'zh-CN';
const EN = 'en-US';

/** Benefit shape needed for display localization (SDK-agnostic). */
export interface CatalogBenefit {
  code: string;
  name: string;
  value?: string | null;
}

/** Normalize an i18n language tag to the two catalog locales (or keep it raw). */
export function normalizeCatalogLocale(language: string | undefined): string {
  if (!language) return '';
  if (language.toLowerCase().startsWith('zh')) return ZH;
  if (language.toLowerCase().startsWith('en')) return EN;
  return language;
}

/** Known default level names, keyed by either locale's text. */
const LEVEL_DISPLAY: Record<string, { zh: string; en: string }> = {
  普通代理: { zh: '普通代理', en: 'Agent' },
  Agent: { zh: '普通代理', en: 'Agent' },
  银牌代理: { zh: '银牌代理', en: 'Silver Agent' },
  'Silver Agent': { zh: '银牌代理', en: 'Silver Agent' },
  金牌代理: { zh: '金牌代理', en: 'Gold Agent' },
  'Gold Agent': { zh: '金牌代理', en: 'Gold Agent' },
  战略代理: { zh: '战略代理', en: 'Strategic Agent' },
  'Strategic Agent': { zh: '战略代理', en: 'Strategic Agent' },
  城市合伙人: { zh: '城市合伙人', en: 'City Partner' },
  'City Partner': { zh: '城市合伙人', en: 'City Partner' },
  省级代理: { zh: '省级代理', en: 'Provincial Agent' },
  'Provincial Agent': { zh: '省级代理', en: 'Provincial Agent' },
  区域总代: { zh: '区域总代', en: 'Regional Distributor' },
  'Regional Distributor': { zh: '区域总代', en: 'Regional Distributor' },
};

/** Localize a level name; unknown names (admin-customized) stay raw. */
export function localizeLevelName(name: string, language: string): string {
  const entry = LEVEL_DISPLAY[name];
  if (!entry) return name;
  const locale = normalizeCatalogLocale(language);
  if (locale === ZH) return entry.zh;
  if (locale === EN) return entry.en;
  return name;
}

interface BenefitDisplay {
  zhName: string;
  enName: string;
  /** (zh, en) value pairs of the default catalog, level variants included. */
  values: ReadonlyArray<readonly [string, string]>;
}

/** Known default benefit displays, keyed by the stable benefit code. */
const BENEFIT_DISPLAY: Record<string, BenefitDisplay> = {
  commission_pool: {
    zhName: '客户消费返佣池',
    enName: 'Customer revenue commission pool',
    values: [
      ['客户收益利润 10% 返佣', '10% of customer profit (revenue × margin)'],
      ['客户收益利润 12% 返佣', '12% of customer profit (revenue × margin)'],
      ['客户收益利润 15% 返佣', '15% of customer profit (revenue × margin)'],
      ['客户收益利润 18% 返佣', '18% of customer profit (revenue × margin)'],
      ['客户收益利润 22% 返佣', '22% of customer profit (revenue × margin)'],
      ['客户收益利润 26% 返佣', '26% of customer profit (revenue × margin)'],
      ['客户收益利润 30% 返佣', '30% of customer profit (revenue × margin)'],
    ],
  },
  referral_link: {
    zhName: '专属推广链接',
    enName: 'Exclusive referral link',
    values: [['独立推广链接与客户归属追踪', 'Track and attribute every customer']],
  },
  marketing_kit: {
    zhName: '宣传物料模板',
    enName: 'Marketing kit templates',
    values: [['横幅、海报与推广文案模板', 'Banners, posters, and copy templates']],
  },
  onboarding_training: {
    zhName: '新手培训课程',
    enName: 'Onboarding training',
    values: [['自学式入驻培训视频课程', 'Self-paced onboarding video course']],
  },
  online_support: {
    zhName: '标准在线客服',
    enName: 'Standard online support',
    values: [['工作时间在线客服支持', 'Business-hours chat support']],
  },
  performance_rank: {
    zhName: '业绩榜单展示',
    enName: 'Performance leaderboard',
    values: [['月度伙伴业绩榜单曝光', 'Monthly partner ranking exposure']],
  },
  advanced_training: {
    zhName: '进阶培训课程',
    enName: 'Advanced training',
    values: [['销售与产品深度进阶课程', 'Sales and product deep-dive courses']],
  },
  leads_monthly: {
    zhName: '商机线索',
    enName: 'Qualified leads',
    values: [
      ['每月 3 条优质商机线索', '3 qualified leads per month'],
      ['每月 10 条优质商机线索', '10 qualified leads per month'],
    ],
  },
  tech_sla: {
    zhName: '技术支持 SLA',
    enName: 'Technical support SLA',
    values: [['次日响应的技术支持服务', 'Next-business-day technical support']],
  },
  account_manager: {
    zhName: '专属客户经理',
    enName: 'Dedicated account manager',
    values: [
      ['一对一专属客户经理支持', '1:1 account manager support'],
      ['优先级一对一专属客户经理', 'Priority 1:1 account manager'],
    ],
  },
  region_protection: {
    zhName: '城市区域保护',
    enName: 'City region protection',
    values: [['所属城市市场保护', 'Protected territory for your city']],
  },
  annual_rebate: {
    zhName: '年度阶梯返利',
    enName: 'Annual tiered rebate',
    values: [['年度业绩达标额外返利', 'Extra rebate at annual sales tiers']],
  },
  certification: {
    zhName: '代理认证证书',
    enName: 'Partner certification',
    values: [['官方认证伙伴标识', 'Official agent certification badge']],
  },
  co_marketing: {
    zhName: '联合营销支持',
    enName: 'Co-marketing support',
    values: [['联合营销活动与联合品牌资源', 'Joint campaigns and co-branded assets']],
  },
  quarterly_incentive: {
    zhName: '季度激励计划',
    enName: 'Quarterly incentive plan',
    values: [['业绩达标季度奖金', 'Performance-based quarterly bonus']],
  },
  trade_show: {
    zhName: '行业展会名额',
    enName: 'Industry event slots',
    values: [['行业展会与活动名额', 'Exhibition and event allocation']],
  },
  custom_solution: {
    zhName: '定制解决方案',
    enName: 'Custom solutions',
    values: [['定制化方案咨询支持', 'Tailored solution consulting']],
  },
  priority_settlement: {
    zhName: '优先结算',
    enName: 'Priority settlement',
    values: [['更快的返佣结算周期', 'Faster commission settlement cycles']],
  },
  city_exclusive: {
    zhName: '城市独家授权',
    enName: 'City exclusivity',
    values: [['所属城市独家经营授权', 'Exclusive rights for your city']],
  },
  leads_priority: {
    zhName: '商机池优先分配',
    enName: 'Priority lead pool',
    values: [
      ['每月 20 条优先商机线索', '20 priority leads per month'],
      ['每月 50 条优先商机线索', '50 priority leads per month'],
    ],
  },
  co_branding: {
    zhName: '联合市场投放',
    enName: 'Co-branded campaigns',
    values: [['总部共担的联合品牌投放', 'Joint market investment with HQ']],
  },
  dedicated_api: {
    zhName: '专属 API 通道',
    enName: 'Dedicated API channel',
    values: [['专属 API 通道与容量保障', 'Exclusive API access and capacity']],
  },
  annual_summit: {
    zhName: '年度伙伴峰会',
    enName: 'Annual partner summit',
    values: [['年度伙伴峰会邀请', 'Invitation to the annual partner summit']],
  },
  express_settlement: {
    zhName: '快速结算通道',
    enName: 'Express settlement',
    values: [['更快的返佣结算通道', 'Faster settlement via express channel']],
  },
  province_exclusive: {
    zhName: '省级区域保护',
    enName: 'Province exclusivity',
    values: [['所属省域市场保护', 'Protected territory across your province']],
  },
  presales_consultant: {
    zhName: '专属售前方案顾问',
    enName: 'Dedicated presales consultant',
    values: [['企业级大单方案咨询支持', 'Solution consulting for enterprise deals']],
  },
  solution_architect: {
    zhName: '专属技术架构师',
    enName: 'Solution architect',
    values: [['大型项目架构支持', 'Architecture support for large deals']],
  },
  private_deploy: {
    zhName: '私有化部署支持',
    enName: 'Private deployment support',
    values: [['私有化/定制部署交付支持', 'Private or custom deployment delivery']],
  },
  channel_conference: {
    zhName: '省级渠道大会主办',
    enName: 'Province channel conference',
    values: [['省级渠道活动主办权', 'Host province channel events']],
  },
  region_exclusive: {
    zhName: '大区独家授权',
    enName: 'Regional exclusivity',
    values: [['所属大区独家经销授权', 'Exclusive distribution rights for your region']],
  },
  region_allowance: {
    zhName: '区域管理津贴',
    enName: 'Regional management allowance',
    values: [['下级渠道业绩管理津贴', 'Allowance on downstream channel performance']],
  },
  joint_solution: {
    zhName: '联合解决方案共建',
    enName: 'Joint solution building',
    values: [['与总部联合立项共建方案', 'Co-build solutions with HQ']],
  },
  rnd_access: {
    zhName: '专属研发资源通道',
    enName: 'R&D resource channel',
    values: [['专属研发支持通道', 'Dedicated R&D support channel']],
  },
  custom_sla: {
    zhName: '定制级 SLA 合同',
    enName: 'Custom SLA contract',
    values: [['协商定制服务等级协议', 'Negotiated service-level agreement']],
  },
  summit_host: {
    zhName: '年度峰会主办/演讲',
    enName: 'Annual summit host',
    values: [['年度伙伴峰会主办与演讲权', 'Host or keynote at the annual partner summit']],
  },
  equity_plan: {
    zhName: '战略投资/期权计划',
    enName: 'Strategic equity plan',
    values: [['战略投资或期权激励计划', 'Investment or equity incentive plan']],
  },
};

/**
 * Localize a benefit of the default catalog. The name is translated by its
 * stable code when the backend text still matches a known default name; the
 * value is translated only on an exact pair match. Anything admin-customized
 * is returned unchanged.
 */
export function localizeBenefit(
  benefit: Pick<CatalogBenefit, 'code' | 'name' | 'value'>,
  language: string,
): { name: string; value: string } {
  const display = BENEFIT_DISPLAY[benefit.code];
  const locale = normalizeCatalogLocale(language);
  const rawValue = benefit.value ?? '';
  if (!display) return { name: benefit.name, value: rawValue };
  const name =
    benefit.name === display.zhName || benefit.name === display.enName
      ? locale === ZH
        ? display.zhName
        : locale === EN
          ? display.enName
          : benefit.name
      : benefit.name;
  const pair = display.values.find(([zh, en]) => rawValue === zh || rawValue === en);
  const value = pair
    ? locale === ZH
      ? pair[0]
      : locale === EN
        ? pair[1]
        : rawValue
    : rawValue;
  return { name, value };
}
