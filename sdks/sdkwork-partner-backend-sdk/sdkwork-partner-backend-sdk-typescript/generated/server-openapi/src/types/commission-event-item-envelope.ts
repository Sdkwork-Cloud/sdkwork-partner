import type { CommissionEventItem } from './commission-event-item';

export interface CommissionEventItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: CommissionEventItem; };
}
