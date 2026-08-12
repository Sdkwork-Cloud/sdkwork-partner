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
    return this.client.request<RestoreDefaultLevelsResult>(backendApiPath(`/partners/levels/restore_defaults`), { signal: requestOptions?.signal, timeout: requestOptions?.timeout, method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class LevelsApi {
  private client: HttpClient;
  public readonly levelsRestoreDefaults: LevelsLevelsRestoreDefaultsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.levelsRestoreDefaults = new LevelsLevelsRestoreDefaultsApi(client);
  }

}

export function createLevelsApi(client: HttpClient): LevelsApi {
  return new LevelsApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}
