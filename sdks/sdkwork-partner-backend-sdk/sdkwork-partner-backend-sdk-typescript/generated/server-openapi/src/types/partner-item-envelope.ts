import type { PartnerItem } from './partner-item';

export interface PartnerItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: PartnerItem; };
}
