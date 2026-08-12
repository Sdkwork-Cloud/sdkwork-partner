export interface AdminJoinFeePaymentCreateRequest {
  /** Join fee amount paid. */
  amount: string;
  /** Currency code (default CNY). */
  currency?: string;
  /** Payment method. */
  paymentMethod?: string;
  /** Remark. */
  remark?: string;
  /** Client-generated idempotency key: replaying the same submission returns the original payment instead of creating a duplicate (and duplicate ancestor commission). */
  idempotencyKey?: string;
}
