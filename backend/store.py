from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import sqlite3
from typing import Any
from uuid import uuid4

from nuvia_core import DEFAULT_POLICIES, run_scenario, stable_id, utc_now


class NuviaStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def init_db(self) -> None:
        with self.connect() as db:
            db.executescript(
                """
                create table if not exists decisions (
                    id text primary key,
                    scenario_key text not null,
                    policy_decision text not null,
                    execution_status text not null,
                    approval_status text not null,
                    payload text not null,
                    created_at text not null,
                    updated_at text not null
                );

                create table if not exists approvals (
                    id text primary key,
                    decision_id text not null,
                    status text not null,
                    reason text not null,
                    reviewer text,
                    note text,
                    created_at text not null,
                    updated_at text not null
                );

                create table if not exists policies (
                    id text primary key,
                    name text not null,
                    category text not null,
                    enabled integer not null,
                    threshold real,
                    description text not null,
                    updated_at text not null
                );

                create table if not exists connectors (
                    id text primary key,
                    name text not null,
                    status text not null,
                    risk_class text not null,
                    operations text not null,
                    latency_ms integer not null,
                    error_rate real not null,
                    updated_at text not null
                );

                create table if not exists audit_events (
                    audit_id text primary key,
                    decision_id text,
                    type text not null,
                    payload text not null,
                    recorded_at text not null
                );

                create table if not exists simulations (
                    id text primary key,
                    scenario_key text not null,
                    payload text not null,
                    created_at text not null
                );
                """
            )
            self.seed_reference_data(db)

    def seed_reference_data(self, db: sqlite3.Connection) -> None:
        policy_count = db.execute("select count(*) from policies").fetchone()[0]
        if policy_count == 0:
            now = utc_now()
            policies = [
                (
                    "policy.consent.personalization.demo_v1",
                    "Consent required",
                    "consent",
                    1,
                    1,
                    "Customer must allow personalization before loyalty offers are generated.",
                ),
                (
                    "policy.margin.floor.demo_v1",
                    "Minimum margin floor",
                    "margin",
                    1,
                    DEFAULT_POLICIES["minimum_average_margin_percent"],
                    "Low-margin baskets require review before rewards are applied.",
                ),
                (
                    "policy.fraud.review.demo_v1",
                    "Fraud review threshold",
                    "fraud",
                    1,
                    DEFAULT_POLICIES["review_fraud_risk_threshold"],
                    "Medium fraud risk routes to human approval.",
                ),
                (
                    "policy.fraud.block.demo_v1",
                    "Fraud block threshold",
                    "fraud",
                    1,
                    DEFAULT_POLICIES["block_fraud_risk_threshold"],
                    "High fraud risk blocks automatic reward execution.",
                ),
                (
                    "policy.exposure.basket.demo_v1",
                    "Basket exposure threshold",
                    "financial",
                    1,
                    DEFAULT_POLICIES["human_review_basket_threshold"],
                    "Large baskets require human approval.",
                ),
            ]
            db.executemany(
                """
                insert into policies (id, name, category, enabled, threshold, description, updated_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                [(*policy, now) for policy in policies],
            )

        connector_count = db.execute("select count(*) from connectors").fetchone()[0]
        if connector_count == 0:
            now = utc_now()
            connectors = [
                ("loyalty_core_demo", "Loyalty Core", "healthy", "medium", ["apply_points_multiplier", "remove_points_multiplier"], 82, 0.0),
                ("review_queue_demo", "Human Review Queue", "healthy", "low", ["create_review_task", "cancel_review_task"], 45, 0.0),
                ("fraud_platform_demo", "Fraud Platform", "healthy", "high", ["create_case", "close_case"], 110, 0.01),
                ("notification_demo", "Notification Service", "degraded", "medium", ["send_message"], 180, 0.04),
                ("data_warehouse_demo", "Data Warehouse Export", "healthy", "low", ["append_audit_event"], 130, 0.0),
            ]
            db.executemany(
                """
                insert into connectors (id, name, status, risk_class, operations, latency_ms, error_rate, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [(id_, name, status, risk, json.dumps(ops), latency, error_rate, now) for id_, name, status, risk, ops, latency, error_rate in connectors],
            )

    def policy_overrides(self) -> dict[str, Any]:
        rows = self.list_policies()
        overrides: dict[str, Any] = {}
        for row in rows:
            if row["id"] == "policy.margin.floor.demo_v1":
                overrides["minimum_average_margin_percent"] = row["threshold"] if row["enabled"] else -1
            elif row["id"] == "policy.fraud.review.demo_v1":
                overrides["review_fraud_risk_threshold"] = row["threshold"] if row["enabled"] else 999
            elif row["id"] == "policy.fraud.block.demo_v1":
                overrides["block_fraud_risk_threshold"] = row["threshold"] if row["enabled"] else 999
            elif row["id"] == "policy.exposure.basket.demo_v1":
                overrides["human_review_basket_threshold"] = row["threshold"] if row["enabled"] else 999999999
            elif row["id"] == "policy.consent.personalization.demo_v1":
                overrides["consent_required"] = bool(row["enabled"]) and bool(row["threshold"])
        return overrides

    def run_and_store_decision(self, scenario_key: str) -> dict[str, Any]:
        result = run_scenario(scenario_key, self.policy_overrides())
        decision_id = f"run_{uuid4().hex[:12]}"
        now = utc_now()
        approval_status = result["action_graph"]["approval_status"]
        payload = deepcopy(result)
        payload["stored_decision_id"] = decision_id
        with self.connect() as db:
            db.execute(
                """
                insert into decisions (id, scenario_key, policy_decision, execution_status, approval_status, payload, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    decision_id,
                    scenario_key,
                    result["policy_result"]["decision"],
                    result["execution_receipt"]["status"],
                    approval_status,
                    json.dumps(payload),
                    now,
                    now,
                ),
            )
            if approval_status == "required":
                db.execute(
                    """
                    insert into approvals (id, decision_id, status, reason, reviewer, note, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"apr_{uuid4().hex[:12]}",
                        decision_id,
                        "pending",
                        result["decision_plan"]["summary"],
                        None,
                        None,
                        now,
                        now,
                    ),
                )
            self.insert_audit_records(db, decision_id, result["audit_records"])
        return self.get_decision(decision_id)

    def store_external_decision(self, scenario_key: str, result: dict[str, Any]) -> dict[str, Any]:
        decision_id = f"run_{uuid4().hex[:12]}"
        now = utc_now()
        payload = deepcopy(result)
        payload["stored_decision_id"] = decision_id
        with self.connect() as db:
            db.execute(
                """
                insert into decisions (id, scenario_key, policy_decision, execution_status, approval_status, payload, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    decision_id,
                    scenario_key,
                    result["policy_result"]["decision"],
                    result["execution_receipt"]["status"],
                    result["action_graph"]["approval_status"],
                    json.dumps(payload),
                    now,
                    now,
                ),
            )
            if result["action_graph"]["approval_status"] == "required":
                db.execute(
                    """
                    insert into approvals (id, decision_id, status, reason, reviewer, note, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"apr_{uuid4().hex[:12]}",
                        decision_id,
                        "pending",
                        result["decision_plan"]["summary"],
                        None,
                        None,
                        now,
                        now,
                    ),
                )
            self.insert_audit_records(db, decision_id, result["audit_records"])
        return self.get_decision(decision_id)

    def list_decisions(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute(
                """
                select id, scenario_key, policy_decision, execution_status, approval_status, created_at, updated_at
                from decisions
                order by created_at desc
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def get_decision(self, decision_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute("select * from decisions where id = ?", (decision_id,)).fetchone()
        if row is None:
            raise KeyError(decision_id)
        result = dict(row)
        result["payload"] = json.loads(result["payload"])
        return result

    def list_approvals(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute(
                """
                select approvals.*, decisions.scenario_key, decisions.policy_decision, decisions.execution_status
                from approvals
                join decisions on decisions.id = approvals.decision_id
                order by approvals.created_at desc
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def update_approval(self, approval_id: str, action: str, reviewer: str, note: str) -> dict[str, Any]:
        if action not in {"approved", "rejected", "escalated"}:
            raise ValueError("Approval action must be approved, rejected, or escalated")
        now = utc_now()
        with self.connect() as db:
            approval = db.execute("select * from approvals where id = ?", (approval_id,)).fetchone()
            if approval is None:
                raise KeyError(approval_id)
            decision = db.execute("select * from decisions where id = ?", (approval["decision_id"],)).fetchone()
            if decision is None:
                raise KeyError(approval["decision_id"])
            payload = json.loads(decision["payload"])
            if action == "approved":
                payload["action_graph"]["approval_status"] = "approved"
                payload["execution_receipt"] = self.completed_receipt(payload["action_graph"])
                payload["dashboard"]["execution_status"] = "completed"
                payload["dashboard"]["approval_queue"] = 0
                execution_status = "completed"
                approval_status = "approved"
            elif action == "rejected":
                payload["action_graph"]["approval_status"] = "rejected"
                payload["execution_receipt"]["status"] = "rejected"
                payload["dashboard"]["execution_status"] = "rejected"
                payload["dashboard"]["approval_queue"] = 0
                execution_status = "rejected"
                approval_status = "rejected"
            else:
                payload["dashboard"]["approval_queue"] = 1
                execution_status = decision["execution_status"]
                approval_status = "escalated"

            db.execute(
                """
                update approvals set status = ?, reviewer = ?, note = ?, updated_at = ?
                where id = ?
                """,
                (action, reviewer, note, now, approval_id),
            )
            db.execute(
                """
                update decisions set execution_status = ?, approval_status = ?, payload = ?, updated_at = ?
                where id = ?
                """,
                (execution_status, approval_status, json.dumps(payload), now, approval["decision_id"]),
            )
            audit_payload = {
                "approval_id": approval_id,
                "decision_id": approval["decision_id"],
                "action": action,
                "reviewer": reviewer,
                "note": note,
            }
            db.execute(
                """
                insert into audit_events (audit_id, decision_id, type, payload, recorded_at)
                values (?, ?, ?, ?, ?)
                """,
                (
                    stable_id("audit", audit_payload),
                    approval["decision_id"],
                    "approval.updated",
                    json.dumps(audit_payload),
                    now,
                ),
            )
        return self.get_decision(approval["decision_id"])

    def list_policies(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("select * from policies order by category, name").fetchall()
        return [dict(row) for row in rows]

    def update_policy(self, policy_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        with self.connect() as db:
            current = db.execute("select * from policies where id = ?", (policy_id,)).fetchone()
            if current is None:
                raise KeyError(policy_id)
            enabled = int(bool(updates.get("enabled", current["enabled"])))
            threshold = updates.get("threshold", current["threshold"])
            description = updates.get("description", current["description"])
            db.execute(
                """
                update policies set enabled = ?, threshold = ?, description = ?, updated_at = ?
                where id = ?
                """,
                (enabled, threshold, description, now, policy_id),
            )
        return next(policy for policy in self.list_policies() if policy["id"] == policy_id)

    def list_connectors(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("select * from connectors order by name").fetchall()
        connectors = []
        for row in rows:
            item = dict(row)
            item["operations"] = json.loads(item["operations"])
            connectors.append(item)
        return connectors

    def update_connector_health(self, connector_id: str, status: str) -> dict[str, Any]:
        now = utc_now()
        with self.connect() as db:
            result = db.execute("update connectors set status = ?, updated_at = ? where id = ?", (status, now, connector_id))
            if result.rowcount == 0:
                raise KeyError(connector_id)
        return next(connector for connector in self.list_connectors() if connector["id"] == connector_id)

    def run_simulation(self, scenario_key: str) -> dict[str, Any]:
        result = run_scenario(scenario_key, self.policy_overrides())
        simulation = {
            "id": f"sim_{uuid4().hex[:12]}",
            "scenario_key": scenario_key,
            "policy_decision": result["policy_result"]["decision"],
            "approval_required": result["policy_result"]["requires_approval"],
            "expected_action": result["action_graph"]["actions"][0]["type"],
            "expected_impact": result["decision_plan"]["expected_impact"],
            "evaluation": result["evaluation"],
            "created_at": utc_now(),
        }
        with self.connect() as db:
            db.execute(
                "insert into simulations (id, scenario_key, payload, created_at) values (?, ?, ?, ?)",
                (simulation["id"], scenario_key, json.dumps(simulation), simulation["created_at"]),
            )
        return simulation

    def list_simulations(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("select payload from simulations order by created_at desc").fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def list_audit_events(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("select * from audit_events order by recorded_at desc limit 100").fetchall()
        events = []
        for row in rows:
            item = dict(row)
            item["payload"] = json.loads(item["payload"])
            events.append(item)
        return events

    def dashboard(self) -> dict[str, Any]:
        with self.connect() as db:
            total = db.execute("select count(*) from decisions").fetchone()[0]
            pending = db.execute("select count(*) from approvals where status = 'pending'").fetchone()[0]
            blocked = db.execute("select count(*) from decisions where policy_decision = 'block'").fetchone()[0]
            completed = db.execute("select count(*) from decisions where execution_status = 'completed'").fetchone()[0]
            audit_count = db.execute("select count(*) from audit_events").fetchone()[0]
        return {
            "decision_volume": total,
            "approval_queue": pending,
            "policy_block_count": blocked,
            "completed_execution_count": completed,
            "audit_events": audit_count,
        }

    def insert_audit_records(self, db: sqlite3.Connection, decision_id: str, records: list[dict[str, Any]]) -> None:
        db.executemany(
            """
            insert or replace into audit_events (audit_id, decision_id, type, payload, recorded_at)
            values (?, ?, ?, ?, ?)
            """,
            [
                (
                    record["audit_id"],
                    decision_id,
                    record["type"],
                    json.dumps(record["payload"]),
                    record["recorded_at"],
                )
                for record in records
            ],
        )

    def completed_receipt(self, action_graph: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        actions = [
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
        return {
            "receipt_id": stable_id("rec", {"graph": action_graph["action_graph_id"], "status": "approved_completed"}),
            "action_graph_id": action_graph["action_graph_id"],
            "status": "completed",
            "started_at": now,
            "completed_at": now,
            "actions": actions,
            "audit_ref": stable_id("audit", {"graph": action_graph["action_graph_id"], "status": "completed"}),
        }
