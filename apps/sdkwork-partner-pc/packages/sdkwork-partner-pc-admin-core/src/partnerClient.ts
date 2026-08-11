import { SdkworkBackendClient, type SdkworkBackendConfig } from '@sdkwork/partner-backend-sdk';

export type PartnerBackendClient = SdkworkBackendClient;

/** Host-provided client factory (session-auth wired by the embedding host). */
export type PartnerBackendClientFactory = () => PartnerBackendClient;

let sharedClient: PartnerBackendClient | null = null;
let sharedConfig: Partial<SdkworkBackendConfig> | null = null;
let sharedFactory: PartnerBackendClientFactory | null = null;

const DEFAULT_BASE_URL = 'http://127.0.0.1:18098';

function resolveBaseUrl(): string {
  const configured = import.meta.env?.VITE_SDKWORK_PARTNER_BACKEND_API_BASE_URL as string | undefined;
  return configured?.trim() || DEFAULT_BASE_URL;
}

export function createPartnerBackendClient(
  options: Partial<SdkworkBackendConfig> = {},
): PartnerBackendClient {
  return new SdkworkBackendClient({
    baseUrl: options.baseUrl ?? resolveBaseUrl(),
    ...options,
  });
}

/**
 * Lazily created shared client. Host applications (e.g. sdkwork-cloudrouter)
 * inject their own base URL, platform, and token manager through
 * `configurePartnerBackendSdkClient`, or replace the whole client factory
 * with `configurePartnerBackendClientFactory`; standalone dev shells use the
 * factory defaults.
 */
export function getPartnerBackendClient(): PartnerBackendClient {
  if (sharedFactory) {
    return sharedFactory();
  }
  if (!sharedClient) {
    sharedClient = createPartnerBackendClient(sharedConfig ?? {});
  }
  return sharedClient;
}

/**
 * Overrides the shared client configuration (base URL, token manager,
 * platform, auth mode, headers). Must be called before the first
 * `getPartnerBackendClient` use for the override to take effect; an existing
 * shared client is recreated with the merged configuration.
 */
export function configurePartnerBackendSdkClient(config: Partial<SdkworkBackendConfig>): void {
  sharedConfig = { ...(sharedConfig ?? {}), ...config };
  if (sharedClient) {
    sharedClient = createPartnerBackendClient(sharedConfig ?? {});
  }
}

/**
 * Replaces the whole shared client factory with a host-provided one (for
 * example a session-auth boundary wrapper). Takes precedence over
 * `configurePartnerBackendSdkClient`; pass `null` to fall back to the
 * built-in factory.
 */
export function configurePartnerBackendClientFactory(
  factory: PartnerBackendClientFactory | null,
): void {
  sharedFactory = factory;
  if (!factory) {
    sharedClient = null;
  }
}

/** Test/teardown helper: forgets the shared client, config, and factory. */
export function resetPartnerBackendSdkClient(): void {
  sharedClient = null;
  sharedConfig = null;
  sharedFactory = null;
}
