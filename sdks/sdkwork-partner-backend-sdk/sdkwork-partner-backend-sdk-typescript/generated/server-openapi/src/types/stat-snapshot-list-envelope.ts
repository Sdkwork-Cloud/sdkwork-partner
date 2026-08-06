import type { PageInfo } from './page-info';
import type { StatSnapshotItem } from './stat-snapshot-item';

export interface StatSnapshotListEnvelope {
  code: 0;
  traceId: string;
  data?: { items: StatSnapshotItem[]; pageInfo: PageInfo; };
}
