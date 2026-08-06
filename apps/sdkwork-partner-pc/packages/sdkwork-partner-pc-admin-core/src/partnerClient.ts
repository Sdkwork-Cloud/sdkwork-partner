import { SdkworkBackendClient, type SdkworkBackendConfig } from '@sdkwork/partner-backend-sdk';

export type PartnerBackendClient = SdkworkBackendClient;

let sharedClient: PartnerBackendClient | null = null;

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
 * Lazily created shared client. The cloudrouter host replaces this factory
 * wiring with its own session-auth-bound client via `sdk-clients.ts`.
 */
export function getPartnerBackendClient(): PartnerBackendClient {
  if (!sharedClient) {
    sharedClient = createPartnerBackendClient();
  }
  return sharedClient;
}
