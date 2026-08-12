import type { AdminPartnerApplicationItem } from './admin-partner-application-item';

export interface AdminPartnerApplicationItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: AdminPartnerApplicationItem; };
}
