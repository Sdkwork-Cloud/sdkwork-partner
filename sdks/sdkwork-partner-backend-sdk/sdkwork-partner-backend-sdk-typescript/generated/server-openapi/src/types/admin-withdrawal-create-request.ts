export interface AdminWithdrawalCreateRequest {
  /** Partner id. */
  partnerId: string;
  /** Withdrawal amount. */
  amount: string;
  /** Remark. */
  remark?: string;
}
