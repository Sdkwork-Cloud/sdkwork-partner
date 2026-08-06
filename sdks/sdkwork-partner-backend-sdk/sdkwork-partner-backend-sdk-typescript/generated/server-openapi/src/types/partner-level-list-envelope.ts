import type { PageInfo } from './page-info';
import type { PartnerLevelItem } from './partner-level-item';

export interface PartnerLevelListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: PartnerLevelItem[]; pageInfo: PageInfo; };
}
