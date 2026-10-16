"""
KaamSaathi — Complete End-to-End Workflow Test Suite
Validates:
- Workflow A: Create a job (unconfirmed readback guard, confirmed persistence, API retrieval, dashboard sync)
- Workflow B: Record a payment (job identification, confirmation, excess payment rejection, deterministic balance calculation, dashboard sync)
- Workflow C: Manage reminders (collection, confirmation, persistence, retrieval, toggle completion)
- Workflow D: Ask questions (ledger Q&A from authorized records, zero hallucination)
- Error handling & Security (auth boundary, client owner_id rejection, input validation, live Bolna session minting)
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_db
from tests.test_end_to_end_mvp import InMemoryLedgerDB

client = TestClient(app)

def test_workflow_a_create_job_end_to_end():
    """
    Workflow A:
    1. Worker speaks/enters customer name and description.
    2. Collects agreed amount & details.
    3. Details shown for review (unconfirmed readback guard).
    4. Explicit confirmation required.
    5. Confirmed request submitted to FastAPI.
    6. Validated & saved to Supabase under authenticated user.
    7. Actual saved record returned and dashboard refreshed.
    """
    db = InMemoryLedgerDB()
    user_id = "worker-uuid-wf-a"

    app.dependency_overrides[get_authenticated_user_id] = lambda: user_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # 1 & 3: Unconfirmed submission -> verbal readback guard, 0 records in DB
        unconfirmed_payload = {
            "customer_name": "Ramesh Verma",
            "customer_phone": "+91 98300 12345",
            "trade": "electrical",
            "description": "Wiring overhaul and distribution board setup",
            "agreed_amount": 2500,
            "amount_paid": 500,
            "confirmed": False
        }
        resp_unconf = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer worker-token"},
            json=unconfirmed_payload
        )
        assert resp_unconf.status_code == 400
        assert "confirmed" in resp_unconf.json()["detail"].lower()
        assert len(db.jobs) == 0

        # Voice action unconfirmed readback
        resp_voice_draft = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "tool_name": "create_job",
                "arguments": unconfirmed_payload
            }
        )
        assert resp_voice_draft.status_code == 200
        voice_draft_res = resp_voice_draft.json()
        assert voice_draft_res["success"] is False
        assert voice_draft_res["requires_confirmation"] is True
        assert "Ramesh Verma" in voice_draft_res["readback"]
        assert "2500" in voice_draft_res["readback"]
        assert "500" in voice_draft_res["readback"]
        assert "2000" in voice_draft_res["readback"]
        assert len(db.jobs) == 0

        # 4, 5, 6: Confirmed submission
        confirmed_payload = dict(unconfirmed_payload)
        confirmed_payload["confirmed"] = True

        resp_create = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer worker-token"},
            json=confirmed_payload
        )
        assert resp_create.status_code == 201
        created_job = resp_create.json()
        job_id = created_job["id"]
        assert created_job["customer_name"] == "Ramesh Verma"
        assert created_job["owner_id"] == user_id
        assert float(created_job["agreed_amount"]) == 2500.0
        assert float(created_job["amount_paid"]) == 500.0
        assert float(created_job["remaining_balance"]) == 2000.0
        assert created_job["status"] == "partially_paid"
        assert len(db.jobs) == 1

        # 7. Retrieve saved record & refresh dashboard
        resp_get = client.get(
            f"/api/jobs/{job_id}",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_get.status_code == 200
        fetched_job = resp_get.json()
        assert fetched_job["id"] == job_id
        assert fetched_job["customer_name"] == "Ramesh Verma"

        resp_dash = client.get(
            "/api/dashboard/stats",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_dash.status_code == 200
        dash_stats = resp_dash.json()
        assert dash_stats["total_jobs"] == 1
        assert float(dash_stats["total_agreed"]) == 2500.0
        assert float(dash_stats["total_collected"]) == 500.0
        assert float(dash_stats["total_outstanding"]) == 2000.0
        assert dash_stats["pending_jobs_count"] == 1

    finally:
        app.dependency_overrides.clear()


def test_workflow_b_record_payment_end_to_end():
    """
    Workflow B:
    1. Identify correct saved job.
    2. Ask payment amount, clarify ambiguity.
    3. Read back amount & obtain confirmation.
    4. Persist payment as separate payment event.
    5. Calculate outstanding balance using deterministic backend logic.
    6. Return verified balance & refresh dashboard.
    """
    db = InMemoryLedgerDB()
    user_id = "worker-uuid-wf-b"

    app.dependency_overrides[get_authenticated_user_id] = lambda: user_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Create initial job: ₹3000 agreed, ₹1000 initial payment -> ₹2000 balance
        resp_job = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "customer_name": "Priya Mukherjee",
                "trade": "plumbing",
                "description": "Bathroom pipe installation",
                "agreed_amount": 3000,
                "amount_paid": 1000,
                "confirmed": True
            }
        )
        assert resp_job.status_code == 201
        job_id = resp_job.json()["id"]

        # 2 & 3: Unconfirmed payment rejected
        resp_unconf_pay = client.post(
            f"/api/jobs/{job_id}/payments",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "amount": 800,
                "payment_mode": "upi",
                "confirmed": False
            }
        )
        assert resp_unconf_pay.status_code == 400
        assert "confirmed" in resp_unconf_pay.json()["detail"].lower()

        # 3. Excess payment rejected (Attempting to pay ₹2500 when balance is ₹2000)
        resp_excess = client.post(
            f"/api/jobs/{job_id}/payments",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "amount": 2500,
                "payment_mode": "upi",
                "confirmed": True
            }
        )
        assert resp_excess.status_code == 400
        assert "exceeds" in resp_excess.json()["detail"].lower()

        # 4 & 5: Valid confirmed partial payment (₹1200 via UPI)
        resp_pay = client.post(
            f"/api/jobs/{job_id}/payments",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "amount": 1200,
                "payment_mode": "upi",
                "notes": "Second installment received via PhonePe",
                "confirmed": True
            }
        )
        assert resp_pay.status_code == 201
        pay_data = resp_pay.json()
        assert pay_data["job_id"] == job_id
        assert float(pay_data["amount"]) == 1200.0
        assert float(pay_data["remaining_balance"]) == 800.0  # 2000 - 1200 = 800
        assert len(db.payments) == 1

        # 6. Verify dashboard refreshed with updated KPIs
        resp_dash = client.get(
            "/api/dashboard/stats",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_dash.status_code == 200
        stats = resp_dash.json()
        assert float(stats["total_agreed"]) == 3000.0
        assert float(stats["total_collected"]) == 2200.0  # 1000 + 1200 = 2200
        assert float(stats["total_outstanding"]) == 800.0   # 3000 - 2200 = 800

    finally:
        app.dependency_overrides.clear()


def test_workflow_c_manage_reminders_end_to_end():
    """
    Workflow C:
    1. Collect reminder details and due date.
    2. Read back & obtain confirmation.
    3. Save through FastAPI and Supabase.
    4. Retrieve, display, and complete reminders.
    """
    db = InMemoryLedgerDB()
    user_id = "worker-uuid-wf-c"

    app.dependency_overrides[get_authenticated_user_id] = lambda: user_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Create reminder
        resp_create = client.post(
            "/api/reminders",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "task": "Collect balance ₹800 from Priya Mukherjee",
                "due_date": "2026-10-30",
                "trade": "plumbing",
                "priority": "urgent"
            }
        )
        assert resp_create.status_code == 201
        reminder = resp_create.json()
        rem_id = reminder["id"]
        assert reminder["task"] == "Collect balance ₹800 from Priya Mukherjee"
        assert reminder["is_completed"] is False
        assert reminder["priority"] == "urgent"

        # Retrieve reminders list
        resp_list = client.get(
            "/api/reminders?include_completed=false",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_list.status_code == 200
        reminders_list = resp_list.json()
        assert len(reminders_list) == 1
        assert reminders_list[0]["id"] == rem_id

        # Complete reminder
        resp_toggle = client.patch(
            f"/api/reminders/{rem_id}/toggle",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_toggle.status_code == 200
        toggled = resp_toggle.json()
        assert toggled["is_completed"] is True

        # Verify active reminders list is now empty
        resp_active = client.get(
            "/api/reminders?include_completed=false",
            headers={"Authorization": "Bearer worker-token"}
        )
        assert resp_active.status_code == 200
        assert len(resp_active.json()) == 0

    finally:
        app.dependency_overrides.clear()


def test_workflow_d_ask_ledger_questions_end_to_end():
    """
    Workflow D:
    1. Ask about saved jobs, payments, outstanding balances.
    2. Retrieve authorized records through backend.
    3. Never invent customer records or financial figures.
    """
    db = InMemoryLedgerDB()
    user_id = "worker-uuid-wf-d"

    app.dependency_overrides[get_authenticated_user_id] = lambda: user_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Setup 2 real jobs
        client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "customer_name": "Deepak Roy",
                "trade": "appliance",
                "description": "Refrigerator gas charging",
                "agreed_amount": 1600,
                "amount_paid": 600,
                "confirmed": True
            }
        )
        client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "customer_name": "Sunita Das",
                "trade": "electrical",
                "description": "Geyser wiring repair",
                "agreed_amount": 900,
                "amount_paid": 900,
                "confirmed": True
            }
        )

        # Question 1: Who owes money?
        resp_q1 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "Who owes me udhaar money?"}
            }
        )
        assert resp_q1.status_code == 200
        ans1 = resp_q1.json()["message"]
        assert "Deepak Roy" in ans1
        assert "1000" in ans1  # 1600 - 600 = 1000
        assert "Sunita Das" not in ans1  # Fully paid, not a debtor

        # Question 2: Specific customer query
        resp_q2 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "How much has Deepak Roy paid?"}
            }
        )
        assert resp_q2.status_code == 200
        ans2 = resp_q2.json()["message"]
        assert "1600" in ans2
        assert "600" in ans2
        assert "1000" in ans2

        # Question 3: Total earnings
        resp_q3 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer worker-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "What are my total collected earnings?"}
            }
        )
        assert resp_q3.status_code == 200
        ans3 = resp_q3.json()["message"]
        assert "1500" in ans3  # 600 + 900 = 1500

    finally:
        app.dependency_overrides.clear()


def test_security_auth_boundaries_and_error_handling():
    """
    Error handling and security requirements:
    1. Unauthenticated requests rejected with HTTP 401.
    2. Client-supplied owner_id ignored; derived from Bearer token.
    3. Negative/zero amounts rejected with HTTP 422.
    4. Live Bolna session minting endpoint operates securely.
    """
    # 1. Unauthenticated rejection
    resp_unauth = client.get("/api/jobs")
    assert resp_unauth.status_code == 401
    assert "Authentication required" in resp_unauth.json()["detail"]

    # 2. Client-supplied owner_id in body must NOT override derived token user
    db = InMemoryLedgerDB()
    real_user_id = "real-authenticated-worker"
    app.dependency_overrides[get_authenticated_user_id] = lambda: real_user_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        resp = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "customer_name": "Anil Gupta",
                "trade": "electrical",
                "description": "Switchboard replacement",
                "agreed_amount": 800,
                "amount_paid": 800,
                "confirmed": True,
                "owner_id": "malicious-spoofed-owner-id"
            }
        )
        assert resp.status_code == 201
        created = resp.json()
        assert created["owner_id"] == real_user_id
        assert created["owner_id"] != "malicious-spoofed-owner-id"

        # 3. Invalid non-positive amount
        resp_neg = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "customer_name": "Anil Gupta",
                "trade": "electrical",
                "description": "Switchboard replacement",
                "agreed_amount": -500,
                "amount_paid": 0,
                "confirmed": True
            }
        )
        assert resp_neg.status_code == 422  # Pydantic validation error

        # 4. Live Bolna session endpoint returns live session credentials
        resp_session = client.post("/api/bolna-session", json={})
        assert resp_session.status_code in [200, 502]
        if resp_session.status_code == 200:
            session_data = resp_session.json()
            assert "sip_username" in session_data
            assert "sip_domain" in session_data
            assert "wss_url" in session_data
        else:
            assert "Bolna API" in resp_session.json()["detail"]

    finally:
        app.dependency_overrides.clear()
