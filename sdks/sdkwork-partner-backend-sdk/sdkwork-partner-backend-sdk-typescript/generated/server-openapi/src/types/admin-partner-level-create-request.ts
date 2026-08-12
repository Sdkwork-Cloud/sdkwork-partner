export interface AdminPartnerLevelCreateRequest {
  /** Level number (1-based). */
  levelNo: number;
  /** Level name. */
  name: string;
  /** Customer revenue commission ratio (percent). */
  customerRevenueRatio: string;
  /** Join fee commission ratio (percent). */
  joinFeeCommissionRatio: string;
  /** Join fee amount. */
  joinFee: string;
  /** Display sort order. */
  sortOrder?: number;
  /** Structured benefit (权益) ladder entries for this level. */
  benefits?: { code: string; name: string; value?: string; sort?: number; }[];
}
