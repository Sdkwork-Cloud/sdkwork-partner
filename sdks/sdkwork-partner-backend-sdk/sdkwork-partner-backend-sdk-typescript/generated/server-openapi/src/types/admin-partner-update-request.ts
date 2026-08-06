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
  /** Partner status. */
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  /** Remark. */
  remark?: string;
}
