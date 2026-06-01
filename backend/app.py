from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from nuvia_core import (
    NuviaValidationError,
    ingest_live_batch,
    live_data_source_summary,
    run_scenario,
    sample_checkout_event,
    scenario_catalog,
    team_progress,
    test_matrix,
)
from store import NuviaStore


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "apps" / "control-room" / "static"
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
store = NuviaStore(DATA_DIR / "nuvia.sqlite3")


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "product": "Nuvia", "backend": "Flask"})


@app.get("/api/live-data/source")
def live_data_source():
    return jsonify(live_data_source_summary())


@app.get("/api/live-data/sample")
def live_data_sample():
    return jsonify({"event": sample_checkout_event(), "source": live_data_source_summary()})


@app.post("/api/live-data/ingest")
def live_data_ingest():
    payload = request.get_json(silent=True) or {}
    events = payload.get("events")
    if events is None and isinstance(payload, list):
        events = payload
    result = ingest_live_batch(events or [])
    stored = []
    for accepted in result["accepted"]:
        stored.append(store.store_external_decision("live-data", accepted["decision"]))
    result["stored_decisions"] = stored
    return jsonify(result)


@app.get("/api/scenarios")
def scenarios():
    return jsonify({"scenarios": scenario_catalog()})


@app.get("/api/decisions/<scenario_key>")
def decision_scenario(scenario_key: str):
    return jsonify(run_scenario(scenario_key))


@app.post("/api/decisions/run")
def run_and_store_decision():
    payload = request.get_json(silent=True) or {}
    scenario_key = payload.get("scenario_key", "safe-offer")
    return jsonify(store.run_and_store_decision(scenario_key))


@app.get("/api/decisions")
def decisions():
    return jsonify({"decisions": store.list_decisions()})


@app.get("/api/stored-decisions/<decision_id>")
def stored_decision(decision_id: str):
    return jsonify(store.get_decision(decision_id))


@app.get("/api/approvals")
def approvals():
    return jsonify({"approvals": store.list_approvals()})


@app.post("/api/approvals/<approval_id>/decision")
def approval_decision(approval_id: str):
    payload = request.get_json(silent=True) or {}
    return jsonify(
        store.update_approval(
            approval_id=approval_id,
            action=payload.get("action", "approved"),
            reviewer=payload.get("reviewer", "operator"),
            note=payload.get("note", ""),
        )
    )


@app.get("/api/policies")
def policies():
    return jsonify({"policies": store.list_policies()})


@app.put("/api/policies/<policy_id>")
def policy_update(policy_id: str):
    payload = request.get_json(silent=True) or {}
    return jsonify(store.update_policy(policy_id, payload))


@app.get("/api/connectors")
def connectors():
    return jsonify({"connectors": store.list_connectors()})


@app.post("/api/connectors/<connector_id>/health")
def connector_health(connector_id: str):
    payload = request.get_json(silent=True) or {}
    return jsonify(store.update_connector_health(connector_id, payload.get("status", "healthy")))


@app.post("/api/simulations/run")
def simulation_run():
    payload = request.get_json(silent=True) or {}
    return jsonify(store.run_simulation(payload.get("scenario_key", "safe-offer")))


@app.get("/api/simulations")
def simulations():
    return jsonify({"simulations": store.list_simulations()})


@app.get("/api/audit")
def audit_events():
    return jsonify({"audit_events": store.list_audit_events()})


@app.get("/api/dashboard")
def dashboard():
    return jsonify(store.dashboard())


@app.get("/api/tests/matrix")
def tests_matrix():
    return jsonify({"tests": test_matrix()})


@app.get("/api/team/progress")
def team_progress_api():
    return jsonify({"team": team_progress()})


@app.errorhandler(NuviaValidationError)
def validation_error(error: NuviaValidationError):
    return jsonify({"error": str(error)}), 400


@app.errorhandler(KeyError)
def missing_record(error: KeyError):
    return jsonify({"error": f"Record not found: {error}"}), 404


@app.errorhandler(ValueError)
def bad_request(error: ValueError):
    return jsonify({"error": str(error)}), 400


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
