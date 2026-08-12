export interface InviteCodeValidateItem {
  /** The validated invite code. */
  code: string;
  /** Whether the invite code is valid. */
  valid: boolean;
  /** Inviter partner id (null when invalid). */
  partnerId?: string | null;
  /** Inviter partner display name (empty when invalid). */
  partnerName?: string;
  /** Inviter partner level number (null when invalid). */
  levelNo?: number | null;
}
