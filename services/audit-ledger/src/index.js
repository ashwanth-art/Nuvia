import { makeStableId, stableHash } from "../../../packages/schemas/src/index.js";

export function createAuditLedger() {
  const records = [];

  return {
    append(type, payload) {
      const record = {
        audit_id: makeStableId("audit", {
          type,
          payload,
          index: records.length
        }),
        type,
        payload_hash: stableHash(payload),
        payload,
        recorded_at: new Date().toISOString()
      };

      records.push(record);
      return record;
    },

    list() {
      return [...records];
    },

    findByType(type) {
      return records.filter((record) => record.type === type);
    }
  };
}

export function recordPhase1Run(ledger, { request, contextPack, policyResult, plan, actionGraph, receipt }) {
  ledger.append("decision.request.created", {
    request_id: request.request_id,
    tenant_id: request.tenant_id,
    decision_domain: request.decision_domain,
    context_pack_id: contextPack.context_pack_id
  });

  ledger.append("policy.evaluated", {
    request_id: request.request_id,
    decision: policyResult.decision,
    requires_approval: policyResult.requires_approval,
    policy_refs: policyResult.policy_refs
  });

  ledger.append("decision.plan.created", {
    request_id: request.request_id,
    decision_id: plan.decision_id,
    summary: plan.summary
  });

  ledger.append("action_graph.compiled", {
    decision_id: plan.decision_id,
    action_graph_id: actionGraph.action_graph_id,
    approval_status: actionGraph.approval_status
  });

  ledger.append("execution.receipt.created", {
    action_graph_id: actionGraph.action_graph_id,
    receipt_id: receipt.receipt_id,
    status: receipt.status
  });

  return ledger.list();
}
