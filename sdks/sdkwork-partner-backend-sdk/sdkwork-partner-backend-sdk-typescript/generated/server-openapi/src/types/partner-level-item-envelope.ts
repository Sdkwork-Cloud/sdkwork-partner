import type { PartnerLevelItem } from './partner-level-item';

export interface PartnerLevelItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: PartnerLevelItem; };
}
