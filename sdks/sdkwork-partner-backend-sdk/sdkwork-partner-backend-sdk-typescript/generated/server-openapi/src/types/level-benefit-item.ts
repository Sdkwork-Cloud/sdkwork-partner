export interface LevelBenefitItem {
  /** Stable machine-readable benefit key (e.g. account_manager). */
  code: string;
  /** Display name of the benefit. */
  name: string;
  /** Display value of the benefit (e.g. 10 qualified leads per month). */
  value?: string;
  /** Display sort order within the level benefit list. */
  sort?: number;
}
