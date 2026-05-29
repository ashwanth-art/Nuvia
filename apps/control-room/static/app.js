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
  }
};

function App() {
  const [scenarios, setScenarios] = useState([]);
  const [activeScenario, setActiveScenario] = useState("safe-offer");
  const [decision, setDecision] = useState(null);
  const [source, setSource] = useState(null);
  const [sampleEvent, setSampleEvent] = useState(null);
  const [tests, setTests] = useState([]);
  const [team, setTeam] = useState([]);
  const [tab, setTab] = useState("decision");
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (activeScenario) {
      loadScenario(activeScenario);
    }
  }, [activeScenario]);

  async function loadInitial() {
    try {
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
    } catch (loadError) {
      setError(`Could not load backend data: ${loadError.message}`);
    }
  }

  async function loadScenario(key) {
    try {
      setError("");
      setDecision(await API.get(`/api/decisions/${key}`));
    } catch (loadError) {
      setError(`Could not run scenario: ${loadError.message}`);
    }
  }

  async function submitBatch() {
    try {
      setError("");
      const payload = JSON.parse(batchText);
      const events = Array.isArray(payload) ? payload : payload.events;
      setBatchResult(await API.post("/api/live-data/ingest", { events }));
      setTab("live-data");
    } catch (submitError) {
      setError(`Batch failed: ${submitError.message}`);
    }
  }

  const metrics = useMemo(() => buildMetrics(decision), [decision]);

  return h("div", { className: "app-shell" }, [
    h(Header, { key: "header" }),
    h("main", { className: "main", key: "main" }, [
      error ? h("div", { className: "error", key: "error" }, error) : null,
      h("section", { className: "hero-band", key: "hero" }, [
        h("div", { className: "intro", key: "intro" }, [
          h("h1", null, "Nuvia Control Room"),
          h(
            "p",
            null,
            "A Flask + React product shell for governed loyalty decisions, live-data sanitization, policy checks, execution receipts, audit trails, and manual scenario testing."
          )
        ]),
        h(LiveSourceBox, { source, key: "source" })
      ]),
      h(MetricsGrid, { metrics, key: "metrics" }),
      h("section", { className: "workspace", key: "workspace" }, [
        h(ScenarioPanel, { scenarios, activeScenario, setActiveScenario, key: "scenarios" }),
        h("div", { className: "panel", key: "detail" }, [
          h(Tabs, { tab, setTab, key: "tabs" }),
          tab === "decision" ? h(DecisionView, { decision, key: "decision" }) : null,
          tab === "live-data" ? h(LiveDataView, { source, sampleEvent, batchText, setBatchText, submitBatch, batchResult, key: "live" }) : null,
          tab === "audit" ? h(AuditView, { decision, key: "audit" }) : null,
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

function ScenarioPanel({ scenarios, activeScenario, setActiveScenario }) {
  return h("aside", { className: "panel" }, [
    h("h2", null, "Manual Scenarios"),
    h("p", { className: "muted" }, "Run each scenario to manually verify policy, action graph, execution, audit, and evaluation behavior."),
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
    )
  ]);
}

function Tabs({ tab, setTab }) {
  const tabs = [
    ["decision", "Decision"],
    ["live-data", "Live Data"],
    ["audit", "Audit"],
    ["tests", "Tests"],
    ["team", "Team"]
  ];
  return h(
    "div",
    { className: "tabs" },
    tabs.map(([key, label]) =>
      h(
        "button",
        {
          className: `tab ${tab === key ? "active" : ""}`,
          key,
          onClick: () => setTab(key)
        },
        label
      )
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
        row("Actions", String(graph.actions.length)),
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
      h("p", { className: "muted" }, "Paste demo events here. Try adding email, phone, card_number, or an unsupported event_type to verify redaction/rejection."),
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
            row("Rejected", String(batchResult.rejected_count))
          ]),
          h("pre", { className: "code-block", style: { marginTop: "12px" } }, JSON.stringify(batchResult, null, 2))
        ])
      : null
  ]);
}

function AuditView({ decision }) {
  if (!decision) return h("div", { className: "muted" }, "Loading audit...");
  return h("div", { className: "audit-list" }, decision.audit_records.map((record) => h("div", { className: "audit-item", key: record.audit_id }, [
    h("strong", null, record.type),
    h("div", { className: "muted" }, `Audit ID: ${record.audit_id}`),
    h("div", { className: "muted" }, `Payload hash: ${record.payload_hash}`),
    h("pre", { className: "code-block" }, JSON.stringify(record.payload, null, 2))
  ])));
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

function buildMetrics(decision) {
  const dashboard = decision?.dashboard || {};
  return [
    { label: "Policy decision", value: dashboard.policy_decision || "-", note: "allow, review, or block" },
    { label: "Approval queue", value: String(dashboard.approval_queue ?? "-"), note: "items waiting for review" },
    { label: "Execution", value: dashboard.execution_status || "-", note: "current action status" },
    { label: "Audit events", value: String(dashboard.audit_events ?? "-"), note: "immutable records" }
  ];
}

function row(label, value) {
  return h("div", { className: "row", key: label }, [h("span", { className: "row-label" }, label), h("span", { className: "row-value" }, value)]);
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
