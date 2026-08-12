export interface RestoreDefaultLevelsResult {
  /** Levels inserted or revived from soft-delete. */
  restored: string;
  /** Levels overwritten with the default catalog (reset mode only). */
  reset: string;
  /** Existing active levels left untouched (fill mode only). */
  skipped: string;
}
