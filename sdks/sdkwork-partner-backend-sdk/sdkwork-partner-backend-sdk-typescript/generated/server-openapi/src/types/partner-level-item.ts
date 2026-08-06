export interface PartnerLevelItem {
  /** Level id. */
  id: string;
  /** Level number (1-based). */
  levelNo: number;
  /** Level name. */
  name: string;
  /** Customer revenue commission ratio (percent, e.g. 20.00). */
  customerRevenueRatio: string;
  /** Join fee commission ratio (percent, e.g. 10.00). */
  joinFeeCommissionRatio: string;
  /** Join fee amount for this level. */
  joinFee: string;
  /** Level status. */
  status: 'ACTIVE' | 'DISABLED';
  /** Display sort order. */
  sortOrder: number;
}
