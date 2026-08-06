/**
 * Shared TypeScript domain contracts for the sdkwork-partner capability.
 */

/** Partner (agent) status. */
export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

/** Join fee payment status. */
export type JoinFeePaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

/** Customer binding status. */
export type CustomerBindingStatus = 'ACTIVE' | 'UNBOUND';

/** Commission event source type. */
export type CommissionSourceType = 'USAGE_SETTLEMENT' | 'RECHARGE' | 'MANUAL';

/** Commission event status. */
export type CommissionEventStatus = 'PENDING' | 'SETTLED' | 'SKIPPED' | 'FAILED';

/** Ledger entry type. */
export type LedgerEntryType =
  | 'JOIN_FEE_PAYMENT'
  | 'JOIN_FEE_COMMISSION'
  | 'REVENUE_COMMISSION'
  | 'WITHDRAWAL_APPLY'
  | 'WITHDRAWAL_REJECT'
  | 'WITHDRAWAL_PAID'
  | 'MANUAL_ADJUST';

/** Withdrawal status. */
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

/** A partner level with configurable commission ratios and join fee. */
export interface PartnerLevelItem {
  id: string;
  levelNo: number;
  name: string;
  customerRevenueRatio: string;
  joinFeeCommissionRatio: string;
  joinFee: string;
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
}
