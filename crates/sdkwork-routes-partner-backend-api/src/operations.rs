use std::sync::Arc;

use axum::extract::{Extension, Path, Query, State};
use axum::response::Response;
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use sdkwork_commerce_partner_service::backend_admin::{
    PartnerAdminListPage, PartnerAdminService, PartnerAdminSubject,
};
use sdkwork_commerce_partner_service::commands::*;
use sdkwork_commerce_partner_service::queries::*;
use sdkwork_contract_service::CommerceServiceError;
use sdkwork_iam_context_service::IamAppContext;
use sdkwork_utils_rust::OffsetListPageParams;
use sdkwork_web_core::WebRequestContext;
use serde::Deserialize;

use crate::api_response::{
    forbidden, internal_error, no_content, not_found, parse_page, success_created, success_item,
    success_items, unauthorized, validation,
};
use crate::backend_acl::require_backend_operator;

const READ_PERMISSION: &str = "commerce.partner.read";
const MANAGE_PERMISSION: &str = "commerce.partner.manage";

#[derive(Clone)]
struct PartnerAdminState {
    service: Arc<PartnerAdminService>,
}

macro_rules! response_try {
    ($value:expr) => {
        match $value {
            Ok(value) => value,
            Err(response) => return response,
        }
    };
}

#[derive(Debug, Deserialize)]
struct ListParams {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    status: Option<String>,
    level_no: Option<i32>,
    source_type: Option<String>,
    entry_type: Option<String>,
    period_type: Option<String>,
    partner_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommissionConfigRequest {
    enabled: bool,
    usage_settlement_enabled: bool,
    recharge_enabled: bool,
    max_commission_depth: i64,
    currency: String,
    min_withdrawal_amount: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LevelRequest {
    level_no: i32,
    name: String,
    customer_revenue_ratio: String,
    join_fee_commission_ratio: String,
    join_fee: String,
    status: Option<String>,
    sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartnerRequest {
    name: String,
    contact_name: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    level_no: i32,
    parent_partner_id: Option<i64>,
    user_account_id: i64,
    status: Option<String>,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinFeePaymentRequest {
    amount: String,
    currency: Option<String>,
    payment_method: Option<String>,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindCustomerRequest {
    partner_id: i64,
    customer_user_id: i64,
    binding_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManualCommissionEventRequest {
    source_ref: String,
    customer_user_id: i64,
    base_amount: String,
    event_at: Option<String>,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettlementRunRequest {
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LedgerAdjustmentRequest {
    partner_id: i64,
    amount: String,
    remark: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WithdrawalRequest {
    partner_id: i64,
    amount: String,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WithdrawalReviewRequest {
    approve: bool,
    review_remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WithdrawalPayRequest {
    remark: Option<String>,
}

pub fn build_backend_partner_router(service: Arc<PartnerAdminService>) -> Router {
    Router::new()
        // Levels & commission config
        .route(
            "/backend/v3/api/partners/levels",
            get(fetch_levels).post(create_level),
        )
        .route(
            "/backend/v3/api/partners/levels/{levelId}",
            patch(update_level).delete(delete_level),
        )
        .route(
            "/backend/v3/api/partners/commission-config",
            get(fetch_commission_config).patch(update_commission_config),
        )
        // Partners
        .route(
            "/backend/v3/api/partners",
            get(fetch_partners).post(create_partner),
        )
        .route(
            "/backend/v3/api/partners/{partnerId}",
            get(fetch_partner).patch(update_partner),
        )
        .route(
            "/backend/v3/api/partners/{partnerId}/tree",
            get(fetch_partner_tree),
        )
        .route(
            "/backend/v3/api/partners/{partnerId}/ancestors",
            get(fetch_partner_ancestors),
        )
        // Join fees
        .route(
            "/backend/v3/api/partners/{partnerId}/join-fee-payments",
            get(fetch_join_fee_payments).post(create_join_fee_payment),
        )
        // Customer bindings
        .route(
            "/backend/v3/api/partners/{partnerId}/customers",
            get(fetch_customer_bindings),
        )
        .route(
            "/backend/v3/api/partners/customers",
            post(post_customer_binding),
        )
        .route(
            "/backend/v3/api/partners/customers/{bindingId}",
            axum::routing::delete(delete_customer_binding),
        )
        // Commission events & settlements
        .route(
            "/backend/v3/api/partners/commission-events",
            get(fetch_commission_events).post(create_manual_commission_event),
        )
        .route(
            "/backend/v3/api/partners/settlements/run",
            post(post_settlement_run),
        )
        .route(
            "/backend/v3/api/partners/settlements",
            get(fetch_settlements),
        )
        // Ledger
        .route(
            "/backend/v3/api/partners/{partnerId}/ledger",
            get(fetch_ledger_entries),
        )
        .route(
            "/backend/v3/api/partners/ledger/adjustments",
            post(post_ledger_adjustment),
        )
        // Withdrawals
        .route(
            "/backend/v3/api/partners/withdrawals",
            get(fetch_withdrawals).post(create_withdrawal),
        )
        .route(
            "/backend/v3/api/partners/withdrawals/{withdrawalId}/review",
            patch(review_withdrawal),
        )
        .route(
            "/backend/v3/api/partners/withdrawals/{withdrawalId}/pay",
            patch(pay_withdrawal),
        )
        // Stats
        .route(
            "/backend/v3/api/partners/stats/overview",
            get(fetch_stats_overview),
        )
        .route("/backend/v3/api/partners/stats", get(fetch_stats))
        .route(
            "/backend/v3/api/partners/{partnerId}/stats",
            get(fetch_partner_stats),
        )
        .with_state(PartnerAdminState { service })
}

fn read_scope(c: &WebRequestContext, i: IamAppContext) -> Result<PartnerAdminSubject, Response> {
    require_backend_operator(Some(c), i, READ_PERMISSION).map_err(|r| *r)
}

fn manage_scope(c: &WebRequestContext, i: IamAppContext) -> Result<PartnerAdminSubject, Response> {
    require_backend_operator(Some(c), i, MANAGE_PERMISSION).map_err(|r| *r)
}

fn parse_id(c: Option<&WebRequestContext>, value: &str, name: &str) -> Result<i64, Response> {
    value
        .trim()
        .parse::<i64>()
        .map_err(|_| validation(c, format!("{name} must be a positive integer")))
        .and_then(|id| {
            if id > 0 {
                Ok(id)
            } else {
                Err(validation(c, format!("{name} must be a positive integer")))
            }
        })
}

fn page_params(
    c: Option<&WebRequestContext>,
    q: &ListParams,
) -> Result<OffsetListPageParams, Response> {
    parse_page(c, q.page, q.page_size).map_err(|r| *r)
}

fn service_error(
    c: Option<&WebRequestContext>,
    operation: &'static str,
    error: CommerceServiceError,
) -> Response {
    tracing::error!(
        operation,
        error_code = error.code(),
        error = error.message(),
        "partner backend operation failed"
    );
    match error.code() {
        "validation" => validation(c, error.message()),
        "not-found" => not_found(c, "partner resource not found"),
        "conflict" => validation(c, error.message()),
        "unauthenticated" => unauthorized(c, "authentication is required"),
        "unauthorized" => forbidden(c, "permission is required"),
        _ => internal_error(c, "partner data operation failed"),
    }
}

async fn fetch_commission_config(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    match s.service.retrieve_commission_config(&scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "retrieve commission config", e),
    }
}

async fn update_commission_config(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<CommissionConfigRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let command = response_try!(UpdateCommissionConfigCommand::new(
        b.enabled,
        b.usage_settlement_enabled,
        b.recharge_enabled,
        b.max_commission_depth,
        &b.currency,
        response_try!(
            sdkwork_commerce_partner_service::domain::parse_money_to_cents(
                "min_withdrawal_amount",
                &b.min_withdrawal_amount,
            )
            .map_err(|e| validation(Some(&c), e.message()))
        ),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.update_commission_config(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "update commission config", e),
    }
}

async fn fetch_levels(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let query = ListPartnerLevelsQuery::new(true);
    match s.service.list_levels(query, &scope).await {
        Ok(v) => {
            let count = v.len() as i64;
            success_items(Some(&c), v, count, OffsetListPageParams::parse(None, None))
        }
        Err(e) => service_error(Some(&c), "list levels", e),
    }
}

async fn create_level(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<LevelRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let command = response_try!(build_create_level(&c, &b));
    match s.service.create_level(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create level", e),
    }
}

fn build_create_level(
    c: &WebRequestContext,
    b: &LevelRequest,
) -> Result<CreatePartnerLevelCommand, Response> {
    let customer_ratio = sdkwork_commerce_partner_service::domain::parse_ratio_per_10000(
        "customer_revenue_ratio",
        &b.customer_revenue_ratio,
    )
    .map_err(|e| validation(Some(c), e.message()))?;
    let join_fee_ratio = sdkwork_commerce_partner_service::domain::parse_ratio_per_10000(
        "join_fee_commission_ratio",
        &b.join_fee_commission_ratio,
    )
    .map_err(|e| validation(Some(c), e.message()))?;
    let join_fee =
        sdkwork_commerce_partner_service::domain::parse_money_to_cents("join_fee", &b.join_fee)
            .map_err(|e| validation(Some(c), e.message()))?;
    CreatePartnerLevelCommand::new(
        b.level_no,
        &b.name,
        customer_ratio,
        join_fee_ratio,
        join_fee,
        b.sort_order.unwrap_or(0),
    )
    .map_err(|e| validation(Some(c), e.message()))
}

async fn update_level(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Json(b): Json<LevelRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "levelId"));
    let customer_ratio = response_try!(
        sdkwork_commerce_partner_service::domain::parse_ratio_per_10000(
            "customer_revenue_ratio",
            &b.customer_revenue_ratio,
        )
        .map_err(|e| validation(Some(&c), e.message()))
    );
    let join_fee_ratio = response_try!(
        sdkwork_commerce_partner_service::domain::parse_ratio_per_10000(
            "join_fee_commission_ratio",
            &b.join_fee_commission_ratio,
        )
        .map_err(|e| validation(Some(&c), e.message()))
    );
    let join_fee = response_try!(
        sdkwork_commerce_partner_service::domain::parse_money_to_cents("join_fee", &b.join_fee)
            .map_err(|e| validation(Some(&c), e.message()))
    );
    let command = response_try!(UpdatePartnerLevelCommand::new(
        id,
        &b.name,
        customer_ratio,
        join_fee_ratio,
        join_fee,
        b.status.as_deref().unwrap_or("ACTIVE"),
        b.sort_order.unwrap_or(0),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.update_level(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "update level", e),
    }
}

async fn delete_level(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "levelId"));
    let command = response_try!(
        DeletePartnerLevelCommand::new(id).map_err(|e| validation(Some(&c), e.message()))
    );
    match s.service.delete_level(command, &scope).await {
        Ok(()) => no_content(Some(&c)),
        Err(e) => service_error(Some(&c), "delete level", e),
    }
}

async fn fetch_partners(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListPartnersQuery::new(list, q.status.clone(), q.level_no);
    match s.service.list_partners(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list partners", e),
    }
}

fn list_response<T: serde::Serialize>(
    c: Option<&WebRequestContext>,
    page: PartnerAdminListPage<T>,
    params: OffsetListPageParams,
) -> Response {
    success_items(c, page.items, page.total, params)
}

async fn create_partner(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<PartnerRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let command = response_try!(CreatePartnerCommand::new(
        &b.name,
        b.contact_name.as_deref().unwrap_or(""),
        b.phone.as_deref().unwrap_or(""),
        b.email.as_deref().unwrap_or(""),
        b.level_no,
        b.parent_partner_id,
        b.user_account_id,
        b.remark.as_deref().unwrap_or(""),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.create_partner(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create partner", e),
    }
}

async fn fetch_partner(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let query =
        response_try!(RetrievePartnerQuery::new(id).map_err(|e| validation(Some(&c), e.message())));
    match s.service.retrieve_partner(query, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "retrieve partner", e),
    }
}

async fn update_partner(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Json(b): Json<PartnerRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let command = response_try!(UpdatePartnerCommand::new(
        id,
        &b.name,
        b.contact_name.as_deref().unwrap_or(""),
        b.phone.as_deref().unwrap_or(""),
        b.email.as_deref().unwrap_or(""),
        b.level_no,
        b.status.as_deref().unwrap_or("ACTIVE"),
        b.remark.as_deref().unwrap_or(""),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.update_partner(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "update partner", e),
    }
}

async fn fetch_partner_tree(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let query =
        response_try!(RetrievePartnerQuery::new(id).map_err(|e| validation(Some(&c), e.message())));
    match s.service.list_partner_tree(query, &scope).await {
        Ok(v) => {
            let count = v.len() as i64;
            success_items(Some(&c), v, count, OffsetListPageParams::parse(None, None))
        }
        Err(e) => service_error(Some(&c), "list partner tree", e),
    }
}

async fn fetch_partner_ancestors(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let query =
        response_try!(RetrievePartnerQuery::new(id).map_err(|e| validation(Some(&c), e.message())));
    match s.service.list_partner_ancestors(query, &scope).await {
        Ok(v) => {
            let count = v.len() as i64;
            success_items(Some(&c), v, count, OffsetListPageParams::parse(None, None))
        }
        Err(e) => service_error(Some(&c), "list partner ancestors", e),
    }
}

async fn fetch_join_fee_payments(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListJoinFeePaymentsQuery::new(list, Some(id), q.status.clone());
    match s.service.list_join_fee_payments(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list join fee payments", e),
    }
}

async fn create_join_fee_payment(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Json(b): Json<JoinFeePaymentRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let amount = response_try!(
        sdkwork_commerce_partner_service::domain::parse_money_to_cents("amount", &b.amount)
            .map_err(|e| validation(Some(&c), e.message()))
    );
    let command = response_try!(CreateJoinFeePaymentCommand::new(
        id,
        amount,
        b.currency.as_deref().unwrap_or("CNY"),
        b.payment_method.as_deref().unwrap_or(""),
        b.remark.as_deref().unwrap_or(""),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.create_join_fee_payment(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create join fee payment", e),
    }
}

async fn fetch_customer_bindings(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListCustomerBindingsQuery::new(list, Some(id), q.status.clone());
    match s.service.list_customer_bindings(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list customer bindings", e),
    }
}

async fn post_customer_binding(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<BindCustomerRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let command = response_try!(BindCustomerCommand::new(
        b.partner_id,
        b.customer_user_id,
        b.binding_type.as_deref().unwrap_or("ADMIN_BIND"),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.bind_customer(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "bind customer", e),
    }
}

async fn delete_customer_binding(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "bindingId"));
    let command = response_try!(
        UnbindCustomerCommand::new(id).map_err(|e| validation(Some(&c), e.message()))
    );
    match s.service.unbind_customer(command, &scope).await {
        Ok(()) => no_content(Some(&c)),
        Err(e) => service_error(Some(&c), "unbind customer", e),
    }
}

async fn fetch_commission_events(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListCommissionEventsQuery::new(list, q.status.clone(), q.source_type.clone());
    match s.service.list_commission_events(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list commission events", e),
    }
}

async fn create_manual_commission_event(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<ManualCommissionEventRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let base_amount = response_try!(
        sdkwork_commerce_partner_service::domain::parse_money_to_cents(
            "base_amount",
            &b.base_amount
        )
        .map_err(|e| validation(Some(&c), e.message()))
    );
    let command = response_try!(CreateManualCommissionEventCommand::new(
        &b.source_ref,
        b.customer_user_id,
        base_amount,
        b.event_at.as_deref().unwrap_or(""),
        b.remark.as_deref().unwrap_or(""),
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s
        .service
        .create_manual_commission_event(command, &scope)
        .await
    {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create manual commission event", e),
    }
}

async fn post_settlement_run(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<SettlementRunRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let command = response_try!(RunCommissionSettlementCommand::new(b.limit.unwrap_or(100))
        .map_err(|e| validation(Some(&c), e.message())));
    match s.service.run_commission_settlement(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "run commission settlement", e),
    }
}

async fn fetch_settlements(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListSettlementsQuery::new(list, q.partner_id, q.status.clone());
    match s.service.list_settlements(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list settlements", e),
    }
}

async fn fetch_ledger_entries(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListLedgerEntriesQuery::new(list, id, q.entry_type.clone());
    match s.service.list_ledger_entries(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list ledger entries", e),
    }
}

async fn post_ledger_adjustment(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<LedgerAdjustmentRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let amount = response_try!(
        sdkwork_commerce_partner_service::domain::parse_money_to_cents("amount", &b.amount)
            .map_err(|e| validation(Some(&c), e.message()))
    );
    let command =
        response_try!(
            CreateLedgerAdjustmentCommand::new(b.partner_id, amount, &b.remark)
                .map_err(|e| validation(Some(&c), e.message()))
        );
    match s.service.create_ledger_adjustment(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create ledger adjustment", e),
    }
}

async fn fetch_withdrawals(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListWithdrawalsQuery::new(list, q.partner_id, q.status.clone());
    match s.service.list_withdrawals(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list withdrawals", e),
    }
}

async fn create_withdrawal(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<WithdrawalRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let amount = response_try!(
        sdkwork_commerce_partner_service::domain::parse_money_to_cents("amount", &b.amount)
            .map_err(|e| validation(Some(&c), e.message()))
    );
    let command = response_try!(CreateWithdrawalCommand::new(
        b.partner_id,
        amount,
        b.remark.as_deref().unwrap_or("")
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.create_withdrawal(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "create withdrawal", e),
    }
}

async fn review_withdrawal(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Json(b): Json<WithdrawalReviewRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "withdrawalId"));
    let command = response_try!(ReviewWithdrawalCommand::new(
        id,
        b.approve,
        b.review_remark.as_deref().unwrap_or("")
    )
    .map_err(|e| validation(Some(&c), e.message())));
    match s.service.review_withdrawal(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "review withdrawal", e),
    }
}

async fn pay_withdrawal(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
    Json(b): Json<WithdrawalPayRequest>,
) -> Response {
    let scope = response_try!(manage_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "withdrawalId"));
    let command = response_try!(
        PayWithdrawalCommand::new(id, b.remark.as_deref().unwrap_or(""))
            .map_err(|e| validation(Some(&c), e.message()))
    );
    match s.service.pay_withdrawal(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "pay withdrawal", e),
    }
}

async fn fetch_stats_overview(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    match s.service.retrieve_stats_overview(&scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "retrieve stats overview", e),
    }
}

async fn fetch_stats(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let params = response_try!(page_params(Some(&c), &q));
    let list =
        response_try!(
            PartnerAdminListQuery::new(params.page, params.page_size, q.q.clone())
                .map_err(|e| validation(Some(&c), e.message()))
        );
    let query = ListStatsSnapshotsQuery::new(list, q.partner_id, q.period_type.clone());
    match s.service.list_stats_snapshots(query, &scope).await {
        Ok(page) => list_response(Some(&c), page, params),
        Err(e) => service_error(Some(&c), "list stats snapshots", e),
    }
}

async fn fetch_partner_stats(
    State(s): State<PartnerAdminState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(read_scope(&c, i));
    let id = response_try!(parse_id(Some(&c), &id, "partnerId"));
    let query =
        response_try!(RetrievePartnerQuery::new(id).map_err(|e| validation(Some(&c), e.message())));
    match s.service.retrieve_partner_stats(query, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "retrieve partner stats", e),
    }
}
