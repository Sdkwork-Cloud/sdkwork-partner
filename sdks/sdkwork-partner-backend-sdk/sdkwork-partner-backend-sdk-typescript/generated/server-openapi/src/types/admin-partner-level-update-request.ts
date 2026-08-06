export interface AdminPartnerLevelUpdateRequest {
  /** Level name. */
  name: string;
  /** Customer revenue commission ratio (percent). */
  customerRevenueRatio: string;
  /** Join fee commission ratio (percent). */
  joinFeeCommissionRatio: string;
  /** Join fee amount. */
  joinFee: string;
  /** Level status. */
  status: 'ACTIVE' | 'DISABLED';
  /** Display sort order. */
  sortOrder?: number;
}
