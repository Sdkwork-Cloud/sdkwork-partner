import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type {
  AdminCommissionConfigUpdateRequest,
  AdminCommissionEventCreateRequest,
  AdminCustomerBindRequest,
  AdminJoinFeePaymentCreateRequest,
  AdminLedgerAdjustmentRequest,
  AdminPartnerBindUserAccountRequest,
  AdminPartnerCreateRequest,
  AdminPartnerLevelCreateRequest,
  AdminPartnerLevelUpdateRequest,
  AdminPartnerUpdateRequest,
  AdminSettlementRunRequest,
  AdminWithdrawalCreateRequest,
  AdminWithdrawalPayRequest,
  AdminWithdrawalReviewRequest,
  PartnersAuditLogsListParams,
  PartnersCommissionEventsListParams,
  PartnersCustomerBindingsListAllParams,
  PartnersCustomerBindingsListParams,
  PartnersJoinFeePaymentsListAllParams,
  PartnersJoinFeePaymentsListParams,
  PartnersLedgerEntriesListParams,
  PartnersListParams,
  PartnersSettlementsListParams,
  PartnersStatsListParams,
  PartnersWithdrawalsListParams,
} from '@sdkwork/partner-backend-sdk';

function client() {
  return getPartnerBackendClient().partners;
}

export const partnerService = {
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
    list: (partnerId: string, query: PartnersJoinFeePaymentsListParams = {}) =>
      client().joinFeePayments.list(partnerId, query),
    create: (partnerId: string, input: AdminJoinFeePaymentCreateRequest) =>
      client().joinFeePayments.create(partnerId, input),
    listAll: (query: PartnersJoinFeePaymentsListAllParams = {}) => client().joinFeePayments.listAll(query),
  },
  customerBindings: {
    list: (partnerId: string, query: PartnersCustomerBindingsListParams = {}) =>
      client().customerBindings.list(partnerId, query),
    create: (input: AdminCustomerBindRequest) => client().customerBindings.create(input),
    delete: (bindingId: string) => client().customerBindings.delete(bindingId),
    listAll: (query: PartnersCustomerBindingsListAllParams = {}) => client().customerBindings.listAll(query),
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
