import type { PageInfo } from './page-info';
import type { WithdrawalItem } from './withdrawal-item';

export interface WithdrawalListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: WithdrawalItem[]; pageInfo: PageInfo; };
}
