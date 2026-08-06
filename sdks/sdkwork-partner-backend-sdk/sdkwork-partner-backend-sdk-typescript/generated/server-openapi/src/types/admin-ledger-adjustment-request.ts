export interface AdminLedgerAdjustmentRequest {
  /** Partner id. */
  partnerId: string;
  /** Adjustment amount (positive credits, negative debits). */
  amount: string;
  /** Adjustment reason (required). */
  remark: string;
}
