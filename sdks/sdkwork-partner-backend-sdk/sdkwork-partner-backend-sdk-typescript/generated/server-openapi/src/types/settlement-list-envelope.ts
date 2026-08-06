import type { PageInfo } from './page-info';
import type { SettlementItem } from './settlement-item';

export interface SettlementListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: SettlementItem[]; pageInfo: PageInfo; };
}
