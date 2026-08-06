export interface PartnerTreeItem {
  /** Partner id. */
  id: string;
  /** Partner display name. */
  name: string;
  /** Partner level number. */
  levelNo: number;
  /** Partner status. */
  status: string;
  children: PartnerTreeItem[];
}
