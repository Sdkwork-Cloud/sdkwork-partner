export interface PartnerJoinApplicationSubmitRequest {
  /** Applicant entity type. */
  applicantType: 'INDIVIDUAL' | 'ORGANIZATION';
  /** Subject name (organization name when applicantType=ORGANIZATION; personal name otherwise). */
  subjectName?: string;
  /** Contact name. */
  contactName: string;
  /** Contact phone. */
  contactPhone: string;
  /** Contact email. */
  contactEmail: string;
  /** Target (aspirational) level number; the final level is decided by the reviewer. */
  targetLevelNo?: number;
  /** Optional inviter invite code; validated at submit time. */
  inviteCode?: string;
  /** Optional business introduction. */
  businessIntro?: string;
}
