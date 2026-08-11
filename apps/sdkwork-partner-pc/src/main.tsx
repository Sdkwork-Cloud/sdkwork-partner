import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { configurePartnerSearchPort, getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import { PartnerAdmin } from '@sdkwork/partner-pc-admin-partner';
import { CommissionAdmin } from '@sdkwork/partner-pc-admin-commission';
import { WithdrawalAdmin } from '@sdkwork/partner-pc-admin-withdrawal';
import { StatsAdmin } from '@sdkwork/partner-pc-admin-stats';
import { adminPartnerMessages } from '@sdkwork/partner-pc-admin-partner/i18n';
import { adminCommissionMessages } from '@sdkwork/partner-pc-admin-commission/i18n';
import { adminWithdrawalMessages } from '@sdkwork/partner-pc-admin-withdrawal/i18n';
import { adminStatsMessages } from '@sdkwork/partner-pc-admin-stats/i18n';
import './index.css';

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
  | 'stats';

const NAV: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'home', label: '工作台' },
  { id: 'partners', label: '合作伙伴' },
  { id: 'customers', label: '客户管理' },
  { id: 'tree', label: '代理树' },
  { id: 'levels', label: '等级' },
  { id: 'config', label: '提成配置' },
  { id: 'events', label: '收益事件' },
  { id: 'ledger', label: '收益流水' },
  { id: 'join-fees', label: '加盟费' },
  { id: 'withdrawals', label: '提现管理' },
  { id: 'stats', label: '业绩统计' },
  { id: 'audit-logs', label: '操作审计' },
];

function AppShell() {
  const [section, setSection] = useState<Section>('home');
  return (
    <main className="h-screen bg-slate-50 p-6 dark:bg-[#0a0a0a]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">SDKWork Partner PC</h1>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        多级合作伙伴（代理商）管理体系 — 独立调试壳；生产页面由宿主应用装配。
      </p>
      <nav className="mb-4 flex flex-wrap gap-2">
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
            {item.label}
          </button>
        ))}
      </nav>
      <div className="h-[calc(100%-8rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
        {section === 'home' ? <PartnerAdmin sectionId="home" /> : null}
        {section === 'partners' ? <PartnerAdmin sectionId="partners" /> : null}
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
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
