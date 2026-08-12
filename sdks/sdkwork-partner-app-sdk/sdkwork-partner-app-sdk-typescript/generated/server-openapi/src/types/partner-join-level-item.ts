import type { LevelBenefitItem } from './level-benefit-item';

export interface PartnerJoinLevelItem {
  /** Level number (1-based). */
  levelNo: number;
  /** Level name. */
  name: string;
  /** Join fee amount for this level. */
  joinFee: string;
  /** Customer revenue commission pool ratio (percent, e.g. 20.00). */
  customerRevenueRatio: string;
  /** Join fee commission pool ratio (percent, e.g. 10.00). */
  joinFeeCommissionRatio: string;
  /** Level status. */
  status: 'ACTIVE' | 'DISABLED';
  /** Structured benefit (权益) ladder granted by this level. */
  benefits: LevelBenefitItem[];
}
