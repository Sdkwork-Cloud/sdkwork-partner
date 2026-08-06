import type { SettlementRunResult } from './settlement-run-result';

export interface SettlementRunResultEnvelope {
  code: 0;
  traceId: string;
  data?: { item: SettlementRunResult; };
}
