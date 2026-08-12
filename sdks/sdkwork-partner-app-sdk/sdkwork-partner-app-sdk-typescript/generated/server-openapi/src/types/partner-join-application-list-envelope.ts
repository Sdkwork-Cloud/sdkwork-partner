import type { PageInfo } from './page-info';
import type { PartnerJoinApplicationItem } from './partner-join-application-item';

export interface PartnerJoinApplicationListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: PartnerJoinApplicationItem[]; pageInfo: PageInfo; };
}
