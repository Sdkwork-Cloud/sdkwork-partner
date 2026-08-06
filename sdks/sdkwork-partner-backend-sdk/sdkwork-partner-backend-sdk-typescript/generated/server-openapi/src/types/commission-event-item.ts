export interface CommissionEventItem {
  /** Event id. */
  id: string;
  /** Revenue source type. */
  sourceType: 'USAGE_SETTLEMENT' | 'RECHARGE' | 'MANUAL';
  /** Source reference (unique per source type). */
  sourceRef: string;
  /** Customer (IAM user) id. */
  customerUserId: string;
  /** Commissionable base amount. */
  baseAmount: string;
  /** Revenue event timestamp. */
  eventAt: string;
  /** Event status. */
  status: 'PENDING' | 'SETTLED' | 'SKIPPED' | 'FAILED';
  /** Settled timestamp. */
  settledAt?: string | null;
  /** Remark. */
  remark: string;
  /** Created timestamp. */
  createdAt: string;
}
