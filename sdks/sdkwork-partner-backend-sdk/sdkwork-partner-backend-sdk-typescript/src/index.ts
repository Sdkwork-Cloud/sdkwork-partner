import {
  createClient as createGeneratedBackendClient,
  SdkworkBackendClient,
} from "../generated/server-openapi/src/index";
import type { SdkworkBackendConfig } from "../generated/server-openapi/src/types/common";

export { SdkworkBackendClient, createGeneratedBackendClient };
export type { SdkworkBackendConfig };
export * from "../generated/server-openapi/src/types";
export * from "../generated/server-openapi/src/api";
export * from "../generated/server-openapi/src/http";
export * from "../generated/server-openapi/src/auth";

export type {
  PartnersAuditLogsListParams,
  PartnersCommissionEventsListParams,
  PartnersCustomerBindingsListParams,
  PartnersJoinFeePaymentsListParams,
  PartnersLedgerEntriesListParams,
  PartnersListParams,
  PartnersSettlementsListParams,
  PartnersStatsListParams,
  PartnersWithdrawalsListParams,
} from "../generated/server-openapi/src/api/partners";

export function createClient(config: SdkworkBackendConfig): SdkworkBackendClient {
  return createGeneratedBackendClient(config);
}
