import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type {
  AdminCommissionConfigUpdateRequest,
  AdminCommissionEventCreateRequest,
  AdminCustomerBindRequest,
  AdminJoinFeePaymentCreateRequest,
  AdminLedgerAdjustmentRequest,
  AdminPartnerApplicationApproveRequest,
  AdminPartnerApplicationRejectRequest,
  AdminPartnerBindUserAccountRequest,
  AdminPartnerCreateRequest,
  AdminPartnerLevelCreateRequest,
  AdminPartnerLevelUpdateRequest,
  AdminPartnerUpdateRequest,
  AdminSettlementRunRequest,
  AdminWithdrawalCreateRequest,
  AdminWithdrawalPayRequest,
  AdminWithdrawalReviewRequest,
  PartnersApi,
  PartnersAuditLogsListParams,
  PartnersCommissionEventsListParams,
  PartnersCustomerBindingsListParams,
  PartnersJoinFeePaymentsListParams,
  PartnersLedgerEntriesListParams,
  PartnersListParams,
  PartnersSettlementsListParams,
  PartnersStatsListParams,
  PartnersWithdrawalsListParams,
} from '@sdkwork/partner-backend-sdk';

/** List params of the generated `PartnersApplicationsApi.list` method. */
type PartnersApplicationsListParams = NonNullable<Parameters<PartnersApi['applications']['list']>[0]>;

function client() {
  return getPartnerBackendClient().partners;
}

export const partnerService = {
  applications: {
    list: (query: PartnersApplicationsListParams = {}) => client().applications.list(query),
    retrieve: (applicationId: string) => client().applications.retrieve(applicationId),
    approve: (applicationId: string, input: AdminPartnerApplicationApproveRequest) =>
      client().applications.approve(applicationId, input),
    reject: (applicationId: string, input: AdminPartnerApplicationRejectRequest) =>
      client().applications.reject(applicationId, input),
  },
  partners: {
    list: (query: PartnersListParams = {}) => client().list(query),
    retrieve: (partnerId: string) => client().retrieve(partnerId),
    create: (input: AdminPartnerCreateRequest) => client().create(input),
    update: (partnerId: string, input: AdminPartnerUpdateRequest) =>
      client().update(partnerId, input),
    bindUserAccount: (partnerId: string, input: AdminPartnerBindUserAccountRequest) =>
      client().userAccount.create(partnerId, input),
    tree: (partnerId: string) => client().tree.list(partnerId),
    ancestors: (partnerId: string) => client().ancestors.list(partnerId),
  },
  auditLogs: {
    list: (query: PartnersAuditLogsListParams = {}) => client().auditLogs.list(query),
  },
  levels: {
    list: () => client().levels.list(),
    create: (input: AdminPartnerLevelCreateRequest) => client().levels.create(input),
    update: (levelId: string, input: AdminPartnerLevelUpdateRequest) =>
      client().levels.update(levelId, input),
    delete: (levelId: string) => client().levels.delete(levelId),
  },
  commissionConfig: {
    retrieve: () => client().commissionConfig.retrieve(),
    update: (input: AdminCommissionConfigUpdateRequest) => client().commissionConfig.update(input),
  },
  joinFeePayments: {
    list: (query: PartnersJoinFeePaymentsListParams = {}) => client().joinFeePayments.list(query),
    create: (partnerId: string, input: AdminJoinFeePaymentCreateRequest) =>
      client().joinFeePayments.create(partnerId, input),
  },
  customerBindings: {
    list: (query: PartnersCustomerBindingsListParams = {}) => client().customerBindings.list(query),
    create: (input: AdminCustomerBindRequest) => client().customerBindings.create(input),
    delete: (bindingId: string) => client().customerBindings.delete(bindingId),
  },
  commissionEvents: {
    list: (query: PartnersCommissionEventsListParams = {}) => client().commissionEvents.list(query),
    create: (input: AdminCommissionEventCreateRequest) => client().commissionEvents.create(input),
  },
  settlements: {
    run: (input: AdminSettlementRunRequest = {}) => client().settlements.run(input),
    list: (query: PartnersSettlementsListParams = {}) => client().settlements.list(query),
  },
  ledger: {
    list: (partnerId: string, query: PartnersLedgerEntriesListParams = {}) =>
      client().ledgerEntries.list(partnerId, query),
    createAdjustment: (input: AdminLedgerAdjustmentRequest) => client().ledgerEntries.create(input),
  },
  withdrawals: {
    list: (query: PartnersWithdrawalsListParams = {}) => client().withdrawals.list(query),
    create: (input: AdminWithdrawalCreateRequest) => client().withdrawals.create(input),
    review: (withdrawalId: string, input: AdminWithdrawalReviewRequest) =>
      client().withdrawalReviews.update(withdrawalId, input),
    pay: (withdrawalId: string, input: AdminWithdrawalPayRequest = {}) =>
      client().withdrawalPayments.update(withdrawalId, input),
  },
  stats: {
    overview: () => client().statsOverview.list(),
    snapshots: (query: PartnersStatsListParams = {}) => client().stats.list(query),
    retrieve: (partnerId: string) => client().stats.retrieve(partnerId),
  },
};
