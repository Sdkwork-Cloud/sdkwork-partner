use std::sync::Arc;

use axum::extract::{Extension, Path, Query, State};
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use sdkwork_commerce_partner_service::join_apply::{
    CancelJoinApplicationCommand, ListMyJoinApplicationsQuery, PartnerJoinService,
    PartnerJoinSubject, SubmitJoinApplicationCommand,
};
use sdkwork_contract_service::CommerceServiceError;
use sdkwork_iam_context_service::IamAppContext;
use sdkwork_utils_rust::OffsetListPageParams;
use sdkwork_web_core::WebRequestContext;
use serde::Deserialize;

use crate::api_response::{
    conflict, internal_error, not_found, parse_page, success_created, success_item, success_items,
    unauthorized, validation,
};
use crate::subject::{app_join_subject_from_iam, public_join_scope};

#[derive(Clone)]
struct PartnerJoinState {
    service: Arc<PartnerJoinService>,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitJoinApplicationRequest {
    applicant_type: String,
    subject_name: Option<String>,
    contact_name: String,
    contact_phone: String,
    contact_email: String,
    target_level_no: Option<i32>,
    invite_code: Option<String>,
    business_intro: Option<String>,
}

pub fn build_partner_join_router(service: Arc<PartnerJoinService>) -> Router {
    Router::new()
        .route("/app/v3/api/partner_join", get(fetch_program))
        .route(
            "/app/v3/api/partner_join/applications",
            post(submit_application),
        )
        .route(
            "/app/v3/api/partner_join/applications/mine",
            get(list_my_applications),
        )
        .route(
            "/app/v3/api/partner_join/applications/{applicationId}/cancel",
            post(cancel_application),
        )
        .route(
            "/app/v3/api/partner_join/invite_codes/{code}",
            get(validate_invite_code),
        )
        .with_state(PartnerJoinState { service })
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
        "partner join operation failed"
    );
    match error.code() {
        "validation" => validation(c, error.message()),
        "not-found" => not_found(c, "partner join resource not found"),
        "conflict" => conflict(c, error.message()),
        "unauthenticated" => unauthorized(c, "authentication is required"),
        "unauthorized" => unauthorized(c, "permission is required"),
        _ => internal_error(c, "partner join data operation failed"),
    }
}

async fn fetch_program(
    State(s): State<PartnerJoinState>,
    runtime_context: Option<Extension<IamAppContext>>,
    Extension(c): Extension<WebRequestContext>,
) -> Response {
    let scope = public_join_scope(runtime_context.as_ref().map(|ext| &ext.0));
    match s
        .service
        .retrieve_program(scope.tenant_id, scope.organization_id)
        .await
    {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "retrieve partner join program", e),
    }
}

async fn submit_application(
    State(s): State<PartnerJoinState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Json(b): Json<SubmitJoinApplicationRequest>,
) -> Response {
    let scope = response_try!(require_app_subject(&c, &i));
    let command = response_try!(build_submit_command(&c, &b));
    match s.service.submit_application(command, &scope).await {
        Ok(v) => success_created(Some(&c), v),
        Err(e) => service_error(Some(&c), "submit partner join application", e),
    }
}

async fn list_my_applications(
    State(s): State<PartnerJoinState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Query(q): Query<ListParams>,
) -> Response {
    let scope = response_try!(require_app_subject(&c, &i));
    let params = response_try!(parse_page(Some(&c), q.page, q.page_size).map_err(|r| *r));
    let query = response_try!(build_mine_query(&c, &params));
    match s.service.list_my_applications(query, &scope).await {
        Ok(page) => success_items(Some(&c), page.items, page.total, params),
        Err(e) => service_error(Some(&c), "list my partner join applications", e),
    }
}

async fn cancel_application(
    State(s): State<PartnerJoinState>,
    Extension(i): Extension<IamAppContext>,
    Extension(c): Extension<WebRequestContext>,
    Path(id): Path<String>,
) -> Response {
    let scope = response_try!(require_app_subject(&c, &i));
    let id = response_try!(parse_id(Some(&c), &id, "applicationId"));
    let command = response_try!(
        CancelJoinApplicationCommand::new(id).map_err(|e| validation(Some(&c), e.message()))
    );
    match s.service.cancel_application(command, &scope).await {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "cancel partner join application", e),
    }
}

async fn validate_invite_code(
    State(s): State<PartnerJoinState>,
    runtime_context: Option<Extension<IamAppContext>>,
    Extension(c): Extension<WebRequestContext>,
    Path(code): Path<String>,
) -> Response {
    let scope = public_join_scope(runtime_context.as_ref().map(|ext| &ext.0));
    match s
        .service
        .validate_invite_code(scope.tenant_id, scope.organization_id, &code)
        .await
    {
        Ok(v) => success_item(Some(&c), v),
        Err(e) => service_error(Some(&c), "validate partner join invite code", e),
    }
}

// axum handler helpers return `Result<_, Response>` by framework convention;
// boxing the error type adds no benefit at these call sites.
#[allow(clippy::result_large_err)]
fn require_app_subject(
    c: &WebRequestContext,
    i: &IamAppContext,
) -> Result<PartnerJoinSubject, Response> {
    app_join_subject_from_iam(i).map_err(|message| unauthorized(Some(c), message))
}

// axum handler helpers return `Result<_, Response>` by framework convention;
// boxing the error type adds no benefit at these call sites.
#[allow(clippy::result_large_err)]
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

// axum handler helpers return `Result<_, Response>` by framework convention;
// boxing the error type adds no benefit at these call sites.
#[allow(clippy::result_large_err)]
fn build_submit_command(
    c: &WebRequestContext,
    b: &SubmitJoinApplicationRequest,
) -> Result<SubmitJoinApplicationCommand, Response> {
    SubmitJoinApplicationCommand::new(
        &b.applicant_type,
        b.subject_name.as_deref().unwrap_or(""),
        &b.contact_name,
        &b.contact_phone,
        &b.contact_email,
        b.target_level_no.unwrap_or(1),
        b.invite_code.as_deref().unwrap_or(""),
        b.business_intro.as_deref().unwrap_or(""),
    )
    .map_err(|e| validation(Some(c), e.message()))
}

// axum handler helpers return `Result<_, Response>` by framework convention;
// boxing the error type adds no benefit at these call sites.
#[allow(clippy::result_large_err)]
fn build_mine_query(
    c: &WebRequestContext,
    params: &OffsetListPageParams,
) -> Result<ListMyJoinApplicationsQuery, Response> {
    let list = sdkwork_commerce_partner_service::queries::PartnerAdminListQuery::new(
        params.page,
        params.page_size,
        None,
    )
    .map_err(|e| validation(Some(c), e.message()))?;
    Ok(ListMyJoinApplicationsQuery::new(list))
}
