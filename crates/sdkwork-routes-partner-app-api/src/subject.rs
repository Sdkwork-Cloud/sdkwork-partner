use sdkwork_commerce_partner_service::join_apply::PartnerJoinSubject;
use sdkwork_iam_context_service::IamAppContext;

/// Derive the app join subject from an authenticated IAM app context.
pub(crate) fn app_join_subject_from_iam(
    context: &IamAppContext,
) -> Result<PartnerJoinSubject, String> {
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
    PartnerJoinSubject::new(tenant_id, organization_id, user_id).map_err(|error| error.to_owned())
}

/// Platform tenant that owns the commercial partner program catalog and
/// install-time seed data (matches the tenant used by the seed scripts).
const PLATFORM_TENANT_ID: i64 = 100_001;
const PLATFORM_ORGANIZATION_ID: i64 = 0;

/// Public (anonymous) join scope.
///
/// Anonymous visitors (partner join landing page, invite-code check) carry no
/// IAM principal. When the visitor already holds a portal session the tenant
/// scope of that session is honored; otherwise the platform tenant
/// (100001/0, the install-time seed tenant) is used so the public catalog
/// always resolves the commercial level directory.
pub(crate) fn public_join_scope(context: Option<&IamAppContext>) -> PartnerJoinSubject {
    if let Some(context) = context {
        if let Ok(subject) = app_join_subject_from_iam(context) {
            return PartnerJoinSubject::public_scope(subject.tenant_id, subject.organization_id);
        }
    }
    PartnerJoinSubject::public_scope(PLATFORM_TENANT_ID, PLATFORM_ORGANIZATION_ID)
}
