export interface AdminPartnerCreateRequest {
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
  /** Parent partner id (null = top level). */
  parentPartnerId?: string | null;
  /** Bound IAM user account id (optional at creation; bind later from the partner list). */
  userAccountId?: string | null;
  /** Remark. */
  remark?: string;
}
