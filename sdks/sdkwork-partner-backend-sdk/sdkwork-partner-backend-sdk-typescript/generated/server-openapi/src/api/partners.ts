import { backendApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { AdminCommissionConfigUpdateRequest, AdminCommissionEventCreateRequest, AdminCustomerBindRequest, AdminJoinFeePaymentCreateRequest, AdminLedgerAdjustmentRequest, AdminPartnerApplicationApproveRequest, AdminPartnerApplicationItem, AdminPartnerApplicationRejectRequest, AdminPartnerBindUserAccountRequest, AdminPartnerCreateRequest, AdminPartnerLevelCreateRequest, AdminPartnerLevelUpdateRequest, AdminPartnerUpdateRequest, AdminSettlementRunRequest, AdminWithdrawalCreateRequest, AdminWithdrawalPayRequest, AdminWithdrawalReviewRequest, AuditLogItem, CommissionConfigItem, CommissionEventItem, CustomerBindingItem, JoinFeePaymentItem, LedgerEntryItem, PageInfo, PartnerAncestorItem, PartnerItem, PartnerLevelItem, PartnerStatItem, PartnerTreeItem, SettlementItem, SettlementRunResult, StatSnapshotItem, StatsOverviewItem, WithdrawalItem } from '../types';


export interface PartnersApplicationsListParams {
  page?: number;
  pageSize?: number;
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  applicantType?: 'INDIVIDUAL' | 'ORGANIZATION';
  q?: string;
}

export class PartnersApplicationsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List partner join applications */
  async list(params?: PartnersApplicationsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminPartnerApplicationItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'applicant_type', value: params?.applicantType, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminPartnerApplicationItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/applications`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Retrieve a partner join application */
  async retrieve(applicationId: string, requestOptions?: ApiRequestOptions): Promise<AdminPartnerApplicationItem> {
    return this.client.request<AdminPartnerApplicationItem>(backendApiPath(`/partners/applications/${serializePathParameter(applicationId, { name: 'applicationId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }

/** Approve a partner join application */
  async approve(applicationId: string, body: AdminPartnerApplicationApproveRequest, requestOptions?: ApiRequestOptions): Promise<AdminPartnerApplicationItem> {
    return this.client.request<AdminPartnerApplicationItem>(backendApiPath(`/partners/applications/${serializePathParameter(applicationId, { name: 'applicationId', style: 'simple', explode: false })}/approve`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Reject a partner join application */
  async reject(applicationId: string, body: AdminPartnerApplicationRejectRequest, requestOptions?: ApiRequestOptions): Promise<AdminPartnerApplicationItem> {
    return this.client.request<AdminPartnerApplicationItem>(backendApiPath(`/partners/applications/${serializePathParameter(applicationId, { name: 'applicationId', style: 'simple', explode: false })}/reject`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface PartnersStatsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  partnerId?: string;
  periodType?: 'DAY' | 'MONTH';
}

export class PartnersStatsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List partner stats snapshots */
  async list(params?: PartnersStatsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: StatSnapshotItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'partner_id', value: params?.partnerId, style: 'form', explode: true, allowReserved: false },
      { name: 'period_type', value: params?.periodType, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: StatSnapshotItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/stats`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Retrieve a partner's aggregated stats */
  async retrieve(partnerId: string, requestOptions?: ApiRequestOptions): Promise<PartnerStatItem> {
    return this.client.request<PartnerStatItem>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/stats`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersStatsOverviewApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Retrieve partner stats overview */
  async list(requestOptions?: ApiRequestOptions): Promise<StatsOverviewItem> {
    return this.client.request<StatsOverviewItem>(backendApiPath(`/partners/stats/overview`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersWithdrawalPaymentsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Mark an approved withdrawal as paid */
  async update(withdrawalId: string, body: AdminWithdrawalPayRequest, requestOptions?: ApiRequestOptions): Promise<WithdrawalItem> {
    return this.client.request<WithdrawalItem>(backendApiPath(`/partners/withdrawals/${serializePathParameter(withdrawalId, { name: 'withdrawalId', style: 'simple', explode: false })}/pay`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersWithdrawalReviewsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Approve or reject a withdrawal request */
  async update(withdrawalId: string, body: AdminWithdrawalReviewRequest, requestOptions?: ApiRequestOptions): Promise<WithdrawalItem> {
    return this.client.request<WithdrawalItem>(backendApiPath(`/partners/withdrawals/${serializePathParameter(withdrawalId, { name: 'withdrawalId', style: 'simple', explode: false })}/review`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface PartnersWithdrawalsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  partnerId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
}

export class PartnersWithdrawalsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List withdrawal requests */
  async list(params?: PartnersWithdrawalsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: WithdrawalItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'partner_id', value: params?.partnerId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: WithdrawalItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/withdrawals`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Create a withdrawal request */
  async create(body: AdminWithdrawalCreateRequest, requestOptions?: ApiRequestOptions): Promise<WithdrawalItem> {
    return this.client.request<WithdrawalItem>(backendApiPath(`/partners/withdrawals`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface PartnersAuditLogsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  operatorId?: string;
}

export class PartnersAuditLogsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List partner admin audit logs */
  async list(params?: PartnersAuditLogsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AuditLogItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'action', value: params?.action, style: 'form', explode: true, allowReserved: false },
      { name: 'target_type', value: params?.targetType, style: 'form', explode: true, allowReserved: false },
      { name: 'target_id', value: params?.targetId, style: 'form', explode: true, allowReserved: false },
      { name: 'operator_id', value: params?.operatorId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AuditLogItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/audit_logs`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export interface PartnersLedgerEntriesListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  entryType?: string;
}

export class PartnersLedgerEntriesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List ledger entries of a partner */
  async list(partnerId: string, params?: PartnersLedgerEntriesListParams, requestOptions?: ApiRequestOptions): Promise<{ items: LedgerEntryItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'entry_type', value: params?.entryType, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: LedgerEntryItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/ledger`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Create a manual ledger adjustment */
  async create(body: AdminLedgerAdjustmentRequest, requestOptions?: ApiRequestOptions): Promise<LedgerEntryItem> {
    return this.client.request<LedgerEntryItem>(backendApiPath(`/partners/ledger/adjustments`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface PartnersSettlementsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  partnerId?: string;
  status?: 'SETTLED' | 'SKIPPED';
}

export class PartnersSettlementsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Run commission settlement for pending events */
  async run(body: AdminSettlementRunRequest, requestOptions?: ApiRequestOptions): Promise<SettlementRunResult> {
    return this.client.request<SettlementRunResult>(backendApiPath(`/partners/settlements/run`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** List commission settlements */
  async list(params?: PartnersSettlementsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: SettlementItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'partner_id', value: params?.partnerId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: SettlementItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/settlements`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export interface PartnersCommissionEventsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: 'PENDING' | 'SETTLED' | 'SKIPPED' | 'FAILED';
  sourceType?: 'USAGE_SETTLEMENT' | 'RECHARGE' | 'MANUAL';
}

export class PartnersCommissionEventsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List commission revenue events */
  async list(params?: PartnersCommissionEventsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: CommissionEventItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'source_type', value: params?.sourceType, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: CommissionEventItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/commission_events`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Create a manual commission revenue event */
  async create(body: AdminCommissionEventCreateRequest, requestOptions?: ApiRequestOptions): Promise<CommissionEventItem> {
    return this.client.request<CommissionEventItem>(backendApiPath(`/partners/commission_events`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface PartnersCustomerBindingsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  partnerId?: string;
  status?: string;
}

export class PartnersCustomerBindingsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Bind a customer to a partner */
  async create(body: AdminCustomerBindRequest, requestOptions?: ApiRequestOptions): Promise<CustomerBindingItem> {
    return this.client.request<CustomerBindingItem>(backendApiPath(`/partners/customers`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** List customer bindings across all partners */
  async list(params?: PartnersCustomerBindingsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: CustomerBindingItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'partner_id', value: params?.partnerId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: CustomerBindingItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/customers`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Unbind a customer from a partner */
  async delete(bindingId: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(backendApiPath(`/partners/customers/${serializePathParameter(bindingId, { name: 'bindingId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export interface PartnersJoinFeePaymentsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  partnerId?: string;
  status?: string;
}

export class PartnersJoinFeePaymentsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Record a join fee payment and trigger ancestor commission */
  async create(partnerId: string, body: AdminJoinFeePaymentCreateRequest, requestOptions?: ApiRequestOptions): Promise<JoinFeePaymentItem> {
    return this.client.request<JoinFeePaymentItem>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/join_fee_payments`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** List join fee payments across all partners */
  async list(params?: PartnersJoinFeePaymentsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: JoinFeePaymentItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'partner_id', value: params?.partnerId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: JoinFeePaymentItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners/join_fee_payments`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export class PartnersAncestorsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List the partner ancestor chain */
  async list(partnerId: string, requestOptions?: ApiRequestOptions): Promise<PartnerAncestorItem[]> {
    return this.client.request<PartnerAncestorItem[]>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/ancestors`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersTreeApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List the partner descendant tree */
  async list(partnerId: string, requestOptions?: ApiRequestOptions): Promise<PartnerTreeItem[]> {
    return this.client.request<PartnerTreeItem[]>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/tree`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersUserAccountApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Bind an IAM user account to a partner */
  async create(partnerId: string, body: AdminPartnerBindUserAccountRequest, requestOptions?: ApiRequestOptions): Promise<PartnerItem> {
    return this.client.request<PartnerItem>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}/user_account`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersCommissionConfigApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Retrieve the commission configuration */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<CommissionConfigItem> {
    return this.client.request<CommissionConfigItem>(backendApiPath(`/partners/commission_config`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }

/** Update the commission configuration */
  async update(body: AdminCommissionConfigUpdateRequest, requestOptions?: ApiRequestOptions): Promise<CommissionConfigItem> {
    return this.client.request<CommissionConfigItem>(backendApiPath(`/partners/commission_config`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class PartnersLevelsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List partner levels */
  async list(requestOptions?: ApiRequestOptions): Promise<{ items: PartnerLevelItem[]; pageInfo: PageInfo; }> {
    return this.client.request<{ items: PartnerLevelItem[]; pageInfo: PageInfo; }>(backendApiPath(`/partners/levels`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Create a partner level */
  async create(body: AdminPartnerLevelCreateRequest, requestOptions?: ApiRequestOptions): Promise<PartnerLevelItem> {
    return this.client.request<PartnerLevelItem>(backendApiPath(`/partners/levels`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Update a partner level */
  async update(levelId: string, body: AdminPartnerLevelUpdateRequest, requestOptions?: ApiRequestOptions): Promise<PartnerLevelItem> {
    return this.client.request<PartnerLevelItem>(backendApiPath(`/partners/levels/${serializePathParameter(levelId, { name: 'levelId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Delete a partner level */
  async delete(levelId: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(backendApiPath(`/partners/levels/${serializePathParameter(levelId, { name: 'levelId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export interface PartnersListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  levelNo?: number;
  createdFrom?: string;
  createdTo?: string;
  joinFeeStatus?: 'PAID' | 'UNPAID';
}

export class PartnersApi {
  private client: HttpClient;
  public readonly levels: PartnersLevelsApi;
  public readonly commissionConfig: PartnersCommissionConfigApi;
  public readonly userAccount: PartnersUserAccountApi;
  public readonly tree: PartnersTreeApi;
  public readonly ancestors: PartnersAncestorsApi;
  public readonly joinFeePayments: PartnersJoinFeePaymentsApi;
  public readonly customerBindings: PartnersCustomerBindingsApi;
  public readonly commissionEvents: PartnersCommissionEventsApi;
  public readonly settlements: PartnersSettlementsApi;
  public readonly ledgerEntries: PartnersLedgerEntriesApi;
  public readonly auditLogs: PartnersAuditLogsApi;
  public readonly withdrawals: PartnersWithdrawalsApi;
  public readonly withdrawalReviews: PartnersWithdrawalReviewsApi;
  public readonly withdrawalPayments: PartnersWithdrawalPaymentsApi;
  public readonly statsOverview: PartnersStatsOverviewApi;
  public readonly stats: PartnersStatsApi;
  public readonly applications: PartnersApplicationsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.levels = new PartnersLevelsApi(client);
    this.commissionConfig = new PartnersCommissionConfigApi(client);
    this.userAccount = new PartnersUserAccountApi(client);
    this.tree = new PartnersTreeApi(client);
    this.ancestors = new PartnersAncestorsApi(client);
    this.joinFeePayments = new PartnersJoinFeePaymentsApi(client);
    this.customerBindings = new PartnersCustomerBindingsApi(client);
    this.commissionEvents = new PartnersCommissionEventsApi(client);
    this.settlements = new PartnersSettlementsApi(client);
    this.ledgerEntries = new PartnersLedgerEntriesApi(client);
    this.auditLogs = new PartnersAuditLogsApi(client);
    this.withdrawals = new PartnersWithdrawalsApi(client);
    this.withdrawalReviews = new PartnersWithdrawalReviewsApi(client);
    this.withdrawalPayments = new PartnersWithdrawalPaymentsApi(client);
    this.statsOverview = new PartnersStatsOverviewApi(client);
    this.stats = new PartnersStatsApi(client);
    this.applications = new PartnersApplicationsApi(client);
  }


/** List partners */
  async list(params?: PartnersListParams, requestOptions?: ApiRequestOptions): Promise<{ items: PartnerItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'level_no', value: params?.levelNo, style: 'form', explode: true, allowReserved: false },
      { name: 'created_from', value: params?.createdFrom, style: 'form', explode: true, allowReserved: false },
      { name: 'created_to', value: params?.createdTo, style: 'form', explode: true, allowReserved: false },
      { name: 'join_fee_status', value: params?.joinFeeStatus, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: PartnerItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/partners`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Create a partner */
  async create(body: AdminPartnerCreateRequest, requestOptions?: ApiRequestOptions): Promise<PartnerItem> {
    return this.client.request<PartnerItem>(backendApiPath(`/partners`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Retrieve a partner */
  async retrieve(partnerId: string, requestOptions?: ApiRequestOptions): Promise<PartnerItem> {
    return this.client.request<PartnerItem>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }

/** Update a partner */
  async update(partnerId: string, body: AdminPartnerUpdateRequest, requestOptions?: ApiRequestOptions): Promise<PartnerItem> {
    return this.client.request<PartnerItem>(backendApiPath(`/partners/${serializePathParameter(partnerId, { name: 'partnerId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export function createPartnersApi(client: HttpClient): PartnersApi {
  return new PartnersApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

interface PathParameterSpec {
  name: string;
  style: string;
  explode: boolean;
}

function serializePathParameter(value: unknown, spec: PathParameterSpec): string {
  if (value === undefined || value === null) {
    return '';
  }

  const style = spec.style || 'simple';
  if (Array.isArray(value)) {
    return serializePathArray(spec.name, value, style, spec.explode);
  }
  if (typeof value === 'object') {
    return serializePathObject(spec.name, value as Record<string, unknown>, style, spec.explode);
  }
  return pathPrefix(spec.name, style, false) + encodePathValue(serializePathPrimitive(value));
}

function serializePathArray(name: string, values: unknown[], style: string, explode: boolean): string {
  const serialized = values
    .filter((item) => item !== undefined && item !== null)
    .map((item) => encodePathValue(serializePathPrimitive(item)));
  if (serialized.length === 0) {
    return pathPrefix(name, style, false);
  }
  if (style === 'matrix') {
    return explode
      ? serialized.map((item) => `;${name}=${item}`).join('')
      : `;${name}=${serialized.join(',')}`;
  }
  return pathPrefix(name, style, false) + serialized.join(explode ? '.' : ',');
}

function serializePathObject(name: string, value: Record<string, unknown>, style: string, explode: boolean): string {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return pathPrefix(name, style, true);
  }
  if (style === 'matrix') {
    return explode
      ? entries.map(([key, entryValue]) => `;${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join('')
      : `;${name}=${entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',')}`;
  }
  const serialized = explode
    ? entries.map(([key, entryValue]) => `${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join(style === 'label' ? '.' : ',')
    : entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',');
  return pathPrefix(name, style, true) + serialized;
}

function pathPrefix(name: string, style: string, _objectValue: boolean): string {
  if (style === 'label') return '.';
  if (style === 'matrix') return `;${name}`;
  return '';
}

function encodePathValue(value: string): string {
  return encodeURIComponent(value);
}

function serializePathPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
interface QueryParameterSpec {
  name: string;
  value: unknown;
  style: string;
  explode: boolean;
  allowReserved: boolean;
  contentType?: string;
}

function buildQueryString(parameters: QueryParameterSpec[]): string {
  const pairs: string[] = [];
  for (const parameter of parameters) {
    appendSerializedParameter(pairs, parameter);
  }
  return pairs.join('&');
}

function appendSerializedParameter(pairs: string[], parameter: QueryParameterSpec): void {
  if (parameter.value === undefined || parameter.value === null) {
    return;
  }

  if (parameter.contentType) {
    pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(JSON.stringify(parameter.value), parameter.allowReserved)}`);
    return;
  }

  const style = parameter.style || 'form';
  if (style === 'deepObject') {
    appendDeepObjectParameter(pairs, parameter.name, parameter.value, parameter.allowReserved);
    return;
  }

  if (Array.isArray(parameter.value)) {
    appendArrayParameter(pairs, parameter.name, parameter.value, style, parameter.explode, parameter.allowReserved);
    return;
  }

  if (typeof parameter.value === 'object') {
    appendObjectParameter(pairs, parameter.name, parameter.value as Record<string, unknown>, style, parameter.explode, parameter.allowReserved);
    return;
  }

  pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(serializePrimitive(parameter.value), parameter.allowReserved)}`);
}

function appendArrayParameter(
  pairs: string[],
  name: string,
  value: unknown[],
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const values = value
    .filter((item) => item !== undefined && item !== null)
    .map((item) => serializePrimitive(item));
  if (values.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const item of values) {
      pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(item, allowReserved)}`);
    }
    return;
  }

  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(values.join(','), allowReserved)}`);
}

function appendObjectParameter(
  pairs: string[],
  name: string,
  value: Record<string, unknown>,
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const [key, entryValue] of entries) {
      pairs.push(`${encodeQueryComponent(key)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
    }
    return;
  }

  const serialized = entries.flatMap(([key, entryValue]) => [key, serializePrimitive(entryValue)]).join(',');
  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serialized, allowReserved)}`);
}

function appendDeepObjectParameter(
  pairs: string[],
  name: string,
  value: unknown,
  allowReserved: boolean,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serializePrimitive(value), allowReserved)}`);
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (entryValue === undefined || entryValue === null) {
      continue;
    }
    pairs.push(`${encodeQueryComponent(`${name}[${key}]`)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
  }
}

function serializePrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value);
}

function encodeQueryValue(value: string, allowReserved: boolean): string {
  const encoded = encodeURIComponent(value);
  if (!allowReserved) {
    return encoded;
  }
  return encoded.replace(/%3A/gi, ':')
    .replace(/%2F/gi, '/')
    .replace(/%3F/gi, '?')
    .replace(/%23/gi, '#')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%40/gi, '@')
    .replace(/%21/gi, '!')
    .replace(/%24/gi, '$')
    .replace(/%26/gi, '&')
    .replace(/%27/gi, "'")
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%2A/gi, '*')
    .replace(/%2B/gi, '+')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%3D/gi, '=');
}
