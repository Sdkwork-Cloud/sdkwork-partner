# SDKWork Partner App API Changelog

## 0.1.0

- **Partner join (伙伴计划) marketing module**: new user-facing app-api surface
  for the partner program front door.
  - `GET /app/v3/api/partner-join` (public) returns the partner program
    catalog for the landing page: active level ladder (join fees, customer
    revenue pools, join fee commission pools, benefits) plus global commission
    rules (currency, profit margin ratio, minimum withdrawal, join fee policy).
  - `POST /app/v3/api/partner-join/applications` submits a join application
    for the current session user (INDIVIDUAL / ORGANIZATION subject, contact
    info, aspirational level, optional invite code validated and locking the
    inviter partner). Business-idempotent: an active SUBMITTED application
    blocks a second submission.
  - `GET /app/v3/api/partner-join/applications/mine` lists the caller's
    applications (including rejected/cancelled history), newest first.
  - `POST /app/v3/api/partner-join/applications/{applicationId}/cancel`
    withdraws the caller's own SUBMITTED application.
  - `GET /app/v3/api/partner-join/invite-codes/{code}` (public) validates an
    invite code for the apply form (active partner with a non-deleted invite
    code required).
- Review of applications lives on the management surface
  (`sdkwork-partner-backend-api` 0.6.0); approvals create the partner record
  through the existing partner creation path (status PENDING) so the
  settlement/commission engine is untouched.
