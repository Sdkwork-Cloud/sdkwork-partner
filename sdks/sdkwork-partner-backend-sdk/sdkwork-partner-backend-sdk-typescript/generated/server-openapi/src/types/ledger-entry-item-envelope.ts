import type { LedgerEntryItem } from './ledger-entry-item';

export interface LedgerEntryItemEnvelope {
  code: 0;
  traceId: string;
  data?: { item: LedgerEntryItem; };
}
