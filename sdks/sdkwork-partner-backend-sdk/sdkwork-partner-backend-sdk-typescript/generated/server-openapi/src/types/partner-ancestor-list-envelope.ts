import type { PartnerAncestorItem } from './partner-ancestor-item';

export interface PartnerAncestorListEnvelope {
  code: 0;
  traceId: string;
  data: { item: PartnerAncestorItem[]; };
}
