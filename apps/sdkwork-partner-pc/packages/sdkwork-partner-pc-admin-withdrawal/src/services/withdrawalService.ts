import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type {
  AdminWithdrawalCreateRequest,
  AdminWithdrawalPayRequest,
  AdminWithdrawalReviewRequest,
  PartnersWithdrawalsListParams,
} from '@sdkwork/partner-backend-sdk';

function client() {
  return getPartnerBackendClient().partners;
}

export const withdrawalService = {
  list: (query: PartnersWithdrawalsListParams = {}) => client().withdrawals.list(query),
  create: (input: AdminWithdrawalCreateRequest) => client().withdrawals.create(input),
  review: (withdrawalId: string, input: AdminWithdrawalReviewRequest) =>
    client().withdrawalReviews.update(withdrawalId, input),
  pay: (withdrawalId: string, input: AdminWithdrawalPayRequest = {}) =>
    client().withdrawalPayments.update(withdrawalId, input),
};
