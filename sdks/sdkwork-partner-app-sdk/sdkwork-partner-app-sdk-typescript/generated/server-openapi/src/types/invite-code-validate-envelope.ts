import type { InviteCodeValidateItem } from './invite-code-validate-item';

export interface InviteCodeValidateEnvelope {
  code: 0;
  traceId: string;
  data?: { item: InviteCodeValidateItem; };
}
