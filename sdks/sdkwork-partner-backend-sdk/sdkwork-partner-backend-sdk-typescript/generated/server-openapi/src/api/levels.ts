import { backendApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { AdminLevelsRestoreDefaultsRequest, RestoreDefaultLevelsResult } from '../types';


export class LevelsLevelsRestoreDefaultsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Restore the commercial default level catalog (seven-tier pyramid). */
  async create(body?: AdminLevelsRestoreDefaultsRequest, requestOptions?: ApiRequestOptions): Promise<RestoreDefaultLevelsResult> {
    return this.client.request<RestoreDefaultLevelsResult>(backendApiPath(`/partners/levels/restore_defaults`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, ...(body !== undefined ? { body, contentType: 'application/json' } : {}), sdkworkUnwrapKind: 'item' });
  }
}

export class LevelsApi {
  public readonly levelsRestoreDefaults: LevelsLevelsRestoreDefaultsApi;

  constructor(client: HttpClient) {
    this.levelsRestoreDefaults = new LevelsLevelsRestoreDefaultsApi(client);
  }

}

export function createLevelsApi(client: HttpClient): LevelsApi {
  return new LevelsApi(client);
}
