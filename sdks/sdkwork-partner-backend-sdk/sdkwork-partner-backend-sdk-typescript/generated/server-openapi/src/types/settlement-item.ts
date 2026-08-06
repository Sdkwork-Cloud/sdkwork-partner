import type { DistributionItem } from './distribution-item';

export interface SettlementItem {
  /** Settlement id. */
  id: string;
  /** Commission event id (0 = join-fee batch). */
  eventId: string;
  /** Base amount. */
  baseAmount: string;
  /** Total distributed amount. */
  distributedAmount: string;
  /** Receiver count. */
  receiverCount: number;
  /** Settlement status. */
  status: 'SETTLED' | 'SKIPPED';
  /** Computed timestamp. */
  computedAt: string;
  /** Remark. */
  remark: string;
  distributions: DistributionItem[];
}
