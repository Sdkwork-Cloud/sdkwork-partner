import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sdkwork/partner-app-sdk', () => {
  const SdkworkAppClient = vi.fn();
  const createClient = vi.fn(() => ({}));
  return { SdkworkAppClient, createClient };
});

import { createClient } from '@sdkwork/partner-app-sdk';

import {
  configurePartnerJoinAppClientFactory,
  configurePartnerJoinSdkClient,
  createPartnerJoinClient,
  getPartnerJoinClient,
  resetPartnerJoinSdkClient,
} from './joinClient';

const CreateClientMock = vi.mocked(createClient);

describe('joinClient', () => {
  beforeEach(() => {
    resetPartnerJoinSdkClient();
    CreateClientMock.mockClear();
  });

  it('creates a client with the default base URL', () => {
    const client = createPartnerJoinClient();
    expect(client).toBeDefined();
    expect(CreateClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:18098' }),
    );
  });

  it('getPartnerJoinClient shares one client instance', () => {
    const first = getPartnerJoinClient();
    const second = getPartnerJoinClient();
    expect(first).toBe(second);
  });

  it('configurePartnerJoinSdkClient overrides the base URL', () => {
    configurePartnerJoinSdkClient({ baseUrl: 'https://partner-app.example.test' });
    const client = getPartnerJoinClient();
    expect(CreateClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://partner-app.example.test' }),
    );
    expect(client).toBeDefined();
  });

  it('configurePartnerJoinAppClientFactory takes precedence over the built-in factory', () => {
    const provided = { provided: true } as never;
    const factory = vi.fn(() => provided);
    configurePartnerJoinAppClientFactory(factory);
    expect(getPartnerJoinClient()).toBe(provided);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resetPartnerJoinSdkClient forgets config, factory, and shared client', () => {
    configurePartnerJoinSdkClient({ baseUrl: 'https://a.example.test' });
    const before = getPartnerJoinClient();
    resetPartnerJoinSdkClient();
    const after = getPartnerJoinClient();
    expect(after).not.toBe(before);
    expect(CreateClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:18098' }),
    );
  });
});
