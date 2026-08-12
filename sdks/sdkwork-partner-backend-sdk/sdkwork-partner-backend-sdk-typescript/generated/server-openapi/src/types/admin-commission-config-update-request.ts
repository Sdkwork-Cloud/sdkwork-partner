export interface AdminCommissionConfigUpdateRequest {
  /** Global commission settlement toggle. */
  enabled: boolean;
  /** Commission on usage settlement revenue. */
  usageSettlementEnabled: boolean;
  /** Commission on recharge revenue. */
  rechargeEnabled: boolean;
  /** Max ancestor depth (0 = unlimited). */
  maxCommissionDepth: string;
  /** Commission currency code. */
  currency: string;
  /** Minimum withdrawal amount. */
  minWithdrawalAmount: string;
  /** Platform gross profit margin (percent, e.g. 40.00). Customer revenue commissions are profit-based: the allocation base equals revenue × margin; join-fee commissions use the full join fee. */
  profitMarginRatio?: string;
}
