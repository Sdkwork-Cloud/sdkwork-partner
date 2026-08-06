export interface PartnerAncestorItem {
  /** Partner id. */
  id: string;
  /** Partner display name. */
  name: string;
  /** Partner level number. */
  levelNo: number;
  /** Partner status. */
  status: string;
  /** 0 = the partner itself, 1 = direct parent, ... */
  levelOffset: number;
}
