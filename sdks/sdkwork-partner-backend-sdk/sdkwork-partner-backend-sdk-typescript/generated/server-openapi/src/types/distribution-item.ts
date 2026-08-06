export interface DistributionItem {
  /** Distribution id. */
  id: string;
  /** Settlement id. */
  settlementId: string;
  /** Receiving partner id. */
  receiverPartnerId: string;
  /** 0 = revenue owner, 1 = direct parent, ... */
  levelOffset: number;
  /** Applied ratio (percent). */
  ratio: string;
  /** Base amount. */
  baseAmount: string;
  /** Distributed amount. */
  amount: string;
  /** Created timestamp. */
  createdAt: string;
}
