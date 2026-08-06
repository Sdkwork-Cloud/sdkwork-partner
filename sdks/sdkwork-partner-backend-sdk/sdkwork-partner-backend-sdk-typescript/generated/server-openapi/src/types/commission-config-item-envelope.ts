import type { CommissionConfigItem } from './commission-config-item';

export interface CommissionConfigItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: CommissionConfigItem; };
}
