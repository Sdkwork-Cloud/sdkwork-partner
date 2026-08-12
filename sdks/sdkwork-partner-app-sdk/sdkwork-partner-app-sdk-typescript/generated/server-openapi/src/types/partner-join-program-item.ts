import type { PartnerJoinLevelItem } from './partner-join-level-item';
import type { PartnerJoinRulesItem } from './partner-join-rules-item';

export interface PartnerJoinProgramItem {
  /** Active partner level catalog (join fees, pools, benefits). */
  levels: PartnerJoinLevelItem[];
  rules: PartnerJoinRulesItem;
}
