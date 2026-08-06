export interface CommissionConfigItem {
  /** Global commission settlement toggle. */
  enabled: boolean;
  /** Commission on usage settlement revenue. */
  usageSettlementEnabled: boolean;
  /** Commission on recharge revenue. */
  rechargeEnabled: boolean;
  /** Max ancestor depth for commission (0 = unlimited). */
  maxCommissionDepth: string;
  /** Commission currency code. */
  currency: string;
  /** Minimum withdrawal amount. */
  minWithdrawalAmount: string;
}
