import type { PartnerTreeItem } from './partner-tree-item';

export interface PartnerTreeListEnvelope {
  code: 0;
  traceId: string;
  data: { item: PartnerTreeItem[]; };
}
