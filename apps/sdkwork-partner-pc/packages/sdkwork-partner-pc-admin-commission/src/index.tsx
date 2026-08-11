import { ConfigPage } from './pages/configPage';
import { EventsPage } from './pages/eventsPage';
import { LedgerPage } from './pages/ledgerPage';
import { LevelsPage } from './pages/levelsPage';

type CommissionAdminTab = 'levels' | 'config' | 'events' | 'ledger';

const DEFAULT_TAB: CommissionAdminTab = 'levels';

function resolveTab(sectionId: string | undefined): CommissionAdminTab {
  if (sectionId === 'config') return 'config';
  if (sectionId === 'events') return 'events';
  if (sectionId === 'ledger') return 'ledger';
  return 'levels';
}

export function CommissionAdmin({ sectionId }: { sectionId?: string } = {}) {
  const tab = resolveTab(sectionId);
  switch (tab) {
    case 'config':
      return <ConfigPage />;
    case 'events':
      return <EventsPage />;
    case 'ledger':
      return <LedgerPage />;
    default:
      return <LevelsPage />;
  }
}
