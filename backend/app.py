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


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "apps" / "control-room" / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")


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
    return jsonify(ingest_live_batch(events or []))


@app.get("/api/scenarios")
def scenarios():
    return jsonify({"scenarios": scenario_catalog()})


@app.get("/api/decisions/<scenario_key>")
def decision_scenario(scenario_key: str):
    return jsonify(run_scenario(scenario_key))


@app.get("/api/dashboard")
def dashboard():
    return jsonify(run_scenario("safe-offer")["dashboard"])


@app.get("/api/tests/matrix")
def tests_matrix():
    return jsonify({"tests": test_matrix()})


@app.get("/api/team/progress")
def team_progress_api():
    return jsonify({"team": team_progress()})


@app.errorhandler(NuviaValidationError)
def validation_error(error: NuviaValidationError):
    return jsonify({"error": str(error)}), 400


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
