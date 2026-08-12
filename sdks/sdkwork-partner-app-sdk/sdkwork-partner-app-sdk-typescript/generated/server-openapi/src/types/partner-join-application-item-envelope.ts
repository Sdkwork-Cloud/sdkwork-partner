import type { PartnerJoinApplicationItem } from './partner-join-application-item';

export interface PartnerJoinApplicationItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: PartnerJoinApplicationItem; };
}
