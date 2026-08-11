/**
 * Partner user search injection.
 *
 * The partner domain does not own IAM users; the embedding host injects a
 * user search implementation (backed by the IAM/appbase backend SDK). The
 * partner admin UI then renders a searchable select instead of a raw ID
 * input. Standalone shells without an injection fall back to the raw input.
 */

export interface PartnerUserOption {
  /** IAM user account id bound to the partner. */
  id: string;
  /** Display label (username · display name). */
  label: string;
}

/** Host-provided user search over the IAM user directory. */
export type PartnerUserSearchPort = (keyword: string) => Promise<PartnerUserOption[]>;

let sharedUserSearch: PartnerUserSearchPort | null = null;

/** Replaces the user search implementation (host injection). Pass null to clear. */
export function configurePartnerUserSearchPort(port: PartnerUserSearchPort | null): void {
  sharedUserSearch = port;
}

/** Returns the injected user search, or null when no host provides one. */
export function getPartnerUserSearchPort(): PartnerUserSearchPort | null {
  return sharedUserSearch;
}
