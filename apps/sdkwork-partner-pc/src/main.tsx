import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PartnerAdmin } from '@sdkwork/partner-pc-admin-partner';
import { CommissionAdmin } from '@sdkwork/partner-pc-admin-commission';
import { WithdrawalAdmin } from '@sdkwork/partner-pc-admin-withdrawal';
import { StatsAdmin } from '@sdkwork/partner-pc-admin-stats';

type Section = 'partners' | 'levels' | 'withdrawals' | 'stats';

const NAV: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'partners', label: '合作伙伴' },
  { id: 'levels', label: '等级与提成' },
  { id: 'withdrawals', label: '提现管理' },
  { id: 'stats', label: '业绩统计' },
];

function AppShell() {
  const [section, setSection] = useState<Section>('partners');
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>SDKWork Partner PC</h1>
      <p>多级合作伙伴（代理商）管理体系 — 独立调试壳；生产页面由宿主应用装配。</p>
      <nav style={{ marginBottom: 24 }}>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            style={{ marginRight: 8, fontWeight: section === item.id ? 700 : 400 }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {section === 'partners' ? <PartnerAdmin /> : null}
      {section === 'levels' ? <CommissionAdmin /> : null}
      {section === 'withdrawals' ? <WithdrawalAdmin /> : null}
      {section === 'stats' ? <StatsAdmin /> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
