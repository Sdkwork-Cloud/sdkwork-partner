export interface AdminLevelsRestoreDefaultsRequest {
  /** "fill" (default) revives only missing default levels; "reset" also overwrites the active default levels with catalog values. */
  mode?: 'fill' | 'reset';
}
