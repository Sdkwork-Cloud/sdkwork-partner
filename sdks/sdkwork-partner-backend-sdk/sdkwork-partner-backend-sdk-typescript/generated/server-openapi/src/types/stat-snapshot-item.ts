export interface StatSnapshotItem {
  /** Snapshot id. */
  id: string;
  /** Partner id. */
  partnerId: string;
  /** Period start. */
  periodStart: string;
  /** Period end. */
  periodEnd: string;
  /** Period type. */
  periodType: 'DAY' | 'MONTH';
  /** Join fees in the period. */
  joinFeeTotal: string;
  /** Bound customer count. */
  customerCount: string;
  /** Commissionable revenue base. */
  revenueBase: string;
  /** Commission earned. */
  commissionEarned: string;
  /** Downstream partner count. */
  downstreamPartnerCount: string;
}
