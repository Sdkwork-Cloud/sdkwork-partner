export interface AdminWithdrawalReviewRequest {
  /** true approves, false rejects. */
  approve: boolean;
  /** Review remark. */
  reviewRemark?: string;
}
