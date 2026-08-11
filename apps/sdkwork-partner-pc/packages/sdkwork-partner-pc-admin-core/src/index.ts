/**
 * Partner admin core.
 *
 * Owns the `@sdkwork/partner-backend-sdk` client factory and the typed service
 * helpers used by the partner admin domain packages. Host applications
 * (e.g. sdkwork-cloudrouter) inject their base URL, platform, and session-auth
 * token manager through `configurePartnerBackendSdkClient` before the first
 * request; standalone dev shells use the factory defaults.
 */

export {
  configurePartnerBackendClientFactory,
  configurePartnerBackendSdkClient,
  createPartnerBackendClient,
  getPartnerBackendClient,
  resetPartnerBackendSdkClient,
} from './partnerClient';
export type { PartnerBackendClient, PartnerBackendClientFactory } from './partnerClient';
export { useRequestGuard } from './hooks/use-request-guard';

export { configurePartnerUserSearchPort, getPartnerUserSearchPort } from './user-search';
export type { PartnerUserOption, PartnerUserSearchPort } from './user-search';

export { configurePartnerSearchPort, getPartnerSearchPort } from './partner-search';
export type { PartnerSearchOption, PartnerSearchPort } from './partner-search';
