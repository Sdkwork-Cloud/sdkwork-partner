export interface PartnerJoinRulesItem {
  /** Commission currency (e.g. CNY). */
  currency: string;
  /** Platform gross profit margin ratio (percent, default 40.00): customer revenue commissions are profit-based. */
  profitMarginRatio: string;
  /** Minimum withdrawal amount. */
  minWithdrawalAmount: string;
  /** Join fee policy summary text (display copy). */
  joinFeePolicy: string;
}
