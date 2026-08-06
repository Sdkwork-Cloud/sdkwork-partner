use sdkwork_commerce_partner_service::backend_admin::PartnerAdminSubject;
use sdkwork_iam_context_service::IamAppContext;

pub(crate) fn backend_operator_scope_from_iam(
    context: &IamAppContext,
) -> Result<PartnerAdminSubject, String> {
    let tenant_id = context
        .tenant_id
        .trim()
        .parse::<i64>()
        .map_err(|_| "authenticated runtime context tenant_id must be numeric".to_owned())?;
    let organization_id = context
        .organization_id
        .as_deref()
        .unwrap_or("0")
        .trim()
        .parse::<i64>()
        .map_err(|_| "authenticated runtime context organization_id must be numeric".to_owned())?;
    let user_id = context
        .user_id
        .trim()
        .parse::<i64>()
        .map_err(|_| "authenticated runtime context user_id must be numeric".to_owned())?;
    PartnerAdminSubject::new(tenant_id, organization_id, user_id).map_err(|error| error.to_owned())
}
