/**
 * Partner search injection.
 *
 * The admin-core does not depend on the partner backend SDK; the embedding
 * host (e.g. sdkwork-cloudrouter) or a standalone shell injects a partner
 * search implementation backed by the partner SDK client. The admin UI then
 * renders a searchable partner picker instead of a raw ID input. Without an
 * injection the picker shows an unavailable state.
 */

export interface PartnerSearchOption {
  /** Partner id. */
  id: string;
  /** Display name. */
  name: string;
  /** Partner level number (displayed as L{n}). */
  levelNo: number;
}

/** Host-provided partner search over the partner directory. */
export type PartnerSearchPort = (keyword: string) => Promise<PartnerSearchOption[]>;

let sharedPartnerSearch: PartnerSearchPort | null = null;

/** Replaces the partner search implementation (host injection). Pass null to clear. */
export function configurePartnerSearchPort(port: PartnerSearchPort | null): void {
  sharedPartnerSearch = port;
}

/** Returns the injected partner search, or null when no host provides one. */
export function getPartnerSearchPort(): PartnerSearchPort | null {
  return sharedPartnerSearch;
}
