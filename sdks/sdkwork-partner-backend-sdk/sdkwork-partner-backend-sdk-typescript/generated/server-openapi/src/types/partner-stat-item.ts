export interface PartnerStatItem {
  /** Partner id. */
  partnerId: string;
  /** Total paid join fees. */
  totalJoinFee: string;
  /** Total earned commission. */
  totalCommission: string;
  /** Available wallet balance. */
  availableBalance: string;
  /** Funds frozen by pending withdrawals. */
  withdrawingAmount: string;
  /** Total withdrawn amount. */
  withdrawnAmount: string;
  /** Active bound customer count. */
  customerCount: string;
  /** Downstream partner count. */
  downstreamPartnerCount: string;
}
