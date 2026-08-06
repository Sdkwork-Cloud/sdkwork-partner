import type { WithdrawalItem } from './withdrawal-item';

export interface WithdrawalItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: WithdrawalItem; };
}
