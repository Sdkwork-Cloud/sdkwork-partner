/**
 * Partner admin core.
 *
 * Owns the `@sdkwork/partner-backend-sdk` client factory and the typed service
 * helpers used by the partner admin domain packages. Host applications
 * (e.g. sdkwork-cloudrouter) attach their own session-auth boundary when they
 * wire the client; standalone dev shells use the factory defaults.
 */

export { createPartnerBackendClient, getPartnerBackendClient } from './partnerClient';
export type { PartnerBackendClient } from './partnerClient';
