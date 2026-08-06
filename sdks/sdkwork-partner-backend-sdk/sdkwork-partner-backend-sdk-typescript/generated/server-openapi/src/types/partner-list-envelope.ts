import type { PageInfo } from './page-info';
import type { PartnerItem } from './partner-item';

export interface PartnerListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: PartnerItem[]; pageInfo: PageInfo; };
}
