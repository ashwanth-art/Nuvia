import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { compileActionGraph } from "../services/action-compiler/src/index.js";
import { createDecisionPlan } from "../services/agent-orchestrator/src/index.js";
import { createAuditLedger, recordPhase1Run } from "../services/audit-ledger/src/index.js";
import { assembleDecisionContext } from "../services/context-assembly/src/index.js";
import { createEventIngress } from "../services/event-ingress/src/index.js";
import { executeActionGraph } from "../services/execution-os/src/index.js";
import { DEFAULT_POLICIES, evaluatePolicies } from "../services/policy-service/src/index.js";
import { evaluatePhase1Run } from "../packages/evaluation/src/index.js";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const staticDir = join(rootDir, "apps", "control-room", "static");
const port = Number(process.env.NUVIA_PREVIEW_PORT || 5187);

const scenarios = [
  ["safe-offer", "Safe checkout offer", "Low fraud, valid consent, good basket margin. Nuvia can apply a loyalty points multiplier.", {}],
  ["medium-fraud-review", "Medium fraud review", "Fraud score requires human review.", { fraud_risk_score: 0.55 }],
  ["high-fraud-block", "High fraud block", "Fraud score crosses hard-block threshold.", { fraud_risk_score: 0.91 }],
  ["low-margin-review", "Low margin review", "Basket margin is too low for automatic reward.", { force_margin_percent: 10 }],
  ["missing-consent", "Missing consent", "Customer consent does not allow personalization.", { personalization_allowed: false }],
  ["large-basket-review", "Large basket exposure", "Basket value is above automatic approval limits.", { basket_subtotal: 500 }]
];

const memory = {
  decisions: [],
  approvals: [],
  policies: defaultPolicies(),
  connectors: defaultConnectors(),
  simulations: [],
  auditEvents: []
};

createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await routeApi(request, response);
      return;
    }
    await routeStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Nuvia UI preview running at http://127.0.0.1:${port}`);
});

async function routeApi(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok", product: "Nuvia", backend: "Node preview for local UI verification" });
    return;
  }

  if (url.pathname === "/api/scenarios") {
    sendJson(response, 200, {
      scenarios: scenarios.map(([key, name, description, overrides]) => ({ key, name, description, overrides }))
    });
    return;
  }

  if (url.pathname === "/api/live-data/source") {
    sendJson(response, 200, liveDataSource());
    return;
  }

  if (url.pathname === "/api/live-data/sample") {
    sendJson(response, 200, { event: await sampleEvent(), source: liveDataSource() });
    return;
  }

  if (url.pathname === "/api/live-data/ingest" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const events = Array.isArray(payload) ? payload : payload.events || [];
    sendJson(response, 200, await ingestBatch(events));
    return;
  }

  if (url.pathname === "/api/decisions" && request.method === "GET") {
    sendJson(response, 200, { decisions: memory.decisions.map(({ payload, ...summary }) => summary).reverse() });
    return;
  }

  if (url.pathname === "/api/decisions/run" && request.method === "POST") {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await storeScenarioRun(payload.scenario_key || "safe-offer"));
    return;
  }

  if (url.pathname.startsWith("/api/stored-decisions/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const decision = memory.decisions.find((item) => item.id === id);
    sendJson(response, decision ? 200 : 404, decision || { error: "Decision not found" });
    return;
  }

  if (url.pathname.startsWith("/api/decisions/")) {
    const key = decodeURIComponent(url.pathname.split("/").pop());
    sendJson(response, 200, await runScenario(key));
    return;
  }

  if (url.pathname === "/api/dashboard") {
    sendJson(response, 200, dashboard());
    return;
  }

  if (url.pathname === "/api/approvals" && request.method === "GET") {
    sendJson(response, 200, { approvals: memory.approvals.slice().reverse() });
    return;
  }

  if (url.pathname.startsWith("/api/approvals/") && url.pathname.endsWith("/decision") && request.method === "POST") {
    const approvalId = url.pathname.split("/")[3];
    const payload = await readJsonBody(request);
    sendJson(response, 200, updateApproval(approvalId, payload.action || "approved"));
    return;
  }

  if (url.pathname === "/api/policies" && request.method === "GET") {
    sendJson(response, 200, { policies: memory.policies });
    return;
  }

  if (url.pathname.startsWith("/api/policies/") && request.method === "PUT") {
    const policyId = decodeURIComponent(url.pathname.split("/").pop());
    const payload = await readJsonBody(request);
    const policy = memory.policies.find((item) => item.id === policyId);
    if (policy) Object.assign(policy, payload, { updated_at: new Date().toISOString() });
    sendJson(response, policy ? 200 : 404, policy || { error: "Policy not found" });
    return;
  }

  if (url.pathname === "/api/connectors" && request.method === "GET") {
    sendJson(response, 200, { connectors: memory.connectors });
    return;
  }

  if (url.pathname.startsWith("/api/connectors/") && url.pathname.endsWith("/health") && request.method === "POST") {
    const connectorId = url.pathname.split("/")[3];
    const payload = await readJsonBody(request);
    const connector = memory.connectors.find((item) => item.id === connectorId);
    if (connector) Object.assign(connector, { status: payload.status || "healthy", updated_at: new Date().toISOString() });
    sendJson(response, connector ? 200 : 404, connector || { error: "Connector not found" });
    return;
  }

  if (url.pathname === "/api/simulations" && request.method === "GET") {
    sendJson(response, 200, { simulations: memory.simulations.slice().reverse() });
    return;
  }

  if (url.pathname === "/api/simulations/run" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const simulation = await runSimulation(payload.scenario_key || "safe-offer");
    sendJson(response, 200, simulation);
    return;
  }

  if (url.pathname === "/api/audit" && request.method === "GET") {
    sendJson(response, 200, { audit_events: memory.auditEvents.slice().reverse() });
    return;
  }

  if (url.pathname === "/api/tests/matrix") {
    sendJson(response, 200, {
      tests: [
        { area: "Policy", case: "safe checkout", expected: "allow and execute", automated: true },
        { area: "Policy", case: "medium fraud", expected: "review required", automated: true },
        { area: "Policy", case: "high fraud", expected: "block and create fraud case", automated: true },
        { area: "Policy", case: "missing consent", expected: "block personalization", automated: true },
        { area: "Live data", case: "sensitive fields", expected: "redacted before ingestion", automated: true },
        { area: "Audit", case: "complete run", expected: "5 audit records with hashes", automated: true }
      ]
    });
    return;
  }

  if (url.pathname === "/api/team/progress") {
    sendJson(response, 200, {
      team: [
        {
          owner: "Ashwanth Reddy",
          track: "Decision Core and Governance",
          completed: ["Event validation", "Context assembly", "Policy checks", "Action compiler", "Policy persistence", "Policy editor APIs"],
          next: ["Production redemption contracts after deployment scope starts"]
        },
        {
          owner: "vijju",
          track: "Execution, Connectors, Audit",
          completed: ["Mock execution", "Execution receipt", "Audit records", "Live-data gateway", "SQLite persistence", "Connector health API", "Approval execution updates"],
          next: ["Real connector adapters when customer credentials are available"]
        },
        {
          owner: "chaitanya",
          track: "Control Room, Agents, Evaluation",
          completed: ["React UI", "Scenario runner", "Agent recommendations", "Evaluation view", "Approval actions", "Policy Center UI", "Simulation history"],
          next: ["Role-based views after production identity is selected"]
        }
      ]
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function routeStatic(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(staticDir, safePath);
  const body = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentType(filePath) });
  response.end(body);
}

async function runScenario(key) {
  const scenario = scenarios.find(([scenarioKey]) => scenarioKey === key) || scenarios[0];
  const [, name, description, overrides] = scenario;
  const event = applyOverrides(await sampleEvent(), key, overrides);
  const ingress = createEventIngress();
  const ingestedEvent = ingress.ingestCheckoutEvent(stripSensitive(event));
  const { request, context, context_pack: contextPack } = assembleDecisionContext(ingestedEvent, overrides);
  const policyResult = evaluatePolicies(request, context, activePolicyMap());
  const plan = createDecisionPlan(request, context, policyResult);
  const actionGraph = compileActionGraph(plan);
  const receipt = await executeActionGraph(actionGraph);
  const ledger = createAuditLedger();
  const auditRecords = recordPhase1Run(ledger, {
    request,
    contextPack,
    policyResult,
    plan,
    actionGraph,
    receipt
  });
  const evaluation = evaluatePhase1Run({ request, policyResult, actionGraph, receipt });
  return {
    scenario: { key, name, description },
    request,
    context,
    context_pack: contextPack,
    policy_result: policyResult,
    decision_plan: {
      ...plan,
      agent_recommendations: [
        {
          agent: "Loyalty Strategist",
          recommendation: "Offer a points multiplier only when margin and consent are safe.",
          confidence: policyResult.decision === "allow" ? 0.86 : 0.52,
          risk_note: "Avoid reward leakage when margin or consent policy fails."
        },
        {
          agent: "Fraud Sentinel",
          recommendation: "Use review or fraud case creation when fraud risk crosses thresholds.",
          confidence: Math.min(0.98, context.fraud.risk_score + 0.25),
          risk_note: `Current fraud score is ${context.fraud.risk_score}.`
        },
        {
          agent: "Margin Guardian",
          recommendation: "Protect basket margin before applying rewards.",
          confidence: 0.81,
          risk_note: `Average margin is ${context.margin.average_margin_percent}%.`
        }
      ]
    },
    action_graph: actionGraph,
    execution_receipt: receipt,
    audit_records: auditRecords,
    dashboard: {
      decision_volume: 1,
      approval_queue: actionGraph.approval_status === "required" ? 1 : 0,
      policy_decision: policyResult.decision,
      execution_status: receipt.status,
      audit_events: auditRecords.length,
      policy_checks: policyResult.checks
    },
    evaluation
  };
}

async function ingestBatch(events) {
  const accepted = [];
  const rejected = [];
  for (const event of events) {
    if (!event.tenant_id) {
      rejected.push({ event_id: event.event_id || "unknown", reason: "MISSING_TENANT" });
      continue;
    }
    if (!["checkout.started", "loyalty.redemption.requested"].includes(event.event_type)) {
      rejected.push({ event_id: event.event_id || "unknown", reason: "UNSUPPORTED_EVENT_TYPE" });
      continue;
    }
    if (!event.customer?.customer_id) {
      rejected.push({ event_id: event.event_id || "unknown", reason: "MISSING_CUSTOMER" });
      continue;
    }
    if (!event.basket?.basket_id || !Array.isArray(event.basket.items)) {
      rejected.push({ event_id: event.event_id || "unknown", reason: "MALFORMED_BASKET" });
      continue;
    }
    const decision = await runScenario("safe-offer");
    const stored = storeDecision("live-data", decision);
    accepted.push({
      event_id: event.event_id,
      event: stripSensitive(event),
      decision,
      stored_decision: stored
    });
  }
  return {
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    accepted,
    rejected,
    stored_decisions: accepted.map((item) => item.stored_decision),
    data_source: liveDataSource()
  };
}

async function storeScenarioRun(scenarioKey) {
  return storeDecision(scenarioKey, await runScenario(scenarioKey));
}

function storeDecision(scenarioKey, payload) {
  const id = `run_${cryptoRandom()}`;
  const now = new Date().toISOString();
  const summary = {
    id,
    scenario_key: scenarioKey,
    policy_decision: payload.policy_result.decision,
    execution_status: payload.execution_receipt.status,
    approval_status: payload.action_graph.approval_status,
    payload: { ...payload, stored_decision_id: id },
    created_at: now,
    updated_at: now
  };
  memory.decisions.push(summary);
  if (payload.action_graph.approval_status === "required") {
    memory.approvals.push({
      id: `apr_${cryptoRandom()}`,
      decision_id: id,
      status: "pending",
      reason: payload.decision_plan.summary,
      reviewer: null,
      note: null,
      scenario_key: scenarioKey,
      policy_decision: payload.policy_result.decision,
      execution_status: payload.execution_receipt.status,
      created_at: now,
      updated_at: now
    });
  }
  for (const record of payload.audit_records) {
    memory.auditEvents.push({ ...record, decision_id: id });
  }
  return summary;
}

function updateApproval(approvalId, action) {
  const approval = memory.approvals.find((item) => item.id === approvalId);
  if (!approval) return { error: "Approval not found" };
  const decision = memory.decisions.find((item) => item.id === approval.decision_id);
  if (!decision) return { error: "Decision not found" };
  approval.status = action;
  approval.reviewer = "control-room-operator";
  approval.note = `${action} from preview`;
  approval.updated_at = new Date().toISOString();
  decision.approval_status = action;
  decision.updated_at = approval.updated_at;
  decision.payload.action_graph.approval_status = action;
  if (action === "approved") {
    decision.execution_status = "completed";
    decision.payload.execution_receipt.status = "completed";
    decision.payload.execution_receipt.actions = decision.payload.action_graph.actions.map((item) => ({
      action_id: item.action_id,
      status: "success",
      connector_id: item.connector_id,
      operation_id: item.operation_id,
      external_reference: `ext_${cryptoRandom()}`
    }));
    decision.payload.dashboard.execution_status = "completed";
    decision.payload.dashboard.approval_queue = 0;
  }
  if (action === "rejected") {
    decision.execution_status = "rejected";
    decision.payload.execution_receipt.status = "rejected";
    decision.payload.dashboard.execution_status = "rejected";
    decision.payload.dashboard.approval_queue = 0;
  }
  memory.auditEvents.push({
    audit_id: `audit_${cryptoRandom()}`,
    decision_id: decision.id,
    type: "approval.updated",
    payload: { approval_id: approvalId, action },
    recorded_at: new Date().toISOString()
  });
  return decision;
}

async function runSimulation(scenarioKey) {
  const result = await runScenario(scenarioKey);
  const simulation = {
    id: `sim_${cryptoRandom()}`,
    scenario_key: scenarioKey,
    policy_decision: result.policy_result.decision,
    approval_required: result.policy_result.requires_approval,
    expected_action: result.action_graph.actions[0].type,
    expected_impact: result.decision_plan.expected_impact,
    evaluation: result.evaluation,
    created_at: new Date().toISOString()
  };
  memory.simulations.push(simulation);
  return simulation;
}

function dashboard() {
  return {
    decision_volume: memory.decisions.length,
    approval_queue: memory.approvals.filter((item) => item.status === "pending").length,
    policy_block_count: memory.decisions.filter((item) => item.policy_decision === "block").length,
    completed_execution_count: memory.decisions.filter((item) => item.execution_status === "completed").length,
    audit_events: memory.auditEvents.length
  };
}

function defaultPolicies() {
  const now = new Date().toISOString();
  return [
    {
      id: "policy.consent.personalization.demo_v1",
      name: "Consent required",
      category: "consent",
      enabled: 1,
      threshold: 1,
      description: "Customer must allow personalization before loyalty offers are generated.",
      updated_at: now
    },
    {
      id: "policy.margin.floor.demo_v1",
      name: "Minimum margin floor",
      category: "margin",
      enabled: 1,
      threshold: 25,
      description: "Low-margin baskets require review before rewards are applied.",
      updated_at: now
    },
    {
      id: "policy.fraud.review.demo_v1",
      name: "Fraud review threshold",
      category: "fraud",
      enabled: 1,
      threshold: 0.45,
      description: "Medium fraud risk routes to human approval.",
      updated_at: now
    },
    {
      id: "policy.fraud.block.demo_v1",
      name: "Fraud block threshold",
      category: "fraud",
      enabled: 1,
      threshold: 0.8,
      description: "High fraud risk blocks automatic reward execution.",
      updated_at: now
    },
    {
      id: "policy.exposure.basket.demo_v1",
      name: "Basket exposure threshold",
      category: "financial",
      enabled: 1,
      threshold: 250,
      description: "Large baskets require human approval.",
      updated_at: now
    }
  ];
}

function activePolicyMap() {
  const policies = { ...DEFAULT_POLICIES };
  for (const policy of memory.policies) {
    if (policy.id === "policy.consent.personalization.demo_v1") {
      policies.consent_required = Boolean(policy.enabled) && Boolean(policy.threshold);
    }
    if (policy.id === "policy.margin.floor.demo_v1") {
      policies.minimum_average_margin_percent = policy.enabled ? policy.threshold : -1;
    }
    if (policy.id === "policy.fraud.review.demo_v1") {
      policies.review_fraud_risk_threshold = policy.enabled ? policy.threshold : 999;
    }
    if (policy.id === "policy.fraud.block.demo_v1") {
      policies.block_fraud_risk_threshold = policy.enabled ? policy.threshold : 999;
    }
    if (policy.id === "policy.exposure.basket.demo_v1") {
      policies.human_review_basket_threshold = policy.enabled ? policy.threshold : 999999999;
    }
  }
  return policies;
}

function defaultConnectors() {
  const now = new Date().toISOString();
  return [
    { id: "loyalty_core_demo", name: "Loyalty Core", status: "healthy", risk_class: "medium", operations: ["apply_points_multiplier", "remove_points_multiplier"], latency_ms: 82, error_rate: 0, updated_at: now },
    { id: "review_queue_demo", name: "Human Review Queue", status: "healthy", risk_class: "low", operations: ["create_review_task", "cancel_review_task"], latency_ms: 45, error_rate: 0, updated_at: now },
    { id: "fraud_platform_demo", name: "Fraud Platform", status: "healthy", risk_class: "high", operations: ["create_case", "close_case"], latency_ms: 110, error_rate: 0.01, updated_at: now },
    { id: "notification_demo", name: "Notification Service", status: "degraded", risk_class: "medium", operations: ["send_message"], latency_ms: 180, error_rate: 0.04, updated_at: now },
    { id: "data_warehouse_demo", name: "Data Warehouse Export", status: "healthy", risk_class: "low", operations: ["append_audit_event"], latency_ms: 130, error_rate: 0, updated_at: now }
  ];
}

function cryptoRandom() {
  return Math.random().toString(16).slice(2, 14);
}

async function sampleEvent() {
  const fixture = await readFile(join(rootDir, "examples", "fixtures", "checkout-event.sample.json"), "utf8");
  const event = JSON.parse(fixture);
  event.customer.email = "customer@example.com";
  event.customer.phone = "+15550000000";
  event.payment = { card_number: "4111111111111111", cvv: "123" };
  return event;
}

function liveDataSource() {
  return {
    mode: "demo_sandbox_live_like_data",
    note: "This shell uses safe demo checkout events, not real customer production data.",
    source_systems: ["POS checkout", "loyalty wallet", "fraud score", "margin policy"],
    included_fields: [
      "tenant_id",
      "event_id",
      "event_type",
      "event_time",
      "source.system",
      "customer.customer_id",
      "customer.loyalty_id",
      "customer.consent_profile_id",
      "basket.items.sku",
      "basket.items.quantity",
      "basket.items.unit_price",
      "basket.items.margin_percent",
      "fraud_risk_score override by scenario"
    ],
    redacted_fields: ["account_number", "address", "card_number", "cvv", "email", "full_name", "government_id", "payment_token", "phone"]
  };
}

function applyOverrides(event, key, overrides) {
  const updated = structuredClone(event);
  updated.event_id = `evt_${key}`;
  if (overrides.basket_subtotal) updated.basket.subtotal = overrides.basket_subtotal;
  if (overrides.force_margin_percent) {
    updated.basket.items = updated.basket.items.map((item) => ({ ...item, margin_percent: overrides.force_margin_percent }));
  }
  return updated;
}

function stripSensitive(value) {
  const copy = structuredClone(value);
  removeSensitive(copy);
  return copy;
}

function removeSensitive(value) {
  if (Array.isArray(value)) {
    value.forEach(removeSensitive);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (["email", "phone", "address", "full_name", "government_id", "card_number", "cvv", "payment_token", "account_number"].includes(key.toLowerCase())) {
      delete value[key];
    } else {
      removeSensitive(value[key]);
    }
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = extname(filePath);
  if (ext === ".html") return "text/html";
  if (ext === ".css") return "text/css";
  if (ext === ".js") return "text/javascript";
  return "application/octet-stream";
}
