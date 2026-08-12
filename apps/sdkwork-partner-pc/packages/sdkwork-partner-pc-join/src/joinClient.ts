import { createClient, type SdkworkAppClient, type SdkworkAppConfig } from '@sdkwork/partner-app-sdk';

export type PartnerJoinClient = SdkworkAppClient;

/** Host-provided client factory (app-session wired by the embedding host). */
export type PartnerJoinAppClientFactory = () => SdkworkAppClient;

let sharedClient: SdkworkAppClient | null = null;
let sharedConfig: Partial<SdkworkAppConfig> | null = null;
let sharedFactory: PartnerJoinAppClientFactory | null = null;

const DEFAULT_BASE_URL = 'http://127.0.0.1:18098';

function resolveBaseUrl(): string {
  const configured = import.meta.env?.VITE_SDKWORK_PARTNER_APP_API_BASE_URL as string | undefined;
  return configured?.trim() || DEFAULT_BASE_URL;
}

export function createPartnerJoinClient(
  options: Partial<SdkworkAppConfig> = {},
): SdkworkAppClient {
  return createClient({
    baseUrl: options.baseUrl ?? resolveBaseUrl(),
    ...options,
  });
}

/**
 * Lazily created shared client. Host applications (e.g. sdkwork-cloudrouter)
 * inject their own base URL, platform, and token manager through
 * `configurePartnerJoinSdkClient`, or replace the whole client factory with
 * `configurePartnerJoinAppClientFactory`; standalone dev shells use the
 * factory defaults.
 */
export function getPartnerJoinClient(): SdkworkAppClient {
  if (sharedFactory) {
    return sharedFactory();
  }
  if (!sharedClient) {
    sharedClient = createPartnerJoinClient(sharedConfig ?? {});
  }
  return sharedClient;
}

/**
 * Overrides the shared client configuration (base URL, token manager,
 * platform, auth mode, headers). Must be called before the first
 * `getPartnerJoinClient` use for the override to take effect; an existing
 * shared client is recreated with the merged configuration.
 */
export function configurePartnerJoinSdkClient(config: Partial<SdkworkAppConfig>): void {
  sharedConfig = { ...(sharedConfig ?? {}), ...config };
  if (sharedClient) {
    sharedClient = createPartnerJoinClient(sharedConfig ?? {});
  }
}

/**
 * Replaces the whole shared client factory with a host-provided one (for
 * example a session-auth boundary wrapper). Takes precedence over
 * `configurePartnerJoinSdkClient`; pass `null` to fall back to the built-in
 * factory.
 */
export function configurePartnerJoinAppClientFactory(
  factory: PartnerJoinAppClientFactory | null,
): void {
  sharedFactory = factory;
  if (!factory) {
    sharedClient = null;
  }
}

/** Test/teardown helper: forgets the shared client, config, and factory. */
export function resetPartnerJoinSdkClient(): void {
  sharedClient = null;
  sharedConfig = null;
  sharedFactory = null;
}
