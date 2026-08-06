import type { CommissionEventItem } from './commission-event-item';
import type { PageInfo } from './page-info';

export interface CommissionEventListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: CommissionEventItem[]; pageInfo: PageInfo; };
}
