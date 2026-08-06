export interface LedgerEntryItem {
  /** Entry id. */
  id: string;
  /** Partner id. */
  partnerId: string;
  /** Entry type. */
  entryType: 'JOIN_FEE_PAYMENT' | 'JOIN_FEE_COMMISSION' | 'REVENUE_COMMISSION' | 'WITHDRAWAL_APPLY' | 'WITHDRAWAL_REJECT' | 'WITHDRAWAL_PAID' | 'MANUAL_ADJUST';
  /** Balance direction. */
  direction: 'IN' | 'OUT';
  /** Entry amount. */
  amount: string;
  /** Available balance after the entry. */
  balanceAfter: string;
  /** Reference type. */
  refType: string;
  /** Reference id. */
  refId?: string | null;
  /** Operator id. */
  operatorId: string;
  /** Remark. */
  remark: string;
  /** Created timestamp. */
  createdAt: string;
}
