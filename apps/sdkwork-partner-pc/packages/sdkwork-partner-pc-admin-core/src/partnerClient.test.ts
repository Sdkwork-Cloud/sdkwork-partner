import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sdkwork/partner-backend-sdk', () => {
  const SdkworkBackendClient = vi.fn();
  const createClient = vi.fn();
  return { SdkworkBackendClient, createClient };
});

import { SdkworkBackendClient } from '@sdkwork/partner-backend-sdk';

import {
  configurePartnerBackendClientFactory,
  configurePartnerBackendSdkClient,
  createPartnerBackendClient,
  getPartnerBackendClient,
  resetPartnerBackendSdkClient,
} from './partnerClient';

const BackendClientMock = vi.mocked(SdkworkBackendClient);

describe('partnerClient', () => {
  beforeEach(() => {
    resetPartnerBackendSdkClient();
    BackendClientMock.mockClear();
  });

  it('creates a client with the default base URL', () => {
    const client = createPartnerBackendClient();
    expect(client).toBeDefined();
    expect(BackendClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:18098' }),
    );
  });

  it('getPartnerBackendClient shares one client instance', () => {
    const first = getPartnerBackendClient();
    const second = getPartnerBackendClient();
    expect(first).toBe(second);
  });

  it('configurePartnerBackendSdkClient overrides the base URL', () => {
    configurePartnerBackendSdkClient({ baseUrl: 'https://partner.example.test' });
    const client = getPartnerBackendClient();
    expect(BackendClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://partner.example.test' }),
    );
    expect(client).toBeDefined();
  });

  it('configurePartnerBackendClientFactory takes precedence over the built-in factory', () => {
    const provided = { provided: true } as never;
    const factory = vi.fn(() => provided);
    configurePartnerBackendClientFactory(factory);
    expect(getPartnerBackendClient()).toBe(provided);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resetPartnerBackendSdkClient forgets config, factory, and shared client', () => {
    configurePartnerBackendSdkClient({ baseUrl: 'https://a.example.test' });
    const before = getPartnerBackendClient();
    resetPartnerBackendSdkClient();
    const after = getPartnerBackendClient();
    expect(after).not.toBe(before);
    expect(BackendClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:18098' }),
    );
  });
});
