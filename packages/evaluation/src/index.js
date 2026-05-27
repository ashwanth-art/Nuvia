export function evaluatePhase1Run({ request, policyResult, actionGraph, receipt }) {
  const checks = [
    {
      name: "request_has_policy_bundle",
      passed: Boolean(request.policy_bundle_ref)
    },
    {
      name: "policy_result_has_decision",
      passed: ["allow", "review", "block"].includes(policyResult.decision)
    },
    {
      name: "action_graph_has_actions",
      passed: actionGraph.actions.length > 0
    },
    {
      name: "receipt_status_valid",
      passed: ["completed", "awaiting_approval", "failed"].includes(receipt.status)
    }
  ];

  return {
    status: checks.every((check) => check.passed) ? "pass" : "fail",
    checks
  };
}
