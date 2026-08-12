import type { AdminPartnerApplicationItem } from './admin-partner-application-item';
import type { PageInfo } from './page-info';

export interface AdminPartnerApplicationListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: AdminPartnerApplicationItem[]; pageInfo: PageInfo; };
}
