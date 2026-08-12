export interface PartnerJoinApplicationItem {
  /** Application id. */
  id: string;
  /** Application uuid. */
  uuid: string;
  /** Applicant entity type. */
  applicantType: 'INDIVIDUAL' | 'ORGANIZATION';
  /** Subject name. */
  subjectName: string;
  /** Contact name. */
  contactName: string;
  /** Contact phone. */
  contactPhone: string;
  /** Contact email. */
  contactEmail: string;
  /** Target (aspirational) level number. */
  targetLevelNo: number;
  /** Invite code submitted with the application (original input). */
  inviteCode: string;
  /** Inviter partner id locked at submit time (null = no invite code). */
  inviterPartnerId?: string | null;
  /** Business introduction. */
  businessIntro?: string;
  /** Application status. */
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  /** Review comment (approval note or rejection reason). */
  reviewComment: string;
  /** Review timestamp. */
  reviewedAt?: string | null;
  /** Partner record created on approval (closed loop reference). */
  approvedPartnerId?: string | null;
  /** Created timestamp. */
  createdAt: string;
  /** Updated timestamp. */
  updatedAt: string;
}
