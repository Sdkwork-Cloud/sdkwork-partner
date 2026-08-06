import type { StatsOverviewItem } from './stats-overview-item';

export interface StatsOverviewItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: StatsOverviewItem; };
}
