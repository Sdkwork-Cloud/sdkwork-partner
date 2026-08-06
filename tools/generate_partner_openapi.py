#!/usr/bin/env python3
"""Generate the sdkwork-partner backend API OpenAPI authority contract.

The output `apis/backend-api/partner/sdkwork-partner-backend-api.openapi.json` is
the author-owned, human-reviewable SDK authority for the partner capability.
It mirrors the hand-written HTTP route manifest in
`crates/sdkwork-routes-partner-backend-api/src/http_route_manifest.rs`.

Usage: python -B -m tools.generate_partner_openapi
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "apis" / "backend-api" / "partner" / "sdkwork-partner-backend-api.openapi.json"

API_AUTHORITY = "sdkwork-partner-backend-api"
OWNER = "sdkwork-partner"
PREFIX = "/backend/v3/api"
READ_PERMISSION = "commerce.partner.read"
MANAGE_PERMISSION = "commerce.partner.manage"


def s(field_type, description, enum=None, nullable=False, fmt=None, const=None):
    schema = {"type": field_type, "description": description}
    if enum is not None:
        schema["enum"] = enum
    if nullable:
        schema["type"] = [field_type, "null"]
    if fmt:
        schema["format"] = fmt
    if const is not None:
        schema["const"] = const
    return schema


def integer(description, fmt="int64", nullable=False):
    return s("integer", description, fmt=fmt, nullable=nullable)


def string(description, enum=None, nullable=False):
    return s("string", description, enum=enum, nullable=nullable)


def money(description, nullable=False):
    return s("string", description, nullable=nullable)


def time_field(description, nullable=False):
    return s("string", description, nullable=nullable)


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def object_schema(required, properties):
    return {"type": "object", "required": required, "properties": properties}


def item_envelope(name, required, properties):
    """data: {item: X}"""
    data = object_schema(["item"], {"item": ref(name)})
    return envelope("SdkWorkApiResponse", data, required_data=["item"])


def list_envelope(name, required, properties):
    """data: {items: [X], pageInfo}"""
    data = object_schema(
        ["items", "pageInfo"],
        {"items": {"type": "array", "items": ref(name)}, "pageInfo": ref("PageInfo")},
    )
    return envelope("SdkWorkApiResponse", data, required_data=["items", "pageInfo"])


def envelope(base, data, required_data):
    return {
        "allOf": [
            ref(base),
            object_schema(required_data, {"data": data}),
        ]
    }


# ---------------------------------------------------------------------------
# Item schemas
# ---------------------------------------------------------------------------

partner_level_item = object_schema(
    [
        "id", "levelNo", "name", "customerRevenueRatio", "joinFeeCommissionRatio",
        "joinFee", "status", "sortOrder",
    ],
    {
        "id": integer("Level id."),
        "levelNo": integer("Level number (1-based).", fmt="int32"),
        "name": string("Level name."),
        "customerRevenueRatio": money("Customer revenue commission ratio (percent, e.g. 20.00)."),
        "joinFeeCommissionRatio": money("Join fee commission ratio (percent, e.g. 10.00)."),
        "joinFee": money("Join fee amount for this level."),
        "status": string("Level status.", enum=["ACTIVE", "DISABLED"]),
        "sortOrder": integer("Display sort order.", fmt="int32"),
    },
)

commission_config_item = object_schema(
    [
        "enabled", "usageSettlementEnabled", "rechargeEnabled", "maxCommissionDepth",
        "currency", "minWithdrawalAmount",
    ],
    {
        "enabled": s("boolean", "Global commission settlement toggle."),
        "usageSettlementEnabled": s("boolean", "Commission on usage settlement revenue."),
        "rechargeEnabled": s("boolean", "Commission on recharge revenue."),
        "maxCommissionDepth": integer("Max ancestor depth for commission (0 = unlimited)."),
        "currency": string("Commission currency code."),
        "minWithdrawalAmount": money("Minimum withdrawal amount."),
    },
)

partner_item = object_schema(
    [
        "id", "uuid", "name", "contactName", "phone", "email", "levelNo",
        "userAccountId", "status", "joinFeeAmount", "joinFeeStatus", "ownerId",
        "remark", "createdAt", "updatedAt",
    ],
    {
        "id": integer("Partner id."),
        "uuid": string("Partner uuid."),
        "name": string("Partner display name."),
        "contactName": string("Contact name."),
        "phone": string("Contact phone."),
        "email": string("Contact email."),
        "levelNo": integer("Partner level number.", fmt="int32"),
        "parentPartnerId": integer("Parent partner id (null = top level).", nullable=True),
        "userAccountId": integer("Bound IAM user account id."),
        "status": string("Partner status.", enum=["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]),
        "joinFeeAmount": money("Recorded join fee amount."),
        "joinFeeStatus": string("Join fee status.", enum=["UNPAID", "PAID"]),
        "joinedAt": time_field("Join timestamp.", nullable=True),
        "ownerId": integer("Operator id that created the partner."),
        "remark": string("Remark."),
        "createdAt": time_field("Created timestamp."),
        "updatedAt": time_field("Updated timestamp."),
    },
)

partner_tree_item = object_schema(
    ["id", "name", "levelNo", "status", "children"],
    {
        "id": integer("Partner id."),
        "name": string("Partner display name."),
        "levelNo": integer("Partner level number.", fmt="int32"),
        "status": string("Partner status."),
        "children": {"type": "array", "items": ref("PartnerTreeItem")},
    },
)

partner_ancestor_item = object_schema(
    ["id", "name", "levelNo", "status", "levelOffset"],
    {
        "id": integer("Partner id."),
        "name": string("Partner display name."),
        "levelNo": integer("Partner level number.", fmt="int32"),
        "status": string("Partner status."),
        "levelOffset": integer("0 = the partner itself, 1 = direct parent, ...", fmt="int32"),
    },
)

join_fee_payment_item = object_schema(
    ["id", "partnerId", "amount", "currency", "status", "paymentMethod", "remark", "createdAt"],
    {
        "id": integer("Payment id."),
        "partnerId": integer("Paying partner id."),
        "amount": money("Join fee amount."),
        "currency": string("Currency code."),
        "status": string("Payment status.", enum=["PAID", "REFUNDED"]),
        "paymentMethod": string("Payment method."),
        "paidAt": time_field("Paid timestamp.", nullable=True),
        "paidBy": integer("Operator id that recorded the payment.", nullable=True),
        "remark": string("Remark."),
        "createdAt": time_field("Created timestamp."),
    },
)

customer_binding_item = object_schema(
    ["id", "partnerId", "customerUserId", "bindingType", "status", "boundAt", "boundBy", "createdAt"],
    {
        "id": integer("Binding id."),
        "partnerId": integer("Partner id."),
        "customerUserId": integer("Customer (IAM user) id."),
        "bindingType": string("Binding type.", enum=["ADMIN_BIND"]),
        "status": string("Binding status.", enum=["ACTIVE", "UNBOUND"]),
        "boundAt": time_field("Bound timestamp."),
        "boundBy": integer("Operator id that bound the customer."),
        "unboundAt": time_field("Unbound timestamp.", nullable=True),
        "unboundBy": integer("Operator id that unbound the customer.", nullable=True),
        "createdAt": time_field("Created timestamp."),
    },
)

commission_event_item = object_schema(
    ["id", "sourceType", "sourceRef", "customerUserId", "baseAmount", "eventAt", "status", "remark", "createdAt"],
    {
        "id": integer("Event id."),
        "sourceType": string("Revenue source type.", enum=["USAGE_SETTLEMENT", "RECHARGE", "MANUAL"]),
        "sourceRef": string("Source reference (unique per source type)."),
        "customerUserId": integer("Customer (IAM user) id."),
        "baseAmount": money("Commissionable base amount."),
        "eventAt": time_field("Revenue event timestamp."),
        "status": string("Event status.", enum=["PENDING", "SETTLED", "SKIPPED", "FAILED"]),
        "settledAt": time_field("Settled timestamp.", nullable=True),
        "remark": string("Remark."),
        "createdAt": time_field("Created timestamp."),
    },
)

distribution_item = object_schema(
    ["id", "settlementId", "receiverPartnerId", "levelOffset", "ratio", "baseAmount", "amount", "createdAt"],
    {
        "id": integer("Distribution id."),
        "settlementId": integer("Settlement id."),
        "receiverPartnerId": integer("Receiving partner id."),
        "levelOffset": integer("0 = revenue owner, 1 = direct parent, ...", fmt="int32"),
        "ratio": money("Applied ratio (percent)."),
        "baseAmount": money("Base amount."),
        "amount": money("Distributed amount."),
        "createdAt": time_field("Created timestamp."),
    },
)

settlement_item = object_schema(
    ["id", "eventId", "baseAmount", "distributedAmount", "receiverCount", "status", "computedAt", "remark", "distributions"],
    {
        "id": integer("Settlement id."),
        "eventId": integer("Commission event id (0 = join-fee batch)."),
        "baseAmount": money("Base amount."),
        "distributedAmount": money("Total distributed amount."),
        "receiverCount": integer("Receiver count.", fmt="int32"),
        "status": string("Settlement status.", enum=["SETTLED", "SKIPPED"]),
        "computedAt": time_field("Computed timestamp."),
        "remark": string("Remark."),
        "distributions": {"type": "array", "items": ref("DistributionItem")},
    },
)

ledger_entry_item = object_schema(
    ["id", "partnerId", "entryType", "direction", "amount", "balanceAfter", "refType", "operatorId", "remark", "createdAt"],
    {
        "id": integer("Entry id."),
        "partnerId": integer("Partner id."),
        "entryType": string(
            "Entry type.",
            enum=[
                "JOIN_FEE_PAYMENT", "JOIN_FEE_COMMISSION", "REVENUE_COMMISSION",
                "WITHDRAWAL_APPLY", "WITHDRAWAL_REJECT", "WITHDRAWAL_PAID", "MANUAL_ADJUST",
            ],
        ),
        "direction": string("Balance direction.", enum=["IN", "OUT"]),
        "amount": money("Entry amount."),
        "balanceAfter": money("Available balance after the entry."),
        "refType": string("Reference type."),
        "refId": integer("Reference id.", nullable=True),
        "operatorId": integer("Operator id."),
        "remark": string("Remark."),
        "createdAt": time_field("Created timestamp."),
    },
)

withdrawal_item = object_schema(
    ["id", "partnerId", "amount", "status", "reviewRemark", "remark", "createdAt", "updatedAt"],
    {
        "id": integer("Withdrawal id."),
        "partnerId": integer("Partner id."),
        "amount": money("Withdrawal amount."),
        "status": string("Withdrawal status.", enum=["PENDING", "APPROVED", "REJECTED", "PAID"]),
        "reviewedBy": integer("Reviewer operator id.", nullable=True),
        "reviewedAt": time_field("Reviewed timestamp.", nullable=True),
        "reviewRemark": string("Review remark."),
        "paidAt": time_field("Paid timestamp.", nullable=True),
        "paidBy": integer("Paying operator id.", nullable=True),
        "remark": string("Remark."),
        "createdAt": time_field("Created timestamp."),
        "updatedAt": time_field("Updated timestamp."),
    },
)

stats_overview_item = object_schema(
    ["totalPartners", "activePartners", "totalJoinFee", "totalCommission", "pendingWithdrawalCount", "pendingWithdrawalAmount"],
    {
        "totalPartners": integer("Total partner count."),
        "activePartners": integer("Active partner count."),
        "totalJoinFee": money("Total recorded join fees."),
        "totalCommission": money("Total earned commission."),
        "pendingWithdrawalCount": integer("Pending withdrawal count."),
        "pendingWithdrawalAmount": money("Pending withdrawal amount."),
    },
)

stat_snapshot_item = object_schema(
    ["id", "partnerId", "periodStart", "periodEnd", "periodType", "joinFeeTotal", "customerCount", "revenueBase", "commissionEarned", "downstreamPartnerCount"],
    {
        "id": integer("Snapshot id."),
        "partnerId": integer("Partner id."),
        "periodStart": time_field("Period start."),
        "periodEnd": time_field("Period end."),
        "periodType": string("Period type.", enum=["DAY", "MONTH"]),
        "joinFeeTotal": money("Join fees in the period."),
        "customerCount": integer("Bound customer count."),
        "revenueBase": money("Commissionable revenue base."),
        "commissionEarned": money("Commission earned."),
        "downstreamPartnerCount": integer("Downstream partner count."),
    },
)

partner_stat_item = object_schema(
    ["partnerId", "totalJoinFee", "totalCommission", "availableBalance", "withdrawingAmount", "withdrawnAmount", "customerCount", "downstreamPartnerCount"],
    {
        "partnerId": integer("Partner id."),
        "totalJoinFee": money("Total paid join fees."),
        "totalCommission": money("Total earned commission."),
        "availableBalance": money("Available wallet balance."),
        "withdrawingAmount": money("Funds frozen by pending withdrawals."),
        "withdrawnAmount": money("Total withdrawn amount."),
        "customerCount": integer("Active bound customer count."),
        "downstreamPartnerCount": integer("Downstream partner count."),
    },
)

settlement_run_result = object_schema(
    ["processed", "settled", "skipped", "failed"],
    {
        "processed": integer("Events processed in the batch."),
        "settled": integer("Events settled with distributions."),
        "skipped": integer("Events skipped (no active binding or no allocation)."),
        "failed": integer("Events that failed during settlement."),
    },
)

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

commission_config_update_request = object_schema(
    ["enabled", "usageSettlementEnabled", "rechargeEnabled", "maxCommissionDepth", "currency", "minWithdrawalAmount"],
    {
        "enabled": s("boolean", "Global commission settlement toggle."),
        "usageSettlementEnabled": s("boolean", "Commission on usage settlement revenue."),
        "rechargeEnabled": s("boolean", "Commission on recharge revenue."),
        "maxCommissionDepth": integer("Max ancestor depth (0 = unlimited)."),
        "currency": string("Commission currency code."),
        "minWithdrawalAmount": money("Minimum withdrawal amount."),
    },
)

level_create_request = object_schema(
    ["levelNo", "name", "customerRevenueRatio", "joinFeeCommissionRatio", "joinFee"],
    {
        "levelNo": integer("Level number (1-based).", fmt="int32"),
        "name": string("Level name."),
        "customerRevenueRatio": money("Customer revenue commission ratio (percent)."),
        "joinFeeCommissionRatio": money("Join fee commission ratio (percent)."),
        "joinFee": money("Join fee amount."),
        "sortOrder": integer("Display sort order.", fmt="int32"),
    },
)

level_update_request = object_schema(
    ["name", "customerRevenueRatio", "joinFeeCommissionRatio", "joinFee", "status"],
    {
        "name": string("Level name."),
        "customerRevenueRatio": money("Customer revenue commission ratio (percent)."),
        "joinFeeCommissionRatio": money("Join fee commission ratio (percent)."),
        "joinFee": money("Join fee amount."),
        "status": string("Level status.", enum=["ACTIVE", "DISABLED"]),
        "sortOrder": integer("Display sort order.", fmt="int32"),
    },
)

partner_create_request = object_schema(
    ["name", "levelNo", "userAccountId"],
    {
        "name": string("Partner display name."),
        "contactName": string("Contact name."),
        "phone": string("Contact phone."),
        "email": string("Contact email."),
        "levelNo": integer("Partner level number.", fmt="int32"),
        "parentPartnerId": integer("Parent partner id (null = top level).", nullable=True),
        "userAccountId": integer("Bound IAM user account id."),
        "remark": string("Remark."),
    },
)

partner_update_request = object_schema(
    ["name", "levelNo", "status"],
    {
        "name": string("Partner display name."),
        "contactName": string("Contact name."),
        "phone": string("Contact phone."),
        "email": string("Contact email."),
        "levelNo": integer("Partner level number.", fmt="int32"),
        "status": string("Partner status.", enum=["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]),
        "remark": string("Remark."),
    },
)

join_fee_payment_create_request = object_schema(
    ["amount"],
    {
        "amount": money("Join fee amount paid."),
        "currency": string("Currency code (default CNY)."),
        "paymentMethod": string("Payment method."),
        "remark": string("Remark."),
    },
)

customer_bind_request = object_schema(
    ["partnerId", "customerUserId"],
    {
        "partnerId": integer("Partner id."),
        "customerUserId": integer("Customer (IAM user) id."),
        "bindingType": string("Binding type (default ADMIN_BIND).", enum=["ADMIN_BIND"]),
    },
)

commission_event_create_request = object_schema(
    ["sourceRef", "customerUserId", "baseAmount"],
    {
        "sourceRef": string("Source reference (unique for MANUAL events)."),
        "customerUserId": integer("Customer (IAM user) id."),
        "baseAmount": money("Commissionable base amount."),
        "eventAt": time_field("Revenue event timestamp (default now)."),
        "remark": string("Remark."),
    },
)

settlement_run_request = object_schema(
    [],
    {
        "limit": integer("Max events to process in this run (default 100)."),
    },
)

ledger_adjustment_request = object_schema(
    ["partnerId", "amount", "remark"],
    {
        "partnerId": integer("Partner id."),
        "amount": money("Adjustment amount (positive credits, negative debits)."),
        "remark": string("Adjustment reason (required)."),
    },
)

withdrawal_create_request = object_schema(
    ["partnerId", "amount"],
    {
        "partnerId": integer("Partner id."),
        "amount": money("Withdrawal amount."),
        "remark": string("Remark."),
    },
)

withdrawal_review_request = object_schema(
    ["approve"],
    {
        "approve": s("boolean", "true approves, false rejects."),
        "reviewRemark": string("Review remark."),
    },
)

withdrawal_pay_request = object_schema(
    [],
    {
        "remark": string("Payment remark."),
    },
)

# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------

def op(operation_id, summary, permission, responses, request_schema=None, query=None):
    operation = {
        "operationId": operation_id,
        "summary": summary,
        "tags": ["partners"],
        "x-sdkwork-owner": OWNER,
        "x-sdkwork-api-authority": API_AUTHORITY,
        "x-sdkwork-api-surface": "backend-api",
        "x-sdkwork-permission": permission,
        "responses": responses,
        "security": [{"AuthToken": [], "AccessToken": []}],
    }
    if request_schema is not None:
        operation["requestBody"] = {
            "required": True,
            "content": {"application/json": {"schema": ref(request_schema)}},
        }
    if query:
        operation["parameters"] = query
    return operation


def ok_item(envelope_name, description="OK"):
    return {"200": {"description": description, "content": {"application/json": {"schema": ref(envelope_name)}}}, **PROBLEM_RESPONSES}


def ok_created(envelope_name, description="Created"):
    return {"201": {"description": description, "content": {"application/json": {"schema": ref(envelope_name)}}}, **PROBLEM_RESPONSES}


def ok_no_content():
    return {"204": {"description": "No Content"}, **PROBLEM_RESPONSES}


PROBLEM_RESPONSES = {
    "400": {"description": "Bad Request", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "401": {"description": "Unauthorized", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "403": {"description": "Forbidden", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "404": {"description": "Not Found", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "409": {"description": "Conflict", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "500": {"description": "Server Error", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
    "default": {"description": "Error response.", "content": {"application/problem+json": {"schema": ref("ProblemDetail")}}},
}


def list_query():
    return [
        {"name": "page", "in": "query", "schema": {"type": "integer", "format": "int32", "minimum": 1, "default": 1}},
        {"name": "page_size", "in": "query", "schema": {"type": "integer", "format": "int32", "minimum": 1, "maximum": 200, "default": 20}},
        {"name": "q", "in": "query", "schema": {"type": "string", "maxLength": 128}},
    ]


def path_id(name, description):
    return {"name": name, "in": "path", "required": True, "schema": {"type": "integer", "format": "int64"}, "description": description}


OPERATIONS = [
    # Levels & commission config
    ("get", f"{PREFIX}/partners/levels", op("levels.list", "List partner levels", READ_PERMISSION, ok_item("PartnerLevelListEnvelope"))),
    ("post", f"{PREFIX}/partners/levels", op("levels.create", "Create a partner level", MANAGE_PERMISSION, ok_created("PartnerLevelItemEnvelope"), "AdminPartnerLevelCreateRequest")),
    ("patch", f"{PREFIX}/partners/levels/{{levelId}}", op("levels.update", "Update a partner level", MANAGE_PERMISSION, ok_item("PartnerLevelItemEnvelope"), "AdminPartnerLevelUpdateRequest", [path_id("levelId", "Level id.")])),
    ("delete", f"{PREFIX}/partners/levels/{{levelId}}", op("levels.delete", "Delete a partner level", MANAGE_PERMISSION, ok_no_content(), query=[path_id("levelId", "Level id.")])),
    ("get", f"{PREFIX}/partners/commission_config", op("commissionConfig.retrieve", "Retrieve the commission configuration", READ_PERMISSION, ok_item("CommissionConfigItemEnvelope"))),
    ("patch", f"{PREFIX}/partners/commission_config", op("commissionConfig.update", "Update the commission configuration", MANAGE_PERMISSION, ok_item("CommissionConfigItemEnvelope"), "AdminCommissionConfigUpdateRequest")),
    # Partners
    ("get", f"{PREFIX}/partners", op("partner.list", "List partners", READ_PERMISSION, ok_item("PartnerListEnvelope"), query=list_query() + [
        {"name": "status", "in": "query", "schema": {"type": "string", "enum": ["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]}},
        {"name": "level_no", "in": "query", "schema": {"type": "integer", "format": "int32"}},
    ])),
    ("post", f"{PREFIX}/partners", op("partner.create", "Create a partner", MANAGE_PERMISSION, ok_created("PartnerItemEnvelope"), "AdminPartnerCreateRequest")),
    ("get", f"{PREFIX}/partners/{{partnerId}}", op("partner.retrieve", "Retrieve a partner", READ_PERMISSION, ok_item("PartnerItemEnvelope"), query=[path_id("partnerId", "Partner id.")])),
    ("patch", f"{PREFIX}/partners/{{partnerId}}", op("partner.update", "Update a partner", MANAGE_PERMISSION, ok_item("PartnerItemEnvelope"), "AdminPartnerUpdateRequest", [path_id("partnerId", "Partner id.")])),
    ("get", f"{PREFIX}/partners/{{partnerId}}/tree", op("partner.tree.list", "List the partner descendant tree", READ_PERMISSION, ok_item("PartnerTreeListEnvelope"), query=[path_id("partnerId", "Partner id.")])),
    ("get", f"{PREFIX}/partners/{{partnerId}}/ancestors", op("partner.ancestors.list", "List the partner ancestor chain", READ_PERMISSION, ok_item("PartnerAncestorListEnvelope"), query=[path_id("partnerId", "Partner id.")])),
    # Join fees
    ("get", f"{PREFIX}/partners/{{partnerId}}/join_fee_payments", op("joinFeePayments.list", "List join fee payments of a partner", READ_PERMISSION, ok_item("JoinFeePaymentListEnvelope"), query=[path_id("partnerId", "Partner id.")] + list_query())),
    ("post", f"{PREFIX}/partners/{{partnerId}}/join_fee_payments", op("joinFeePayments.create", "Record a join fee payment and trigger ancestor commission", MANAGE_PERMISSION, ok_created("JoinFeePaymentItemEnvelope"), "AdminJoinFeePaymentCreateRequest", [path_id("partnerId", "Partner id.")])),
    # Customer bindings
    ("get", f"{PREFIX}/partners/{{partnerId}}/customers", op("customerBindings.list", "List customer bindings of a partner", READ_PERMISSION, ok_item("CustomerBindingListEnvelope"), query=[path_id("partnerId", "Partner id.")] + list_query())),
    ("post", f"{PREFIX}/partners/customers", op("customerBindings.create", "Bind a customer to a partner", MANAGE_PERMISSION, ok_created("CustomerBindingItemEnvelope"), "AdminCustomerBindRequest")),
    ("delete", f"{PREFIX}/partners/customers/{{bindingId}}", op("customerBindings.delete", "Unbind a customer from a partner", MANAGE_PERMISSION, ok_no_content(), query=[path_id("bindingId", "Binding id.")])),
    # Commission events & settlements
    ("get", f"{PREFIX}/partners/commission_events", op("commissionEvents.list", "List commission revenue events", READ_PERMISSION, ok_item("CommissionEventListEnvelope"), query=list_query() + [
        {"name": "status", "in": "query", "schema": {"type": "string", "enum": ["PENDING", "SETTLED", "SKIPPED", "FAILED"]}},
        {"name": "source_type", "in": "query", "schema": {"type": "string", "enum": ["USAGE_SETTLEMENT", "RECHARGE", "MANUAL"]}},
    ])),
    ("post", f"{PREFIX}/partners/commission_events", op("commissionEvents.create", "Create a manual commission revenue event", MANAGE_PERMISSION, ok_created("CommissionEventItemEnvelope"), "AdminCommissionEventCreateRequest")),
    ("post", f"{PREFIX}/partners/settlements/run", op("settlements.run", "Run commission settlement for pending events", MANAGE_PERMISSION, ok_item("SettlementRunResultEnvelope"), "AdminSettlementRunRequest")),
    ("get", f"{PREFIX}/partners/settlements", op("settlements.list", "List commission settlements", READ_PERMISSION, ok_item("SettlementListEnvelope"), query=list_query() + [
        {"name": "partner_id", "in": "query", "schema": {"type": "integer", "format": "int64"}},
        {"name": "status", "in": "query", "schema": {"type": "string", "enum": ["SETTLED", "SKIPPED"]}},
    ])),
    # Ledger
    ("get", f"{PREFIX}/partners/{{partnerId}}/ledger", op("ledgerEntries.list", "List ledger entries of a partner", READ_PERMISSION, ok_item("LedgerEntryListEnvelope"), query=[path_id("partnerId", "Partner id.")] + list_query() + [
        {"name": "entry_type", "in": "query", "schema": {"type": "string"}},
    ])),
    ("post", f"{PREFIX}/partners/ledger/adjustments", op("ledgerEntries.create", "Create a manual ledger adjustment", MANAGE_PERMISSION, ok_created("LedgerEntryItemEnvelope"), "AdminLedgerAdjustmentRequest")),
    # Withdrawals
    ("get", f"{PREFIX}/partners/withdrawals", op("withdrawals.list", "List withdrawal requests", READ_PERMISSION, ok_item("WithdrawalListEnvelope"), query=list_query() + [
        {"name": "partner_id", "in": "query", "schema": {"type": "integer", "format": "int64"}},
        {"name": "status", "in": "query", "schema": {"type": "string", "enum": ["PENDING", "APPROVED", "REJECTED", "PAID"]}},
    ])),
    ("post", f"{PREFIX}/partners/withdrawals", op("withdrawals.create", "Create a withdrawal request", MANAGE_PERMISSION, ok_created("WithdrawalItemEnvelope"), "AdminWithdrawalCreateRequest")),
    ("patch", f"{PREFIX}/partners/withdrawals/{{withdrawalId}}/review", op("withdrawalReviews.update", "Approve or reject a withdrawal request", MANAGE_PERMISSION, ok_item("WithdrawalItemEnvelope"), "AdminWithdrawalReviewRequest", [path_id("withdrawalId", "Withdrawal id.")])),
    ("patch", f"{PREFIX}/partners/withdrawals/{{withdrawalId}}/pay", op("withdrawalPayments.update", "Mark an approved withdrawal as paid", MANAGE_PERMISSION, ok_item("WithdrawalItemEnvelope"), "AdminWithdrawalPayRequest", [path_id("withdrawalId", "Withdrawal id.")])),
    # Stats
    ("get", f"{PREFIX}/partners/stats/overview", op("statsOverview.list", "Retrieve partner stats overview", READ_PERMISSION, ok_item("StatsOverviewItemEnvelope"))),
    ("get", f"{PREFIX}/partners/stats", op("stats.list", "List partner stats snapshots", READ_PERMISSION, ok_item("StatSnapshotListEnvelope"), query=list_query() + [
        {"name": "partner_id", "in": "query", "schema": {"type": "integer", "format": "int64"}},
        {"name": "period_type", "in": "query", "schema": {"type": "string", "enum": ["DAY", "MONTH"]}},
    ])),
    ("get", f"{PREFIX}/partners/{{partnerId}}/stats", op("stats.retrieve", "Retrieve a partner's aggregated stats", READ_PERMISSION, ok_item("PartnerStatItemEnvelope"), query=[path_id("partnerId", "Partner id.")])),
]

# ---------------------------------------------------------------------------
# Assemble the document
# ---------------------------------------------------------------------------

PATHS = {}
for method, operation_path, operation in OPERATIONS:
    PATHS.setdefault(operation_path, {})[method] = operation

SCHEMAS = {
    "ProblemDetail": {
        "type": "object",
        "required": ["type", "title", "status", "detail", "code", "traceId"],
        "properties": {
            "type": {"type": "string"},
            "title": {"type": "string"},
            "status": {"type": "integer", "format": "int32"},
            "detail": {"type": "string"},
            "code": {"type": "integer", "format": "int32"},
            "traceId": {"type": "string"},
        },
    },
    "PageInfo": {
        "type": "object",
        "required": ["mode", "page", "pageSize", "totalItems", "totalPages", "hasMore"],
        "properties": {
            "mode": {"type": "string", "enum": ["offset"]},
            "page": {"type": "integer", "format": "int64"},
            "pageSize": {"type": "integer", "format": "int64"},
            "totalItems": {"type": "integer", "format": "int64"},
            "totalPages": {"type": "integer", "format": "int64"},
            "hasMore": {"type": "boolean"},
        },
    },
    "SdkWorkApiResponse": {
        "type": "object",
        "required": ["code", "traceId"],
        "properties": {
            "code": {"type": "integer", "format": "int32", "const": 0},
            "traceId": {"type": "string"},
        },
    },
    "PartnerLevelItem": partner_level_item,
    "PartnerLevelListEnvelope": list_envelope("PartnerLevelItem", None, None),
    "PartnerLevelItemEnvelope": item_envelope("PartnerLevelItem", None, None),
    "AdminPartnerLevelCreateRequest": level_create_request,
    "AdminPartnerLevelUpdateRequest": level_update_request,
    "CommissionConfigItem": commission_config_item,
    "CommissionConfigItemEnvelope": item_envelope("CommissionConfigItem", None, None),
    "AdminCommissionConfigUpdateRequest": commission_config_update_request,
    "PartnerItem": partner_item,
    "PartnerListEnvelope": list_envelope("PartnerItem", None, None),
    "PartnerItemEnvelope": item_envelope("PartnerItem", None, None),
    "AdminPartnerCreateRequest": partner_create_request,
    "AdminPartnerUpdateRequest": partner_update_request,
    "PartnerTreeItem": partner_tree_item,
    "PartnerTreeListEnvelope": item_envelope("PartnerTreeItem", None, None),
    "PartnerAncestorItem": partner_ancestor_item,
    "PartnerAncestorListEnvelope": item_envelope("PartnerAncestorItem", None, None),
    "JoinFeePaymentItem": join_fee_payment_item,
    "JoinFeePaymentListEnvelope": list_envelope("JoinFeePaymentItem", None, None),
    "JoinFeePaymentItemEnvelope": item_envelope("JoinFeePaymentItem", None, None),
    "AdminJoinFeePaymentCreateRequest": join_fee_payment_create_request,
    "CustomerBindingItem": customer_binding_item,
    "CustomerBindingListEnvelope": list_envelope("CustomerBindingItem", None, None),
    "CustomerBindingItemEnvelope": item_envelope("CustomerBindingItem", None, None),
    "AdminCustomerBindRequest": customer_bind_request,
    "CommissionEventItem": commission_event_item,
    "CommissionEventListEnvelope": list_envelope("CommissionEventItem", None, None),
    "CommissionEventItemEnvelope": item_envelope("CommissionEventItem", None, None),
    "AdminCommissionEventCreateRequest": commission_event_create_request,
    "SettlementRunResult": settlement_run_result,
    "SettlementRunResultEnvelope": item_envelope("SettlementRunResult", None, None),
    "AdminSettlementRunRequest": settlement_run_request,
    "SettlementItem": settlement_item,
    "SettlementListEnvelope": list_envelope("SettlementItem", None, None),
    "DistributionItem": distribution_item,
    "LedgerEntryItem": ledger_entry_item,
    "LedgerEntryListEnvelope": list_envelope("LedgerEntryItem", None, None),
    "LedgerEntryItemEnvelope": item_envelope("LedgerEntryItem", None, None),
    "AdminLedgerAdjustmentRequest": ledger_adjustment_request,
    "WithdrawalItem": withdrawal_item,
    "WithdrawalListEnvelope": list_envelope("WithdrawalItem", None, None),
    "WithdrawalItemEnvelope": item_envelope("WithdrawalItem", None, None),
    "AdminWithdrawalCreateRequest": withdrawal_create_request,
    "AdminWithdrawalReviewRequest": withdrawal_review_request,
    "AdminWithdrawalPayRequest": withdrawal_pay_request,
    "StatsOverviewItem": stats_overview_item,
    "StatsOverviewItemEnvelope": item_envelope("StatsOverviewItem", None, None),
    "StatSnapshotItem": stat_snapshot_item,
    "StatSnapshotListEnvelope": list_envelope("StatSnapshotItem", None, None),
    "PartnerStatItem": partner_stat_item,
    "PartnerStatItemEnvelope": item_envelope("PartnerStatItem", None, None),
}

# tree envelope holds an array as the item payload
SCHEMAS["PartnerTreeListEnvelope"] = {
    "allOf": [
        ref("SdkWorkApiResponse"),
        {
            "type": "object",
            "required": ["data"],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["item"],
                    "properties": {
                        "item": {"type": "array", "items": ref("PartnerTreeItem")},
                    },
                }
            },
        },
    ]
}
SCHEMAS["PartnerAncestorListEnvelope"] = {
    "allOf": [
        ref("SdkWorkApiResponse"),
        {
            "type": "object",
            "required": ["data"],
            "properties": {
                "data": {
                    "type": "object",
                    "required": ["item"],
                    "properties": {
                        "item": {"type": "array", "items": ref("PartnerAncestorItem")},
                    },
                }
            },
        },
    ]
}

RESPONSES = {
    f"{name}Response": {"description": "Success", "content": {"application/json": {"schema": ref(name)}}}
    for name in [
        "PartnerLevelListEnvelope", "PartnerLevelItemEnvelope", "CommissionConfigItemEnvelope",
        "PartnerListEnvelope", "PartnerItemEnvelope", "PartnerTreeListEnvelope",
        "PartnerAncestorListEnvelope", "JoinFeePaymentListEnvelope", "JoinFeePaymentItemEnvelope",
        "CustomerBindingListEnvelope", "CustomerBindingItemEnvelope", "CommissionEventListEnvelope",
        "CommissionEventItemEnvelope", "SettlementRunResultEnvelope", "SettlementListEnvelope",
        "LedgerEntryListEnvelope", "LedgerEntryItemEnvelope", "WithdrawalListEnvelope",
        "WithdrawalItemEnvelope", "StatsOverviewItemEnvelope", "StatSnapshotListEnvelope",
        "PartnerStatItemEnvelope",
    ]
}

# Wire operation 200/201 responses to the response components.
for method, operation_path, operation in OPERATIONS:
    if "200" in operation["responses"] and "schema" in operation["responses"]["200"]["content"]["application/json"]:
        schema_ref = operation["responses"]["200"]["content"]["application/json"]["schema"]
        envelope_name = schema_ref["$ref"].split("/")[-1]
        operation["responses"]["200"] = {"$ref": f"#/components/responses/{envelope_name}Response"}
    if "201" in operation["responses"] and "schema" in operation["responses"]["201"]["content"]["application/json"]:
        schema_ref = operation["responses"]["201"]["content"]["application/json"]["schema"]
        envelope_name = schema_ref["$ref"].split("/")[-1]
        operation["responses"]["201"] = {"$ref": f"#/components/responses/{envelope_name}Response"}

DOCUMENT = {
    "openapi": "3.1.2",
    "info": {
        "title": "SDKWork Partner Backend API",
        "version": "0.1.0",
        "description": "Backend administration API for the multi-level partner (agent) management system: levels and commission ratios, partners, join fees, customer bindings, commission events and settlements, ledger, withdrawals, and stats.",
        "x-sdkwork-api-authority": API_AUTHORITY,
        "x-sdkwork-sdk-family": "sdkwork-partner-backend-sdk",
        "x-sdkwork-owner": OWNER,
    },
    "servers": [{"url": "http://127.0.0.1:8080"}],
    "tags": [{"name": "partners", "description": "partner operations exposed by sdkwork-partner."}],
    "paths": PATHS,
    "components": {
        "securitySchemes": {
            "AuthToken": {"type": "http", "scheme": "bearer"},
            "AccessToken": {"type": "apiKey", "in": "header", "name": "Access-Token"},
        },
        "schemas": SCHEMAS,
        "responses": RESPONSES,
    },
    "x-api-prefix": PREFIX,
    "x-sdk-client": "SdkworkPartnerBackendClient",
    "x-sdk-family": "sdkwork-partner-backend-sdk",
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(DOCUMENT, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
count = len(OPERATIONS)
print(f"[generate_partner_openapi] wrote {OUTPUT} ({count} operations)")
