import { getPartnerJoinClient } from '../joinClient';
import type {
  InviteCodeValidateItem,
  JoinApi,
  PageInfo,
  PartnerJoinApplicationItem,
  PartnerJoinApplicationSubmitRequest,
  PartnerJoinProgramItem,
} from '@sdkwork/partner-app-sdk';

/** List params of the generated `JoinPartnerJoinApplicationApi.list` method. */
type JoinApplicationListParams = NonNullable<
  Parameters<JoinApi['partnerJoin']['application']['list']>[0]
>;

function client() {
  return getPartnerJoinClient().join.partnerJoin;
}

/** Retrieve the public partner program catalog (levels, rules, benefits). */
export function fetchProgram(): Promise<PartnerJoinProgramItem> {
  return client().retrieve();
}

/** Submit a partner join application. */
export function submitApplication(
  payload: PartnerJoinApplicationSubmitRequest,
): Promise<PartnerJoinApplicationItem> {
  return client().application.create(payload);
}

/** List the current user's own join applications. */
export function listMyApplications(
  params: JoinApplicationListParams = {},
): Promise<{ items: PartnerJoinApplicationItem[]; pageInfo: PageInfo }> {
  return client().application.list(params);
}

/** Cancel a submitted join application. */
export function cancelApplication(applicationId: string): Promise<PartnerJoinApplicationItem> {
  return client().application.cancel(applicationId);
}

/** Validate an invite code (public, no auth). */
export function validateInviteCode(code: string): Promise<InviteCodeValidateItem> {
  return client().inviteCode.retrieve(code);
}

/** Extract a readable error message; falls back to a stable message. */
export function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** True when the submission failed because the user already has an active application. */
export function isActiveApplicationConflict(error: unknown): boolean {
  if (error instanceof Error && /409|already.*(application|submitted)|active.*application/i.test(error.message)) {
    return true;
  }
  return false;
}
