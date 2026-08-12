import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { configurePartnerSearchPort, getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import { adminCoreMessages } from '@sdkwork/partner-pc-admin-core/i18n';
import { PartnerAdmin } from '@sdkwork/partner-pc-admin-partner';
import { CommissionAdmin } from '@sdkwork/partner-pc-admin-commission';
import { WithdrawalAdmin } from '@sdkwork/partner-pc-admin-withdrawal';
import { StatsAdmin } from '@sdkwork/partner-pc-admin-stats';
import { adminPartnerMessages } from '@sdkwork/partner-pc-admin-partner/i18n';
import { adminCommissionMessages } from '@sdkwork/partner-pc-admin-commission/i18n';
import { adminWithdrawalMessages } from '@sdkwork/partner-pc-admin-withdrawal/i18n';
import { adminStatsMessages } from '@sdkwork/partner-pc-admin-stats/i18n';
import { PartnerJoin } from '@sdkwork/partner-pc-join';
import { partnerJoinMessages } from '@sdkwork/partner-pc-join/i18n';
import './index.css';

const shellMessages = {
  en: {
    'shell.description': 'Multi-level partner (agency) management — standalone debug shell; production pages are assembled by the host application.',
    'shell.nav.home': 'Home',
    'shell.nav.partners': 'Partners',
    'shell.nav.customers': 'Customers',
    'shell.nav.tree': 'Partner Tree',
    'shell.nav.levels': 'Levels',
    'shell.nav.config': 'Commission Config',
    'shell.nav.events': 'Revenue Events',
    'shell.nav.ledger': 'Ledger',
    'shell.nav.joinFees': 'Join Fees',
    'shell.nav.withdrawals': 'Withdrawals',
    'shell.nav.stats': 'Stats',
    'shell.nav.auditLogs': 'Audit Log',
    'shell.nav.applications': 'Join Applications',
    'shell.nav.join.title': 'Partner Join',
    'shell.nav.join.landing': 'Landing',
    'shell.nav.join.apply': 'Apply',
    'shell.nav.join.status': 'Status',
  },
  zh: {
    'shell.description': '多级合作伙伴（代理商）管理体系 — 独立调试壳；生产页面由宿主应用装配。',
    'shell.nav.home': '工作台',
    'shell.nav.partners': '合作伙伴',
    'shell.nav.customers': '客户管理',
    'shell.nav.tree': '代理树',
    'shell.nav.levels': '等级',
    'shell.nav.config': '提成配置',
    'shell.nav.events': '收益事件',
    'shell.nav.ledger': '收益流水',
    'shell.nav.joinFees': '加盟费',
    'shell.nav.withdrawals': '提现管理',
    'shell.nav.stats': '业绩统计',
    'shell.nav.auditLogs': '操作审计',
    'shell.nav.applications': '伙伴计划申请',
    'shell.nav.join.title': '伙伴计划',
    'shell.nav.join.landing': '活动页',
    'shell.nav.join.apply': '申请',
    'shell.nav.join.status': '进度查询',
  },
};

type Section =
  | 'home'
  | 'partners'
  | 'customers'
  | 'tree'
  | 'join-fees'
  | 'audit-logs'
  | 'levels'
  | 'config'
  | 'events'
  | 'ledger'
  | 'withdrawals'
  | 'stats'
  | 'applications'
  | 'join-landing'
  | 'join-apply'
  | 'join-status';

// Standalone shells bind the partner directory search so customer-binding and
// transfer forms offer a searchable partner picker (default dev client).
configurePartnerSearchPort(async (keyword) => {
  const page = await getPartnerBackendClient().partners.list({ page: 1, pageSize: 20, q: keyword });
  return page.items.map((item) => ({ id: item.id, name: item.name, levelNo: item.levelNo }));
});

const bundles = [
  adminPartnerMessages,
  adminCommissionMessages,
  adminWithdrawalMessages,
  adminStatsMessages,
  adminCoreMessages,
  partnerJoinMessages,
  shellMessages,
];

const resources: Record<string, Record<string, string>> = { en: {}, 'zh-CN': {} };
for (const bundle of bundles) {
  for (const locale of ['en', 'zh-CN'] as const) {
    const messages = bundle[locale === 'en' ? 'en' : 'zh'];
    for (const [key, value] of Object.entries(messages)) {
      resources[locale][key] = value;
    }
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-CN',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const NAV: ReadonlyArray<{ id: Section; labelKey: string }> = [
  { id: 'home', labelKey: 'shell.nav.home' },
  { id: 'partners', labelKey: 'shell.nav.partners' },
  { id: 'applications', labelKey: 'shell.nav.applications' },
  { id: 'customers', labelKey: 'shell.nav.customers' },
  { id: 'tree', labelKey: 'shell.nav.tree' },
  { id: 'levels', labelKey: 'shell.nav.levels' },
  { id: 'config', labelKey: 'shell.nav.config' },
  { id: 'events', labelKey: 'shell.nav.events' },
  { id: 'ledger', labelKey: 'shell.nav.ledger' },
  { id: 'join-fees', labelKey: 'shell.nav.joinFees' },
  { id: 'withdrawals', labelKey: 'shell.nav.withdrawals' },
  { id: 'stats', labelKey: 'shell.nav.stats' },
  { id: 'audit-logs', labelKey: 'shell.nav.auditLogs' },
];

const JOIN_NAV: ReadonlyArray<{ id: Section; labelKey: string }> = [
  { id: 'join-landing', labelKey: 'shell.nav.join.landing' },
  { id: 'join-apply', labelKey: 'shell.nav.join.apply' },
  { id: 'join-status', labelKey: 'shell.nav.join.status' },
];

function AppShell() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('home');
  return (
    <main className="flex h-screen flex-col gap-3 overflow-hidden bg-slate-50 p-6 dark:bg-[#0a0a0a]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">SDKWork Partner PC</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t('shell.description', {
          defaultValue: 'Multi-level partner (agency) management — standalone debug shell; production pages are assembled by the host application.',
        })}
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Partner admin">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              section === item.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-[#171717] dark:text-slate-200 dark:hover:bg-white/10'
            }`}
          >
            {t(item.labelKey, { defaultValue: item.labelKey })}
          </button>
        ))}
      </nav>
      <nav className="flex flex-wrap items-center gap-2" aria-label={t('shell.nav.join.title', { defaultValue: 'Partner join' })}>
        <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {t('shell.nav.join.title', { defaultValue: 'Partner Join' })}
        </span>
        {JOIN_NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              section === item.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-[#171717] dark:text-slate-200 dark:hover:bg-white/10'
            }`}
          >
            {t(item.labelKey, { defaultValue: item.labelKey })}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
        {section === 'home' ? <PartnerAdmin sectionId="home" /> : null}
        {section === 'partners' ? <PartnerAdmin sectionId="partners" /> : null}
        {section === 'applications' ? <PartnerAdmin sectionId="applications" /> : null}
        {section === 'customers' ? <PartnerAdmin sectionId="customers" /> : null}
        {section === 'tree' ? <PartnerAdmin sectionId="tree" /> : null}
        {section === 'join-fees' ? <PartnerAdmin sectionId="join-fees" /> : null}
        {section === 'audit-logs' ? <PartnerAdmin sectionId="audit-logs" /> : null}
        {section === 'levels' ? <CommissionAdmin sectionId="levels" /> : null}
        {section === 'config' ? <CommissionAdmin sectionId="config" /> : null}
        {section === 'events' ? <CommissionAdmin sectionId="events" /> : null}
        {section === 'ledger' ? <CommissionAdmin sectionId="ledger" /> : null}
        {section === 'withdrawals' ? <WithdrawalAdmin /> : null}
        {section === 'stats' ? <StatsAdmin /> : null}
        {section === 'join-landing' ? <PartnerJoin sectionId="landing" /> : null}
        {section === 'join-apply' ? <PartnerJoin sectionId="apply" /> : null}
        {section === 'join-status' ? <PartnerJoin sectionId="status" /> : null}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
