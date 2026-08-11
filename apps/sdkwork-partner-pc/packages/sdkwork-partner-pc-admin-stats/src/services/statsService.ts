import { getPartnerBackendClient } from '@sdkwork/partner-pc-admin-core';
import type { PartnersStatsListParams } from '@sdkwork/partner-backend-sdk';

function client() {
  return getPartnerBackendClient().partners;
}

export const statsService = {
  overview: () => client().statsOverview.list(),
  snapshots: (query: PartnersStatsListParams = {}) => client().stats.list(query),
  retrieve: (partnerId: string) => client().stats.retrieve(partnerId),
};
