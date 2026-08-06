export interface WithdrawalItem {
  /** Withdrawal id. */
  id: string;
  /** Partner id. */
  partnerId: string;
  /** Withdrawal amount. */
  amount: string;
  /** Withdrawal status. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  /** Reviewer operator id. */
  reviewedBy?: string | null;
  /** Reviewed timestamp. */
  reviewedAt?: string | null;
  /** Review remark. */
  reviewRemark: string;
  /** Paid timestamp. */
  paidAt?: string | null;
  /** Paying operator id. */
  paidBy?: string | null;
  /** Remark. */
  remark: string;
  /** Created timestamp. */
  createdAt: string;
  /** Updated timestamp. */
  updatedAt: string;
}
