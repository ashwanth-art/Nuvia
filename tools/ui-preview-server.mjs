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
import { evaluatePolicies } from "../services/policy-service/src/index.js";
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

  if (url.pathname.startsWith("/api/decisions/")) {
    const key = decodeURIComponent(url.pathname.split("/").pop());
    sendJson(response, 200, await runScenario(key));
    return;
  }

  if (url.pathname === "/api/dashboard") {
    sendJson(response, 200, (await runScenario("safe-offer")).dashboard);
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
          completed: ["Event validation", "Context assembly", "Policy checks", "Action compiler"],
          next: ["Persist policies", "Add redemption contracts", "Policy editor APIs"]
        },
        {
          owner: "vijju",
          track: "Execution, Connectors, Audit",
          completed: ["Mock execution", "Execution receipt", "Audit records", "Live-data gateway"],
          next: ["Real connector adapters", "Retry/dead-letter persistence", "Connector health"]
        },
        {
          owner: "chaitanya",
          track: "Control Room, Agents, Evaluation",
          completed: ["React UI", "Scenario runner", "Agent recommendations", "Evaluation view"],
          next: ["Approval actions", "Simulation history", "Role-based views"]
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
  const policyResult = evaluatePolicies(request, context);
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
    accepted.push({
      event_id: event.event_id,
      event: stripSensitive(event),
      decision: await runScenario("safe-offer")
    });
  }
  return {
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    accepted,
    rejected,
    data_source: liveDataSource()
  };
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
