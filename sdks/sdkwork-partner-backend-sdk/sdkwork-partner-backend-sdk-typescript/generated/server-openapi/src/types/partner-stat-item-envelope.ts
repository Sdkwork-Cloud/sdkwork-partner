import type { PartnerStatItem } from './partner-stat-item';

export interface PartnerStatItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: PartnerStatItem; };
}
