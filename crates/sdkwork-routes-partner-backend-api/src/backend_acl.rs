use axum::response::Response;
use sdkwork_commerce_partner_service::backend_admin::PartnerAdminSubject;
use sdkwork_iam_context_service::IamAppContext;
use sdkwork_web_core::WebRequestContext;

use crate::api_response::{forbidden, unauthorized};
use crate::subject::backend_operator_scope_from_iam;

pub(crate) fn require_backend_operator(
    context: Option<&WebRequestContext>,
    iam: IamAppContext,
    required_permission: &str,
) -> Result<PartnerAdminSubject, Box<Response>> {
    if !iam.can_access_backend_api() {
        return Err(Box::new(forbidden(
            context,
            "backend api access requires an organization-scoped session",
        )));
    }
    if !iam.has_permission(required_permission) {
        return Err(Box::new(forbidden(
            context,
            format!("missing required permission: {required_permission}"),
        )));
    }
    backend_operator_scope_from_iam(&iam)
        .map_err(|message| Box::new(unauthorized(context, message)))
}
