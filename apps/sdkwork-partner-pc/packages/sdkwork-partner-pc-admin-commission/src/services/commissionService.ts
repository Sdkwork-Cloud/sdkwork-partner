import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type {
  AdminCommissionConfigUpdateRequest,
  AdminCommissionEventCreateRequest,
  AdminLedgerAdjustmentRequest,
  AdminPartnerLevelCreateRequest,
  AdminPartnerLevelUpdateRequest,
  AdminSettlementRunRequest,
  PartnersCommissionEventsListParams,
  PartnersLedgerEntriesListParams,
  PartnersSettlementsListParams,
} from '@sdkwork/partner-backend-sdk';

function client() {
  return getPartnerBackendClient().partners;
}

export const commissionService = {
  levels: {
    list: () => client().levels.list(),
    create: (input: AdminPartnerLevelCreateRequest) => client().levels.create(input),
    update: (levelId: string, input: AdminPartnerLevelUpdateRequest) =>
      client().levels.update(levelId, input),
    delete: (levelId: string) => client().levels.delete(levelId),
  },
  /** One-item partner page used to count partners on a level (totalItems). */
  partnersCount: (levelNo: number) =>
    client().list({ page: 1, pageSize: 1, levelNo }),
  commissionConfig: {
    retrieve: () => client().commissionConfig.retrieve(),
    update: (input: AdminCommissionConfigUpdateRequest) => client().commissionConfig.update(input),
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
};
