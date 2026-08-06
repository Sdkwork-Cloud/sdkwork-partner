export interface JoinFeePaymentItem {
  /** Payment id. */
  id: string;
  /** Paying partner id. */
  partnerId: string;
  /** Join fee amount. */
  amount: string;
  /** Currency code. */
  currency: string;
  /** Payment status. */
  status: 'PAID' | 'REFUNDED';
  /** Payment method. */
  paymentMethod: string;
  /** Paid timestamp. */
  paidAt?: string | null;
  /** Operator id that recorded the payment. */
  paidBy?: string | null;
  /** Remark. */
  remark: string;
  /** Created timestamp. */
  createdAt: string;
}
