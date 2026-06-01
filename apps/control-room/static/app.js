const { createElement: h, useEffect, useMemo, useState } = React;

const API = {
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`GET ${path} failed`);
    return response.json();
  },
  async post(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`POST ${path} failed`);
    return response.json();
  },
  async put(path, payload) {
    const response = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`PUT ${path} failed`);
    return response.json();
  }
};

function App() {
  const [scenarios, setScenarios] = useState([]);
  const [activeScenario, setActiveScenario] = useState("safe-offer");
  const [decision, setDecision] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [source, setSource] = useState(null);
  const [sampleEvent, setSampleEvent] = useState(null);
  const [storedDecisions, setStoredDecisions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [tests, setTests] = useState([]);
  const [team, setTeam] = useState([]);
  const [tab, setTab] = useState("decision");
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (activeScenario) {
      previewScenario(activeScenario);
    }
  }, [activeScenario]);

  async function loadInitial() {
    try {
      setError("");
      const [scenarioData, sourceData, sampleData, testData, teamData] = await Promise.all([
        API.get("/api/scenarios"),
        API.get("/api/live-data/source"),
        API.get("/api/live-data/sample"),
        API.get("/api/tests/matrix"),
        API.get("/api/team/progress")
      ]);
      setScenarios(scenarioData.scenarios);
      setSource(sourceData);
      setSampleEvent(sampleData.event);
      setBatchText(JSON.stringify({ events: [sampleData.event] }, null, 2));
      setTests(testData.tests);
      setTeam(teamData.team);
      await refreshWorkspace();
    } catch (loadError) {
      setError(`Could not load product data: ${loadError.message}`);
    }
  }

  async function refreshWorkspace() {
    const [dashboardData, decisionData, approvalData, policyData, connectorData, simulationData, auditData] = await Promise.all([
      API.get("/api/dashboard"),
      API.get("/api/decisions"),
      API.get("/api/approvals"),
      API.get("/api/policies"),
      API.get("/api/connectors"),
      API.get("/api/simulations"),
      API.get("/api/audit")
    ]);
    setDashboard(dashboardData);
    setStoredDecisions(decisionData.decisions || []);
    setApprovals(approvalData.approvals || []);
    setPolicies(policyData.policies || []);
    setConnectors(connectorData.connectors || []);
    setSimulations(simulationData.simulations || []);
    setAuditEvents(auditData.audit_events || []);
  }

  async function previewScenario(key) {
    try {
      setError("");
      const result = await API.get(`/api/decisions/${key}`);
      setDecision(result);
    } catch (loadError) {
      setError(`Could not preview scenario: ${loadError.message}`);
    }
  }

  async function runSelectedScenario() {
    try {
      setError("");
      setMessage("");
      const stored = await API.post("/api/decisions/run", { scenario_key: activeScenario });
      setDecision(stored.payload);
      setMessage(`Stored decision ${stored.id}`);
      await refreshWorkspace();
      setTab("decision");
    } catch (runError) {
      setError(`Could not run scenario: ${runError.message}`);
    }
  }

  async function openStoredDecision(decisionId) {
    const stored = await API.get(`/api/stored-decisions/${decisionId}`);
    setDecision(stored.payload);
    setTab("decision");
  }

  async function submitApproval(approvalId, action) {
    try {
      setError("");
      const stored = await API.post(`/api/approvals/${approvalId}/decision`, {
        action,
        reviewer: "control-room-operator",
        note: `${action} from Control Room`
      });
      setDecision(stored.payload);
      setMessage(`Approval ${action}`);
      await refreshWorkspace();
      setTab("decision");
    } catch (approvalError) {
      setError(`Approval update failed: ${approvalError.message}`);
    }
  }

  async function updatePolicy(policy) {
    try {
      setError("");
      await API.put(`/api/policies/${policy.id}`, policy);
      setMessage(`Updated ${policy.name}`);
      await refreshWorkspace();
    } catch (policyError) {
      setError(`Policy update failed: ${policyError.message}`);
    }
  }

  async function updateConnector(connectorId, status) {
    try {
      setError("");
      await API.post(`/api/connectors/${connectorId}/health`, { status });
      setMessage(`Connector ${connectorId} marked ${status}`);
      await refreshWorkspace();
    } catch (connectorError) {
      setError(`Connector update failed: ${connectorError.message}`);
    }
  }

  async function runSimulation(scenarioKey) {
    try {
      setError("");
      const result = await API.post("/api/simulations/run", { scenario_key: scenarioKey });
      setMessage(`Simulation ${result.id} completed`);
      await refreshWorkspace();
      setTab("simulation");
    } catch (simulationError) {
      setError(`Simulation failed: ${simulationError.message}`);
    }
  }

  async function submitBatch() {
    try {
      setError("");
      const payload = JSON.parse(batchText);
      const events = Array.isArray(payload) ? payload : payload.events;
      const result = await API.post("/api/live-data/ingest", { events });
      setBatchResult(result);
      setMessage(`Live batch accepted ${result.accepted_count}, rejected ${result.rejected_count}`);
      await refreshWorkspace();
      setTab("live-data");
    } catch (submitError) {
      setError(`Batch failed: ${submitError.message}`);
    }
  }

  const metrics = useMemo(() => buildMetrics(dashboard, decision), [dashboard, decision]);

  return h("div", { className: "app-shell" }, [
    h(Header, { key: "header" }),
    h("main", { className: "main", key: "main" }, [
      error ? h("div", { className: "error", key: "error" }, error) : null,
      message ? h("div", { className: "notice", key: "message" }, message) : null,
      h("section", { className: "hero-band", key: "hero" }, [
        h("div", { className: "intro", key: "intro" }, [
          h("h1", null, "Nuvia Control Room"),
          h(
            "p",
            null,
            "Complete local MVP for governed loyalty decisions: live-data gateway, policy center, approvals, execution receipts, connector health, simulation, audit, and tests."
          )
        ]),
        h(LiveSourceBox, { source, key: "source" })
      ]),
      h(MetricsGrid, { metrics, key: "metrics" }),
      h("section", { className: "workspace", key: "workspace" }, [
        h(ScenarioPanel, {
          scenarios,
          activeScenario,
          setActiveScenario,
          runSelectedScenario,
          runSimulation,
          storedDecisions,
          openStoredDecision,
          key: "scenarios"
        }),
        h("div", { className: "panel", key: "detail" }, [
          h(Tabs, { tab, setTab, key: "tabs" }),
          tab === "decision" ? h(DecisionView, { decision, key: "decision" }) : null,
          tab === "approvals" ? h(ApprovalsView, { approvals, submitApproval, key: "approvals" }) : null,
          tab === "live-data" ? h(LiveDataView, { source, sampleEvent, batchText, setBatchText, submitBatch, batchResult, key: "live" }) : null,
          tab === "policies" ? h(PoliciesView, { policies, setPolicies, updatePolicy, key: "policies" }) : null,
          tab === "connectors" ? h(ConnectorsView, { connectors, updateConnector, key: "connectors" }) : null,
          tab === "simulation" ? h(SimulationView, { scenarios, simulations, runSimulation, key: "simulation" }) : null,
          tab === "audit" ? h(AuditView, { decision, auditEvents, key: "audit" }) : null,
          tab === "tests" ? h(TestsView, { tests, decision, key: "tests" }) : null,
          tab === "team" ? h(TeamView, { team, key: "team" }) : null
        ])
      ])
    ])
  ]);
}

function Header() {
  return h("header", { className: "topbar" }, [
    h("div", { className: "brand", key: "brand" }, [
      h("div", { className: "brand-title" }, "Nuvia"),
      h("div", { className: "brand-subtitle" }, "Enterprise decision orchestrator")
    ]),
    h("div", { className: "top-actions", key: "actions" }, [
      h("span", { className: "status pass" }, "Flask backend"),
      h("span", { className: "status pass" }, "React frontend"),
      h("span", { className: "status review" }, "Local SQLite"),
      h("span", { className: "status review" }, "Demo live data")
    ])
  ]);
}

function LiveSourceBox({ source }) {
  if (!source) return h("div", { className: "source-box panel" }, "Loading live data source...");
  return h("div", { className: "source-box panel" }, [
    h("h2", null, "Live Data Used"),
    h("ul", { className: "source-list" }, [
      h("li", null, `Mode: ${source.mode}`),
      h("li", null, source.note),
      h("li", null, `Sources: ${source.source_systems.join(", ")}`),
      h("li", null, `Redacts: ${source.redacted_fields.join(", ")}`)
    ])
  ]);
}

function MetricsGrid({ metrics }) {
  return h(
    "section",
    { className: "metrics-grid" },
    metrics.map((metric) =>
      h("div", { className: "metric", key: metric.label }, [
        h("div", { className: "metric-label" }, metric.label),
        h("div", { className: "metric-value" }, metric.value),
        h("div", { className: "muted" }, metric.note)
      ])
    )
  );
}

function ScenarioPanel({ scenarios, activeScenario, setActiveScenario, runSelectedScenario, runSimulation, storedDecisions, openStoredDecision }) {
  return h("aside", { className: "panel" }, [
    h("h2", null, "Decision Workbench"),
    h("p", { className: "muted" }, "Preview scenarios, store real runs, and open persisted decisions."),
    h(
      "div",
      { className: "scenario-list" },
      scenarios.map((scenario) =>
        h(
          "button",
          {
            className: `scenario-button ${scenario.key === activeScenario ? "active" : ""}`,
            key: scenario.key,
            onClick: () => setActiveScenario(scenario.key)
          },
          [
            h("span", { className: "scenario-name" }, scenario.name),
            h("span", { className: "scenario-desc" }, scenario.description)
          ]
        )
      )
    ),
    h("div", { className: "button-row" }, [
      h("button", { className: "primary-button", onClick: runSelectedScenario }, "Run And Store"),
      h("button", { className: "secondary-button", onClick: () => runSimulation(activeScenario) }, "Simulate")
    ]),
    h("h2", { className: "section-title" }, "Stored Decisions"),
    h(
      "div",
      { className: "history-list" },
      storedDecisions.length
        ? storedDecisions.map((item) =>
            h("button", { className: "history-item", key: item.id, onClick: () => openStoredDecision(item.id) }, [
              h("span", { className: "scenario-name" }, item.scenario_key),
              h("span", { className: "scenario-desc" }, `${item.policy_decision} / ${item.execution_status}`)
            ])
          )
        : h("div", { className: "muted" }, "No stored runs yet.")
    )
  ]);
}

function Tabs({ tab, setTab }) {
  const tabs = [
    ["decision", "Decision"],
    ["approvals", "Approvals"],
    ["live-data", "Live Data"],
    ["policies", "Policies"],
    ["connectors", "Connectors"],
    ["simulation", "Simulation"],
    ["audit", "Audit"],
    ["tests", "Tests"],
    ["team", "Team"]
  ];
  return h(
    "div",
    { className: "tabs" },
    tabs.map(([key, label]) =>
      h("button", { className: `tab ${tab === key ? "active" : ""}`, key, onClick: () => setTab(key) }, label)
    )
  );
}

function DecisionView({ decision }) {
  if (!decision) return h("div", { className: "muted" }, "Loading decision...");
  const policy = decision.policy_result;
  const plan = decision.decision_plan;
  const graph = decision.action_graph;
  const receipt = decision.execution_receipt;
  return h("div", { className: "detail-grid" }, [
    h("div", { className: "mini-card" }, [
      h("h3", null, "Policy Decision"),
      h("span", { className: `status ${policy.decision}` }, policy.decision),
      h("div", { className: "row-list", style: { marginTop: "12px" } }, [
        row("Approval required", String(policy.requires_approval)),
        row("Risk score", String(plan.risk_score)),
        row("Policy version", policy.policy_version)
      ])
    ]),
    h("div", { className: "mini-card" }, [
      h("h3", null, "Execution"),
      h("span", { className: `status ${receipt.status}` }, receipt.status),
      h("div", { className: "row-list", style: { marginTop: "12px" } }, [
        row("Action graph", graph.action_graph_id),
        row("Approval status", graph.approval_status),
        row("Receipt", receipt.receipt_id)
      ])
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Decision Summary"),
      h("p", null, plan.summary),
      h("div", { className: "policy-list" }, policy.checks.map((check) => h(PolicyItem, { check, key: check.policy_ref })))
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Agent Recommendations"),
      h(
        "div",
        { className: "agent-list" },
        plan.agent_recommendations.map((agent) =>
          h("div", { className: "agent-item", key: agent.agent }, [
            h("strong", null, agent.agent),
            h("p", null, agent.recommendation),
            h("div", { className: "muted" }, `${agent.risk_note} Confidence: ${Math.round(agent.confidence * 100)}%`)
          ])
        )
      )
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Action Graph JSON"),
      h("pre", { className: "code-block" }, JSON.stringify(graph, null, 2))
    ])
  ]);
}

function ApprovalsView({ approvals, submitApproval }) {
  return h("div", { className: "approval-list" }, [
    approvals.length
      ? approvals.map((approval) =>
          h("div", { className: "mini-card", key: approval.id }, [
            h("div", { className: "policy-head" }, [
              h("strong", null, approval.scenario_key),
              h("span", { className: `status ${approval.status}` }, approval.status)
            ]),
            h("div", { className: "row-list", style: { marginTop: "12px" } }, [
              row("Approval ID", approval.id),
              row("Decision ID", approval.decision_id),
              row("Policy decision", approval.policy_decision),
              row("Execution", approval.execution_status)
            ]),
            h("p", { className: "muted" }, approval.reason),
            h("div", { className: "button-row" }, [
              h("button", { className: "primary-button", onClick: () => submitApproval(approval.id, "approved") }, "Approve"),
              h("button", { className: "secondary-button", onClick: () => submitApproval(approval.id, "rejected") }, "Reject"),
              h("button", { className: "secondary-button", onClick: () => submitApproval(approval.id, "escalated") }, "Escalate")
            ])
          ])
        )
      : h("div", { className: "muted" }, "No approval items. Run the Medium Fraud or Low Margin scenario and store it.")
  ]);
}

function PoliciesView({ policies, setPolicies, updatePolicy }) {
  function changePolicy(index, field, value) {
    setPolicies(policies.map((policy, currentIndex) => (currentIndex === index ? { ...policy, [field]: value } : policy)));
  }
  return h(
    "div",
    { className: "policy-list" },
    policies.map((policy, index) =>
      h("div", { className: "mini-card", key: policy.id }, [
        h("div", { className: "policy-head" }, [
          h("strong", null, policy.name),
          h("span", { className: "status pass" }, policy.category)
        ]),
        h("p", { className: "muted" }, policy.description),
        h("div", { className: "form-grid" }, [
          h("label", null, [
            "Enabled",
            h("input", {
              type: "checkbox",
              checked: Boolean(policy.enabled),
              onChange: (event) => changePolicy(index, "enabled", event.target.checked ? 1 : 0)
            })
          ]),
          h("label", null, [
            "Threshold",
            h("input", {
              type: "number",
              step: "0.01",
              value: policy.threshold ?? "",
              onChange: (event) => changePolicy(index, "threshold", Number(event.target.value))
            })
          ])
        ]),
        h("div", { className: "button-row" }, [h("button", { className: "primary-button", onClick: () => updatePolicy(policy) }, "Save Policy")])
      ])
    )
  );
}

function ConnectorsView({ connectors, updateConnector }) {
  return h(
    "div",
    { className: "connector-grid" },
    connectors.map((connector) =>
      h("div", { className: "task-card", key: connector.id }, [
        h("div", { className: "policy-head" }, [
          h("h3", null, connector.name),
          h("span", { className: `status ${connector.status}` }, connector.status)
        ]),
        h("div", { className: "row-list" }, [
          row("Risk", connector.risk_class),
          row("Latency", `${connector.latency_ms} ms`),
          row("Error rate", `${Math.round(connector.error_rate * 100)}%`),
          row("Operations", connector.operations.join(", "))
        ]),
        h("div", { className: "button-row" }, [
          h("button", { className: "secondary-button", onClick: () => updateConnector(connector.id, "healthy") }, "Healthy"),
          h("button", { className: "secondary-button", onClick: () => updateConnector(connector.id, "degraded") }, "Degraded"),
          h("button", { className: "secondary-button", onClick: () => updateConnector(connector.id, "down") }, "Down")
        ])
      ])
    )
  );
}

function SimulationView({ scenarios, simulations, runSimulation }) {
  return h("div", { className: "detail-grid" }, [
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Run Simulation"),
      h("p", { className: "muted" }, "Simulations use the active policy thresholds without executing connectors."),
      h(
        "div",
        { className: "button-row" },
        scenarios.map((scenario) =>
          h("button", { className: "secondary-button", key: scenario.key, onClick: () => runSimulation(scenario.key) }, scenario.name)
        )
      )
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Simulation History"),
      simulations.length
        ? h(
            "div",
            { className: "test-list" },
            simulations.map((simulation) =>
              h("div", { className: "test-item", key: simulation.id }, [
                h("div", { className: "test-head" }, [
                  h("strong", null, simulation.scenario_key),
                  h("span", { className: `status ${simulation.policy_decision}` }, simulation.policy_decision)
                ]),
                h("div", { className: "muted" }, `Expected action: ${simulation.expected_action}`),
                h("pre", { className: "code-block" }, JSON.stringify(simulation.expected_impact, null, 2))
              ])
            )
          )
        : h("div", { className: "muted" }, "No simulations yet.")
    ])
  ]);
}

function PolicyItem({ check }) {
  const statusClass = check.result === "pass" ? "pass" : check.result;
  return h("div", { className: "policy-item" }, [
    h("div", { className: "policy-head" }, [
      h("strong", null, check.policy_ref),
      h("span", { className: `status ${statusClass}` }, check.result)
    ]),
    h("div", { className: "muted" }, check.message)
  ]);
}

function LiveDataView({ source, sampleEvent, batchText, setBatchText, submitBatch, batchResult }) {
  return h("div", { className: "detail-grid" }, [
    h("div", { className: "mini-card" }, [
      h("h3", null, "What Data Is Used"),
      h("ul", { className: "source-list" }, (source?.included_fields || []).map((field) => h("li", { key: field }, field)))
    ]),
    h("div", { className: "mini-card" }, [
      h("h3", null, "What Is Redacted"),
      h("ul", { className: "source-list" }, (source?.redacted_fields || []).map((field) => h("li", { key: field }, field)))
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Manual Batch Test"),
      h("p", { className: "muted" }, "Paste demo events. Add email, phone, card_number, or an unsupported event_type to verify redaction/rejection."),
      h("textarea", { value: batchText, onChange: (event) => setBatchText(event.target.value) }),
      h("div", { className: "button-row" }, [
        h("button", { className: "primary-button", onClick: submitBatch }, "Run Live Data Gateway"),
        sampleEvent
          ? h("button", { className: "secondary-button", onClick: () => setBatchText(JSON.stringify({ events: [sampleEvent] }, null, 2)) }, "Reset Sample")
          : null
      ])
    ]),
    batchResult
      ? h("div", { className: "mini-card full-span" }, [
          h("h3", null, "Gateway Result"),
          h("div", { className: "row-list" }, [
            row("Accepted", String(batchResult.accepted_count)),
            row("Rejected", String(batchResult.rejected_count)),
            row("Stored decisions", String(batchResult.stored_decisions?.length || 0))
          ]),
          h("pre", { className: "code-block", style: { marginTop: "12px" } }, JSON.stringify(batchResult, null, 2))
        ])
      : null
  ]);
}

function AuditView({ decision, auditEvents }) {
  const localRecords = decision?.audit_records || [];
  return h("div", { className: "detail-grid" }, [
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Current Decision Audit"),
      h("div", { className: "audit-list" }, localRecords.map((record) => auditItem(record, record.audit_id)))
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Persisted Audit Ledger"),
      auditEvents.length
        ? h("div", { className: "audit-list" }, auditEvents.map((record) => auditItem(record, record.audit_id)))
        : h("div", { className: "muted" }, "No persisted audit events yet.")
    ])
  ]);
}

function auditItem(record, key) {
  return h("div", { className: "audit-item", key }, [
    h("strong", null, record.type),
    h("div", { className: "muted" }, `Audit ID: ${record.audit_id}`),
    record.payload_hash ? h("div", { className: "muted" }, `Payload hash: ${record.payload_hash}`) : null,
    h("pre", { className: "code-block" }, JSON.stringify(record.payload, null, 2))
  ]);
}

function TestsView({ tests, decision }) {
  const evalChecks = decision?.evaluation?.checks || [];
  return h("div", { className: "detail-grid" }, [
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Automated Test Matrix"),
      h("div", { className: "test-list" }, tests.map((test) => h("div", { className: "test-item", key: `${test.area}-${test.case}` }, [
        h("div", { className: "test-head" }, [h("strong", null, `${test.area}: ${test.case}`), h("span", { className: "status pass" }, test.automated ? "automated" : "manual")]),
        h("div", { className: "muted" }, test.expected)
      ])))
    ]),
    h("div", { className: "mini-card full-span" }, [
      h("h3", null, "Current Scenario Evaluation"),
      h("div", { className: "test-list" }, evalChecks.map((check) => h("div", { className: "test-item", key: check.name }, [
        h("div", { className: "test-head" }, [h("strong", null, check.name), h("span", { className: `status ${check.passed ? "pass" : "fail"}` }, check.passed ? "pass" : "fail")]),
        h("div", { className: "muted" }, check.message)
      ])))
    ])
  ]);
}

function TeamView({ team }) {
  return h("div", { className: "team-grid" }, team.map((person) => h("div", { className: "task-card", key: person.owner }, [
    h("h3", null, person.owner),
    h("div", { className: "muted" }, person.track),
    h("strong", null, "Completed"),
    h("ul", { className: "task-list" }, person.completed.map((task) => h("li", { key: task }, task))),
    h("strong", null, "Next"),
    h("ul", { className: "task-list" }, person.next.map((task) => h("li", { key: task }, task)))
  ])));
}

function buildMetrics(dashboard, decision) {
  return [
    { label: "Total decisions", value: String(dashboard?.decision_volume ?? 0), note: "persisted local runs" },
    { label: "Approval queue", value: String(dashboard?.approval_queue ?? 0), note: "pending human review" },
    { label: "Current decision", value: decision?.policy_result?.decision || "-", note: "previewed scenario state" },
    { label: "Audit events", value: String(dashboard?.audit_events ?? decision?.audit_records?.length ?? 0), note: "ledger records" }
  ];
}

function row(label, value) {
  return h("div", { className: "row", key: label }, [h("span", { className: "row-label" }, label), h("span", { className: "row-value" }, value)]);
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
