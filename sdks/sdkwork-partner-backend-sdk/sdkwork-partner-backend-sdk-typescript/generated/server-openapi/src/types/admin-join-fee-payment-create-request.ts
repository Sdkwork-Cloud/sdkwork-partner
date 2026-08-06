export interface AdminJoinFeePaymentCreateRequest {
  /** Join fee amount paid. */
  amount: string;
  /** Currency code (default CNY). */
  currency?: string;
  /** Payment method. */
  paymentMethod?: string;
  /** Remark. */
  remark?: string;
}
