export function buildControlRoomSnapshot(auditRecords) {
  const latestExecution = auditRecords
    .filter((record) => record.type === "execution.receipt.created")
    .at(-1);

  return {
    total_audit_events: auditRecords.length,
    decisions_created: auditRecords.filter((record) => record.type === "decision.request.created").length,
    action_graphs_compiled: auditRecords.filter((record) => record.type === "action_graph.compiled").length,
    latest_execution_status: latestExecution?.payload.status ?? "none",
    recent_events: auditRecords.slice(-5).map((record) => ({
      type: record.type,
      recorded_at: record.recorded_at
    }))
  };
}

export function formatControlRoomSnapshot(snapshot) {
  return [
    `Decisions created: ${snapshot.decisions_created}`,
    `Action graphs compiled: ${snapshot.action_graphs_compiled}`,
    `Latest execution status: ${snapshot.latest_execution_status}`,
    `Audit events: ${snapshot.total_audit_events}`
  ].join("\n");
}
