import type { PartnerJoinProgramItem } from './partner-join-program-item';

export interface PartnerJoinProgramEnvelope {
  code: 0;
  traceId: string;
  data?: { item: PartnerJoinProgramItem; };
}
