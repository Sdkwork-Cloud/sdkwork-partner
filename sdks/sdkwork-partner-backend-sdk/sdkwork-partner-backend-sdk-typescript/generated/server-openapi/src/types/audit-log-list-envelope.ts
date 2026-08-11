import type { AuditLogItem } from './audit-log-item';
import type { PageInfo } from './page-info';

export interface AuditLogListEnvelope {
  code: 0;
  traceId: string;
  data: { items: AuditLogItem[]; pageInfo: PageInfo; };
}
