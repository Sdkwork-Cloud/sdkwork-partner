export interface AdminPartnerUpdateRequest {
  /** Partner display name. */
  name: string;
  /** Contact name. */
  contactName?: string;
  /** Contact phone. */
  phone?: string;
  /** Contact email. */
  email?: string;
  /** Partner level number. */
  levelNo: number;
  /** Parent partner id (null = top level, clears the current parent). */
  parentPartnerId?: string | null;
  /** Bound IAM user account id (null = unbind). */
  userAccountId?: string | null;
  /** Partner status. */
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  /** Remark. */
  remark?: string;
}
