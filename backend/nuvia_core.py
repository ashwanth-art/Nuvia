from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from typing import Any


SENSITIVE_FIELDS = {
    "email",
    "phone",
    "address",
    "full_name",
    "government_id",
    "card_number",
    "cvv",
    "payment_token",
    "account_number",
}

SUPPORTED_EVENT_TYPES = {"checkout.started", "loyalty.redemption.requested"}

DEFAULT_POLICIES = {
    "consent_required": True,
    "minimum_average_margin_percent": 25,
    "review_fraud_risk_threshold": 0.45,
    "block_fraud_risk_threshold": 0.8,
    "human_review_basket_threshold": 250,
    "max_points_multiplier": 2,
}


class NuviaValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Scenario:
    key: str
    name: str
    description: str
    overrides: dict[str, Any]


SCENARIOS = [
    Scenario(
        key="safe-offer",
        name="Safe checkout offer",
        description="Low fraud, valid consent, good basket margin. Nuvia can apply a loyalty points multiplier.",
        overrides={},
    ),
    Scenario(
        key="medium-fraud-review",
        name="Medium fraud review",
        description="Fraud score is high enough for human review, but not high enough for a hard block.",
        overrides={"fraud_risk_score": 0.55},
    ),
    Scenario(
        key="high-fraud-block",
        name="High fraud block",
        description="Fraud score crosses the hard-block threshold and creates a fraud case.",
        overrides={"fraud_risk_score": 0.91},
    ),
    Scenario(
        key="low-margin-review",
        name="Low margin review",
        description="Basket margin is too low, so Nuvia prevents automatic reward leakage.",
        overrides={"force_margin_percent": 10},
    ),
    Scenario(
        key="missing-consent",
        name="Missing consent",
        description="Customer consent does not allow personalization, so Nuvia blocks the offer.",
        overrides={"personalization_allowed": False},
    ),
    Scenario(
        key="large-basket-review",
        name="Large basket exposure",
        description="The basket value is above automatic approval limits and goes to review.",
        overrides={"basket_subtotal": 500},
    ),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return sha256(raw.encode("utf-8")).hexdigest()


def stable_id(prefix: str, value: Any) -> str:
    return f"{prefix}_{stable_hash(value)[:12]}"


def sample_checkout_event() -> dict[str, Any]:
    return {
        "event_id": "evt_checkout_001",
        "tenant_id": "tenant_demo_retail",
        "event_type": "checkout.started",
        "event_time": "2026-05-29T10:00:00Z",
        "source": {
            "system": "pos",
            "location_id": "store_101",
            "terminal_id": "pos_08",
        },
        "customer": {
            "customer_id": "cust_123",
            "loyalty_id": "loy_456",
            "consent_profile_id": "consent_789",
            "email": "customer@example.com",
            "phone": "+15550000000",
        },
        "basket": {
            "basket_id": "basket_001",
            "currency": "USD",
            "subtotal": 84.50,
            "items": [
                {
                    "sku": "sku_accessory_001",
                    "name": "Wireless charger",
                    "quantity": 1,
                    "unit_price": 29.50,
                    "margin_percent": 42,
                },
                {
                    "sku": "sku_core_002",
                    "name": "Smart speaker",
                    "quantity": 1,
                    "unit_price": 55,
                    "margin_percent": 24,
                },
            ],
        },
        "payment": {
            "card_number": "4111111111111111",
            "cvv": "123",
        },
    }


def scenario_catalog() -> list[dict[str, Any]]:
    return [
        {
            "key": scenario.key,
            "name": scenario.name,
            "description": scenario.description,
            "overrides": scenario.overrides,
        }
        for scenario in SCENARIOS
    ]


def get_scenario(key: str) -> Scenario:
    for scenario in SCENARIOS:
        if scenario.key == key:
            return scenario
    raise NuviaValidationError(f"Unknown scenario: {key}")


def normalize_live_event(raw_event: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw_event, dict):
        return rejection("unknown", "EVENT_MUST_BE_OBJECT")
    if not raw_event.get("tenant_id"):
        return rejection(raw_event.get("event_id"), "MISSING_TENANT")
    if raw_event.get("event_type") not in SUPPORTED_EVENT_TYPES:
        return rejection(raw_event.get("event_id"), "UNSUPPORTED_EVENT_TYPE")
    if not raw_event.get("customer", {}).get("customer_id"):
        return rejection(raw_event.get("event_id"), "MISSING_CUSTOMER")
    basket = raw_event.get("basket", {})
    if not basket.get("basket_id") or not isinstance(basket.get("items"), list) or not basket["items"]:
        return rejection(raw_event.get("event_id"), "MALFORMED_BASKET")

    event = redact_sensitive_fields(raw_event)
    validate_checkout_event(event)
    return {"ok": True, "event": event}


def ingest_live_batch(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(events, list):
        raise NuviaValidationError("Live data batch must be a list")

    accepted = []
    rejected = []
    seen = set()

    for event in events:
        normalized = normalize_live_event(event)
        if not normalized["ok"]:
            rejected.append(normalized["rejection"])
            continue

        safe_event = normalized["event"]
        event_id = safe_event["event_id"]
        if event_id in seen:
            rejected.append({"event_id": event_id, "reason": "EVENT_ALREADY_INGESTED"})
            continue

        seen.add(event_id)
        accepted.append(
            {
                "event_id": event_id,
                "event": safe_event,
                "decision": run_decision_pipeline(safe_event),
            }
        )

    return {
        "accepted_count": len(accepted),
        "rejected_count": len(rejected),
        "accepted": accepted,
        "rejected": rejected,
        "data_source": live_data_source_summary(),
    }


def live_data_source_summary() -> dict[str, Any]:
    return {
        "mode": "demo_sandbox_live_like_data",
        "note": "This product shell uses safe demo checkout events, not real customer production data.",
        "source_systems": ["POS checkout", "loyalty wallet", "fraud score", "margin policy"],
        "included_fields": [
            "tenant_id",
            "event_id",
            "event_type",
            "event_time",
            "source.system",
            "source.location_id",
            "customer.customer_id",
            "customer.loyalty_id",
            "customer.consent_profile_id",
            "basket.basket_id",
            "basket.items.sku",
            "basket.items.quantity",
            "basket.items.unit_price",
            "basket.items.margin_percent",
            "fraud_risk_score override by scenario",
        ],
        "redacted_fields": sorted(SENSITIVE_FIELDS),
        "manual_check": [
            "Run safe-offer to see automatic execution.",
            "Run medium-fraud-review to see human approval required.",
            "Run high-fraud-block to see fraud-case action.",
            "Run missing-consent to see personalization blocked.",
            "Paste a batch with email/card_number to confirm redaction.",
        ],
    }


def run_scenario(key: str = "safe-offer", policy_overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    scenario = get_scenario(key)
    event = sample_checkout_event()
    event["event_id"] = f"evt_{key}"
    event = apply_event_overrides(event, scenario.overrides)
    result = run_decision_pipeline(redact_sensitive_fields(event), scenario.overrides, policy_overrides)
    result["scenario"] = {
        "key": scenario.key,
        "name": scenario.name,
        "description": scenario.description,
    }
    return result


def run_decision_pipeline(
    event: dict[str, Any],
    overrides: dict[str, Any] | None = None,
    policy_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    overrides = overrides or {}
    policies = {**DEFAULT_POLICIES, **(policy_overrides or {})}
    validate_checkout_event(event)
    request, context, context_pack = assemble_context(event, overrides)
    policy_result = evaluate_policies(request, context, policies)
    plan = create_decision_plan(request, context, policy_result)
    action_graph = compile_action_graph(plan)
    receipt = execute_action_graph(action_graph)
    audit_records = build_audit_records(request, context_pack, policy_result, plan, action_graph, receipt)
    dashboard = build_dashboard_snapshot(audit_records, policy_result, action_graph, receipt)
    evaluation = evaluate_run(request, policy_result, action_graph, receipt, audit_records)

    return {
        "request": request,
        "context": context,
        "context_pack": context_pack,
        "policy_result": policy_result,
        "decision_plan": plan,
        "action_graph": action_graph,
        "execution_receipt": receipt,
        "audit_records": audit_records,
        "dashboard": dashboard,
        "evaluation": evaluation,
    }


def apply_event_overrides(event: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    updated = deepcopy(event)
    if "basket_subtotal" in overrides:
        updated["basket"]["subtotal"] = overrides["basket_subtotal"]
    if "force_margin_percent" in overrides:
        for item in updated["basket"]["items"]:
            item["margin_percent"] = overrides["force_margin_percent"]
    return updated


def validate_checkout_event(event: dict[str, Any]) -> None:
    required = ["tenant_id", "event_type", "event_time", "source", "customer", "basket"]
    missing = [field for field in required if not event.get(field)]
    if missing:
        raise NuviaValidationError(f"Checkout event missing fields: {', '.join(missing)}")
    if event["event_type"] not in SUPPORTED_EVENT_TYPES:
        raise NuviaValidationError(f"Unsupported event type: {event['event_type']}")
    for field in ["customer_id", "loyalty_id", "consent_profile_id"]:
        if not event["customer"].get(field):
            raise NuviaValidationError(f"Customer missing field: {field}")
    basket = event["basket"]
    if not basket.get("basket_id") or not isinstance(basket.get("items"), list) or not basket["items"]:
        raise NuviaValidationError("Basket must include basket_id and at least one item")


def assemble_context(event: dict[str, Any], overrides: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    fraud_score = overrides.get("fraud_risk_score", 0.18)
    context = {
        "customer": {
            "ref": f"ctx_customer_profile_{event['customer']['customer_id']}",
            "customer_id": event["customer"]["customer_id"],
            "segment": "returning_loyalty_member",
            "consent_profile_id": event["customer"]["consent_profile_id"],
            "personalization_allowed": overrides.get("personalization_allowed", True),
        },
        "basket": {
            "ref": f"ctx_basket_{event['basket']['basket_id']}",
            **event["basket"],
        },
        "loyalty_wallet": {
            "ref": f"ctx_loyalty_wallet_{event['customer']['loyalty_id']}",
            "loyalty_id": event["customer"]["loyalty_id"],
            "points_balance": 4200,
            "tier": "gold",
        },
        "margin": {
            "ref": f"ctx_margin_{event['basket']['basket_id']}",
            "average_margin_percent": average_margin(event["basket"]["items"]),
        },
        "fraud": {
            "ref": f"ctx_fraud_{event['customer']['customer_id']}",
            "risk_score": fraud_score,
            "signals": ["known_device", "normal_velocity"] if fraud_score < 0.45 else ["velocity_spike", "new_device"],
        },
        "policy": {
            "ref": "policy_bundle_demo_v1",
            "version": "demo_v1",
        },
    }
    request = {
        "request_id": stable_id("req", {"tenant": event["tenant_id"], "event": event["event_id"]}),
        "tenant_id": event["tenant_id"],
        "event_type": event["event_type"],
        "event_time": event["event_time"],
        "actor": {"type": "system", "id": event["source"].get("terminal_id", event["source"]["system"])},
        "subject": {
            "customer_id": event["customer"]["customer_id"],
            "consent_profile_id": event["customer"]["consent_profile_id"],
        },
        "decision_domain": "loyalty.checkout_offer",
        "latency_budget_ms": 250,
        "risk_tier": risk_tier(fraud_score),
        "context_refs": [
            context["customer"]["ref"],
            context["basket"]["ref"],
            context["loyalty_wallet"]["ref"],
            context["margin"]["ref"],
            context["fraud"]["ref"],
            context["policy"]["ref"],
        ],
        "policy_bundle_ref": context["policy"]["ref"],
    }
    context_pack = {
        "context_pack_id": stable_id("dcp", request),
        "request_id": request["request_id"],
        "context_hash": stable_hash(context),
        "admitted_context_refs": request["context_refs"],
        "missing_context_refs": [],
        "rejected_context_refs": [],
        "redacted_fields": sorted(SENSITIVE_FIELDS),
    }
    return request, context, context_pack


def evaluate_policies(
    request: dict[str, Any],
    context: dict[str, Any],
    policies: dict[str, Any] | None = None,
) -> dict[str, Any]:
    active_policies = {**DEFAULT_POLICIES, **(policies or {})}
    checks = [
        check_consent(context, active_policies),
        check_margin(context, active_policies),
        check_fraud(context, active_policies),
        check_basket_exposure(context, active_policies),
    ]
    blocked = any(check["result"] == "block" for check in checks)
    review = any(check["result"] == "review" for check in checks)
    decision = "block" if blocked else "review" if review else "allow"
    return {
        "request_id": request["request_id"],
        "policy_version": context["policy"]["version"],
        "allowed": not blocked,
        "requires_approval": not blocked and review,
        "decision": decision,
        "checks": checks,
        "policy_refs": [check["policy_ref"] for check in checks],
    }


def create_decision_plan(request: dict[str, Any], context: dict[str, Any], policy_result: dict[str, Any]) -> dict[str, Any]:
    actions = candidate_actions(request, context, policy_result)
    return {
        "decision_id": stable_id("dec", {"request": request["request_id"], "actions": actions}),
        "request_id": request["request_id"],
        "summary": decision_summary(policy_result),
        "evidence": [{"type": "policy", "ref": ref} for ref in policy_result["policy_refs"]]
        + [{"type": "context", "ref": ref} for ref in request["context_refs"]],
        "risk_score": context["fraud"]["risk_score"],
        "expected_impact": expected_impact(context, policy_result),
        "candidate_actions": actions,
        "requires_approval": policy_result["requires_approval"],
        "agent_recommendations": agent_recommendations(context, policy_result),
        "model_version": "deterministic-flask-phase1",
        "policy_version": policy_result["policy_version"],
    }


def compile_action_graph(plan: dict[str, Any]) -> dict[str, Any]:
    actions = []
    for index, action in enumerate(plan["candidate_actions"], start=1):
        if not action.get("policy_refs"):
            raise NuviaValidationError("Action must include policy_refs")
        if not action.get("connector_id") or not action.get("operation_id"):
            raise NuviaValidationError("Action must include connector_id and operation_id")
        actions.append({"action_id": f"act_{index:03d}", **action})
    return {
        "action_graph_id": stable_id("ag", {"decision": plan["decision_id"], "actions": actions}),
        "decision_id": plan["decision_id"],
        "idempotency_key": f"decision:{plan['decision_id']}",
        "approval_status": "required" if plan["requires_approval"] else "not_required",
        "actions": actions,
    }


def execute_action_graph(action_graph: dict[str, Any]) -> dict[str, Any]:
    if action_graph["approval_status"] == "required":
        action_results = []
        status = "awaiting_approval"
    else:
        action_results = [
            {
                "action_id": action["action_id"],
                "status": "success",
                "connector_id": action["connector_id"],
                "operation_id": action["operation_id"],
                "external_reference": stable_id("ext", action),
                "retry_count": 0,
            }
            for action in action_graph["actions"]
        ]
        status = "completed"

    return {
        "receipt_id": stable_id("rec", {"graph": action_graph["action_graph_id"], "status": status}),
        "action_graph_id": action_graph["action_graph_id"],
        "status": status,
        "started_at": utc_now(),
        "completed_at": utc_now(),
        "actions": action_results,
        "audit_ref": stable_id("audit", {"graph": action_graph["action_graph_id"], "status": status}),
    }


def build_audit_records(
    request: dict[str, Any],
    context_pack: dict[str, Any],
    policy_result: dict[str, Any],
    plan: dict[str, Any],
    action_graph: dict[str, Any],
    receipt: dict[str, Any],
) -> list[dict[str, Any]]:
    payloads = [
        (
            "decision.request.created",
            {
                "request_id": request["request_id"],
                "tenant_id": request["tenant_id"],
                "decision_domain": request["decision_domain"],
                "context_pack_id": context_pack["context_pack_id"],
            },
        ),
        (
            "policy.evaluated",
            {
                "request_id": request["request_id"],
                "decision": policy_result["decision"],
                "requires_approval": policy_result["requires_approval"],
                "policy_refs": policy_result["policy_refs"],
            },
        ),
        (
            "decision.plan.created",
            {
                "request_id": request["request_id"],
                "decision_id": plan["decision_id"],
                "summary": plan["summary"],
            },
        ),
        (
            "action_graph.compiled",
            {
                "decision_id": plan["decision_id"],
                "action_graph_id": action_graph["action_graph_id"],
                "approval_status": action_graph["approval_status"],
            },
        ),
        (
            "execution.receipt.created",
            {
                "action_graph_id": action_graph["action_graph_id"],
                "receipt_id": receipt["receipt_id"],
                "status": receipt["status"],
            },
        ),
    ]
    records = []
    for index, (record_type, payload) in enumerate(payloads):
        records.append(
            {
                "audit_id": stable_id("audit", {"type": record_type, "payload": payload, "index": index}),
                "type": record_type,
                "payload_hash": stable_hash(payload),
                "payload": payload,
                "recorded_at": utc_now(),
            }
        )
    return records


def build_dashboard_snapshot(
    audit_records: list[dict[str, Any]],
    policy_result: dict[str, Any],
    action_graph: dict[str, Any],
    receipt: dict[str, Any],
) -> dict[str, Any]:
    return {
        "decision_volume": len([record for record in audit_records if record["type"] == "decision.request.created"]),
        "approval_queue": 1 if action_graph["approval_status"] == "required" else 0,
        "policy_decision": policy_result["decision"],
        "execution_status": receipt["status"],
        "audit_events": len(audit_records),
        "policy_checks": policy_result["checks"],
        "live_metrics": {
            "fraud_review_count": 1 if policy_result["decision"] == "review" else 0,
            "policy_block_count": 1 if policy_result["decision"] == "block" else 0,
            "connector_error_count": 0,
            "dead_letter_count": 0,
        },
    }


def evaluate_run(
    request: dict[str, Any],
    policy_result: dict[str, Any],
    action_graph: dict[str, Any],
    receipt: dict[str, Any],
    audit_records: list[dict[str, Any]],
) -> dict[str, Any]:
    checks = [
        check_eval("schema_adherence", bool(request.get("policy_bundle_ref")), "Decision request has policy bundle"),
        check_eval("policy_compliance", policy_result["decision"] in {"allow", "review", "block"}, "Policy result is valid"),
        check_eval("action_graph_safety", bool(action_graph["actions"]), "Action graph has at least one action"),
        check_eval("execution_receipt", receipt["status"] in {"completed", "awaiting_approval", "failed"}, "Receipt status is valid"),
        check_eval("audit_completeness", len(audit_records) >= 5, "Audit trail has required events"),
    ]
    return {"status": "pass" if all(check["passed"] for check in checks) else "fail", "checks": checks}


def test_matrix() -> list[dict[str, Any]]:
    return [
        {"area": "Policy", "case": "safe checkout", "expected": "allow and execute", "automated": True},
        {"area": "Policy", "case": "medium fraud", "expected": "review required", "automated": True},
        {"area": "Policy", "case": "high fraud", "expected": "block and create fraud case", "automated": True},
        {"area": "Policy", "case": "missing consent", "expected": "block personalization", "automated": True},
        {"area": "Live data", "case": "sensitive fields", "expected": "redacted before ingestion", "automated": True},
        {"area": "Live data", "case": "unsupported event", "expected": "rejected with reason", "automated": True},
        {"area": "Execution", "case": "approval required", "expected": "does not execute connector", "automated": True},
        {"area": "Audit", "case": "complete run", "expected": "5 audit records with hashes", "automated": True},
    ]


def team_progress() -> list[dict[str, Any]]:
    return [
        {
            "owner": "Ashwanth Reddy",
            "track": "Decision Core and Governance",
            "completed": [
                "Event validation",
                "Context assembly",
                "Policy allow/review/block",
                "Action graph compiler",
                "Shared decision contracts",
                "Policy persistence",
                "Policy editor APIs",
            ],
            "next": ["Production redemption contracts after deployment scope starts"],
        },
        {
            "owner": "vijju",
            "track": "Execution, Connectors, Audit",
            "completed": [
                "Mock connector execution",
                "Execution receipt",
                "Audit records",
                "Live data gateway redaction",
                "SQLite persistence",
                "Connector health API",
                "Approval execution updates",
            ],
            "next": ["Real connector adapters when customer credentials are available"],
        },
        {
            "owner": "chaitanya",
            "track": "Control Room, Agents, Evaluation",
            "completed": [
                "React Control Room",
                "Scenario runner",
                "Agent recommendation display",
                "Evaluation checklist",
                "Manual live-data batch testing",
                "Approval action UI",
                "Policy Center UI",
                "Connector Health UI",
                "Simulation history",
            ],
            "next": ["Role-based views after production identity is selected"],
        },
    ]


def candidate_actions(request: dict[str, Any], context: dict[str, Any], policy_result: dict[str, Any]) -> list[dict[str, Any]]:
    if policy_result["decision"] == "block":
        return [
            {
                "type": "FRAUD_CREATE_CASE",
                "connector_id": "fraud_platform_demo",
                "operation_id": "create_case",
                "parameters": {
                    "customer_id": request["subject"]["customer_id"],
                    "request_id": request["request_id"],
                    "risk_score": context["fraud"]["risk_score"],
                    "reason": "Block policy triggered.",
                },
                "policy_refs": policy_result["policy_refs"],
                "rollback": {"strategy": "manual_review", "operation_id": "close_case"},
            }
        ]
    if policy_result["requires_approval"]:
        return [
            {
                "type": "NUVIA_SEND_TO_HUMAN_REVIEW",
                "connector_id": "review_queue_demo",
                "operation_id": "create_review_task",
                "parameters": {
                    "request_id": request["request_id"],
                    "customer_id": request["subject"]["customer_id"],
                    "reason": "Policy requires human approval.",
                },
                "policy_refs": policy_result["policy_refs"],
                "rollback": {"strategy": "cancel_review_task", "operation_id": "cancel_review_task"},
            }
        ]
    return [
        {
            "type": "LOYALTY_APPLY_POINTS_MULTIPLIER",
            "connector_id": "loyalty_core_demo",
            "operation_id": "apply_points_multiplier",
            "parameters": {
                "customer_id": request["subject"]["customer_id"],
                "basket_id": context["basket"]["basket_id"],
                "multiplier": 2,
                "eligible_sku_scope": [item["sku"] for item in context["basket"]["items"] if item["margin_percent"] >= 30],
                "expires_at": (datetime.fromisoformat(request["event_time"].replace("Z", "+00:00")) + timedelta(hours=1))
                .isoformat()
                .replace("+00:00", "Z"),
            },
            "policy_refs": policy_result["policy_refs"],
            "rollback": {"strategy": "compensating_action", "operation_id": "remove_points_multiplier"},
        }
    ]


def agent_recommendations(context: dict[str, Any], policy_result: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "agent": "Loyalty Strategist",
            "recommendation": "Offer a points multiplier only when margin and consent are safe.",
            "confidence": 0.86 if policy_result["decision"] == "allow" else 0.52,
            "risk_note": "Avoid reward leakage when margin or consent policy fails.",
        },
        {
            "agent": "Fraud Sentinel",
            "recommendation": "Use review or fraud case creation when fraud risk crosses thresholds.",
            "confidence": min(0.98, context["fraud"]["risk_score"] + 0.25),
            "risk_note": f"Current fraud score is {context['fraud']['risk_score']}.",
        },
        {
            "agent": "Margin Guardian",
            "recommendation": "Protect basket margin before applying rewards.",
            "confidence": 0.81,
            "risk_note": f"Average margin is {context['margin']['average_margin_percent']}%.",
        },
    ]


def check_consent(context: dict[str, Any], policies: dict[str, Any]) -> dict[str, Any]:
    allowed = not policies["consent_required"] or context["customer"]["personalization_allowed"]
    return policy_check(
        "policy.consent.personalization.demo_v1",
        "pass" if allowed else "block",
        "Personalization consent is valid." if allowed else "Personalization consent is missing.",
        "critical" if not allowed else "info",
    )


def check_margin(context: dict[str, Any], policies: dict[str, Any]) -> dict[str, Any]:
    ok = context["margin"]["average_margin_percent"] >= policies["minimum_average_margin_percent"]
    return policy_check(
        "policy.margin.floor.demo_v1",
        "pass" if ok else "review",
        "Basket margin is safe." if ok else "Basket margin is below preferred floor.",
        "warning" if not ok else "info",
    )


def check_fraud(context: dict[str, Any], policies: dict[str, Any]) -> dict[str, Any]:
    score = context["fraud"]["risk_score"]
    if score >= policies["block_fraud_risk_threshold"]:
        return policy_check("policy.fraud.block.demo_v1", "block", "Fraud score is above hard-block threshold.", "critical")
    if score >= policies["review_fraud_risk_threshold"]:
        return policy_check("policy.fraud.review.demo_v1", "review", "Fraud score requires human review.", "warning")
    return policy_check("policy.fraud.allow.demo_v1", "pass", "Fraud score is inside allowed range.", "info")


def check_basket_exposure(context: dict[str, Any], policies: dict[str, Any]) -> dict[str, Any]:
    review = context["basket"]["subtotal"] >= policies["human_review_basket_threshold"]
    return policy_check(
        "policy.exposure.basket.demo_v1",
        "review" if review else "pass",
        "Basket exposure exceeds auto-approval threshold." if review else "Basket exposure is within threshold.",
        "warning" if review else "info",
    )


def policy_check(policy_ref: str, result: str, message: str, severity: str) -> dict[str, Any]:
    return {"policy_ref": policy_ref, "result": result, "severity": severity, "message": message, "evidence": []}


def check_eval(name: str, passed: bool, message: str) -> dict[str, Any]:
    return {"name": name, "passed": passed, "severity": "info" if passed else "critical", "message": message}


def decision_summary(policy_result: dict[str, Any]) -> str:
    if policy_result["decision"] == "block":
        return "Block automatic loyalty action and create a fraud case."
    if policy_result["decision"] == "review":
        return "Route this checkout decision to human review before execution."
    return "Apply a safe loyalty points multiplier to eligible high-margin items."


def expected_impact(context: dict[str, Any], policy_result: dict[str, Any]) -> dict[str, Any]:
    if policy_result["decision"] == "block":
        return {
            "retention_lift": 0,
            "gross_margin_delta": 0,
            "budget_impact": 0,
            "fraud_loss_prevented_estimate": round(context["basket"]["subtotal"] * context["fraud"]["risk_score"], 2),
        }
    if policy_result["decision"] == "review":
        return {"retention_lift": 0.005, "gross_margin_delta": 0, "budget_impact": 0, "fraud_loss_prevented_estimate": 0}
    return {
        "retention_lift": 0.02,
        "gross_margin_delta": round(context["basket"]["subtotal"] * 0.03, 2),
        "budget_impact": round(context["basket"]["subtotal"] * 0.01, 2),
        "fraud_loss_prevented_estimate": 0,
    }


def average_margin(items: list[dict[str, Any]]) -> float:
    total = sum(item["unit_price"] * item["quantity"] for item in items)
    weighted = sum(item["unit_price"] * item["quantity"] * item["margin_percent"] for item in items)
    return round(weighted / total, 2)


def risk_tier(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.4:
        return "medium"
    return "low"


def redact_sensitive_fields(value: Any) -> Any:
    copy = deepcopy(value)
    remove_sensitive_fields(copy)
    return copy


def remove_sensitive_fields(value: Any) -> None:
    if isinstance(value, dict):
        for key in list(value.keys()):
            if key.lower() in SENSITIVE_FIELDS:
                del value[key]
            else:
                remove_sensitive_fields(value[key])
    elif isinstance(value, list):
        for item in value:
            remove_sensitive_fields(item)


def rejection(event_id: str | None, reason: str) -> dict[str, Any]:
    return {"ok": False, "rejection": {"event_id": event_id or "unknown", "reason": reason}}
