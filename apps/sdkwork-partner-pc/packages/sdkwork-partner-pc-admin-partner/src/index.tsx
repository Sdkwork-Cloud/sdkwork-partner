import { AuditLogsPage } from './pages/auditLogsPage';
import { CustomersPage } from './pages/customersPage';
import { JoinFeePaymentsPage } from './pages/joinFeePaymentsPage';
import { PartnerHomePage } from './pages/partnerHomePage';
import { PartnersPage } from './pages/partnersPage';
import { PartnerTreePage } from './pages/partnerTreePage';

type PartnerAdminTab = 'home' | 'partners' | 'tree' | 'customers' | 'join-fees' | 'audit-logs';

const DEFAULT_TAB: PartnerAdminTab = 'home';

function resolveTab(sectionId: string | undefined): PartnerAdminTab {
  if (sectionId === 'partners') return 'partners';
  if (sectionId === 'tree') return 'tree';
  if (sectionId === 'customers') return 'customers';
  if (sectionId === 'join-fees') return 'join-fees';
  if (sectionId === 'audit-logs') return 'audit-logs';
  return DEFAULT_TAB;
}

export function PartnerAdmin({ sectionId }: { sectionId?: string } = {}) {
  const tab = resolveTab(sectionId);
  switch (tab) {
    case 'partners':
      return <PartnersPage />;
    case 'tree':
      return <PartnerTreePage />;
    case 'customers':
      return <CustomersPage />;
    case 'join-fees':
      return <JoinFeePaymentsPage />;
    case 'audit-logs':
      return <AuditLogsPage />;
    default:
      return <PartnerHomePage />;
  }
}
