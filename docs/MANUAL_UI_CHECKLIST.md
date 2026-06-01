# Manual UI Checklist

Use this checklist when manually reviewing the Nuvia Flask + React product shell.

## Run

Install Python and Flask, then run:

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## Live Data Used

The current product shell uses **demo sandbox live-like checkout data**, not real customer production data.

It includes:

- `tenant_id`
- `event_id`
- `event_type`
- `event_time`
- POS source system
- store/location ID
- terminal ID
- customer ID
- loyalty ID
- consent profile ID
- basket ID
- SKU
- item name
- quantity
- unit price
- margin percent
- fraud risk score by scenario

It redacts:

- email
- phone
- address
- full name
- government ID
- card number
- CVV
- payment token
- account number

## Manual Checks

1. Open the Control Room.
2. Click **Safe checkout offer**.
   - Expected: policy decision is `allow`.
   - Expected: execution status is `completed`.
3. Click **Run And Store**.
   - Expected: decision appears under Stored Decisions.
   - Expected: dashboard total decisions increases.
4. Click **Medium fraud review**, then **Run And Store**.
   - Expected: approval queue is `1`.
   - Expected: execution status is `awaiting_approval`.
5. Open **Approvals** tab.
   - Expected: pending approval is visible.
   - Click **Approve**.
   - Expected: execution becomes `completed`.
6. Click **High fraud block**.
   - Expected: policy decision is `block`.
   - Expected: action type is fraud case creation.
7. Click **Low margin review**.
   - Expected: margin policy requires review.
8. Click **Missing consent**.
   - Expected: consent policy blocks personalization.
9. Open **Live Data** tab.
   - Add `email`, `phone`, and `card_number` to the JSON.
   - Run Live Data Gateway.
   - Expected: sensitive fields are removed in accepted output.
10. Change `event_type` to `unknown.event`.
   - Expected: event is rejected with `UNSUPPORTED_EVENT_TYPE`.
11. Open **Policies** tab.
    - Change a threshold.
    - Save policy.
    - Run a scenario again.
    - Expected: stored policy is used for later Flask runs.
12. Open **Connectors** tab.
    - Mark a connector degraded or down.
    - Expected: connector card updates.
13. Open **Simulation** tab.
    - Run simulation for every scenario.
    - Expected: simulation history appears.
14. Open **Audit** tab.
   - Expected: decision request, policy, plan, action graph, and receipt records are visible.
15. Open **Tests** tab.
   - Expected: automated matrix and current scenario evaluation are visible.
