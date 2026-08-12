import type { RestoreDefaultLevelsResult } from './restore-default-levels-result';

export interface RestoreDefaultLevelsResultEnvelope {
  code: 0;
  traceId: string;
  data?: { item: RestoreDefaultLevelsResult; };
}
