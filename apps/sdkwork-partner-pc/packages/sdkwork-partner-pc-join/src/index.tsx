import { useEffect, useState } from 'react';
import { ApplyPage } from './pages/applyPage';
import { LandingPage } from './pages/landingPage';
import { MyApplicationPage } from './pages/myApplicationPage';

export type PartnerJoinSection = 'landing' | 'apply' | 'status';

export {
  configurePartnerJoinAppClientFactory,
  configurePartnerJoinSdkClient,
  createPartnerJoinClient,
  getPartnerJoinClient,
  resetPartnerJoinSdkClient,
} from './joinClient';
export type { PartnerJoinAppClientFactory, PartnerJoinClient } from './joinClient';

/**
 * Partner join (伙伴计划) app-surface entry. The host picks the initial section
 * via `sectionId`; in-package navigation (landing CTA, apply success, status
 * reapply) is handled locally so the embedding application only owns routing
 * boundaries, not the marketing flow internals.
 */
export function PartnerJoin({ sectionId = 'landing' }: { sectionId?: PartnerJoinSection } = {}) {
  const [section, setSection] = useState<PartnerJoinSection>(sectionId);

  useEffect(() => {
    setSection(sectionId);
  }, [sectionId]);

  switch (section) {
    case 'apply':
      return <ApplyPage onNavigate={(next) => setSection(next)} />;
    case 'status':
      return <MyApplicationPage onNavigate={(next) => setSection(next)} />;
    default:
      return <LandingPage onApply={() => setSection('apply')} />;
  }
}
