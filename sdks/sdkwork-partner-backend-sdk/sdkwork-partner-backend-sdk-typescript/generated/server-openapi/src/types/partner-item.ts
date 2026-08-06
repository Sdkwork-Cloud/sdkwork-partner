export interface PartnerItem {
  /** Partner id. */
  id: string;
  /** Partner uuid. */
  uuid: string;
  /** Partner display name. */
  name: string;
  /** Contact name. */
  contactName: string;
  /** Contact phone. */
  phone: string;
  /** Contact email. */
  email: string;
  /** Partner level number. */
  levelNo: number;
  /** Parent partner id (null = top level). */
  parentPartnerId?: string | null;
  /** Bound IAM user account id. */
  userAccountId: string;
  /** Partner status. */
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  /** Recorded join fee amount. */
  joinFeeAmount: string;
  /** Join fee status. */
  joinFeeStatus: 'UNPAID' | 'PAID';
  /** Join timestamp. */
  joinedAt?: string | null;
  /** Operator id that created the partner. */
  ownerId: string;
  /** Remark. */
  remark: string;
  /** Created timestamp. */
  createdAt: string;
  /** Updated timestamp. */
  updatedAt: string;
}
