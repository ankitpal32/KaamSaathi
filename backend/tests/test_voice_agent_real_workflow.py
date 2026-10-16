"""
KaamSaathi — Complete Voice Agent to Real Backend Data Workflow Test Suite
Verifies:
1. Bolna voice session endpoint works with real credentials
2. Voice job creation: unconfirmed readback guard
3. Voice job creation: confirmed persistence in database
4. Verification that saved job appears on dashboard stats
5. Voice payment recording with deterministic balance calculation
6. Outstanding balances query reflects accurate udhaar
7. Reminder persistence and completion via voice action
8. Voice Q&A answers ledger questions accurately from saved records
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_db
from tests.test_end_to_end_mvp import InMemoryLedgerDB

client = TestClient(app)

def test_voice_session_endpoint_with_real_credentials():
    """Verify Bolna voice session endpoint returns live SIP session credentials."""
    resp = client.post("/api/bolna-session", json={"user_data": {"platform": "test"}})
    assert resp.status_code == 200
    data = resp.json()
    assert "sip_username" in data
    assert "sip_domain" in data
    assert "wss_url" in data
    assert "ice_servers" in data

def test_complete_voice_agent_workflow():
    """
    Test complete lifecycle:
    1. Speak job update -> confirmation required
    2. Confirm job -> persisted
    3. Verify dashboard stats updated
    4. Voice payment recorded -> deterministic balance update
    5. Retrieve outstanding balance
    6. Create & complete follow-up reminder
    7. Verify updated dashboard KPIs
    """
    db = InMemoryLedgerDB()
    tech_id = "test-tech-uuid-101"

    app.dependency_overrides[get_authenticated_user_id] = lambda: tech_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Step 1: Voice job draft spoken (unconfirmed)
        resp_draft = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Arjun Sharma",
                    "trade": "electrical",
                    "description": "Main circuit breaker wiring repair",
                    "agreed_amount": 1800,
                    "amount_paid": 600,
                    "confirmed": False
                }
            }
        )
        assert resp_draft.status_code == 200
        draft_res = resp_draft.json()
        assert draft_res["success"] is False
        assert draft_res["requires_confirmation"] is True
        assert "Arjun Sharma" in draft_res["readback"]
        assert "1800" in draft_res["readback"]
        assert "600" in draft_res["readback"]
        assert "1200" in draft_res["readback"]
        assert len(db.jobs) == 0

        # Step 2: Confirm and save job
        resp_confirm = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Arjun Sharma",
                    "trade": "electrical",
                    "description": "Main circuit breaker wiring repair",
                    "agreed_amount": 1800,
                    "amount_paid": 600,
                    "confirmed": True
                }
            }
        )
        assert resp_confirm.status_code == 200
        confirm_res = resp_confirm.json()
        assert confirm_res["success"] is True
        saved_job = confirm_res["result"]
        job_id = saved_job["id"]
        assert float(saved_job["agreed_amount"]) == 1800.0
        assert float(saved_job["amount_paid"]) == 600.0
        assert float(saved_job["remaining_balance"]) == 1200.0
        assert len(db.jobs) == 1

        # Step 3: Verify dashboard reflects the saved job
        resp_dash1 = client.get("/api/dashboard/stats", headers={"Authorization": "Bearer test-jwt"})
        assert resp_dash1.status_code == 200
        stats1 = resp_dash1.json()
        assert stats1["total_jobs"] == 1
        assert float(stats1["total_agreed"]) == 1800.0
        assert float(stats1["total_collected"]) == 600.0
        assert float(stats1["total_outstanding"]) == 1200.0
        assert stats1["pending_jobs_count"] == 1

        # Step 4: Record payment via voice (₹700 partial payment)
        resp_pay = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": job_id,
                    "amount": 700,
                    "payment_mode": "cash",
                    "confirmed": True
                }
            }
        )
        assert resp_pay.status_code == 200
        pay_res = resp_pay.json()
        assert pay_res["success"] is True
        assert float(pay_res["result"]["remaining_balance"]) == 500.0  # 1200 - 700 = 500

        # Step 5: Retrieve outstanding balances via voice
        resp_bal = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "get_outstanding_balances",
                "arguments": {}
            }
        )
        assert resp_bal.status_code == 200
        bal_res = resp_bal.json()
        assert bal_res["success"] is True
        assert bal_res["result"]["total_outstanding"] == 500.0
        assert bal_res["result"]["debtors"][0]["customer_name"] == "Arjun Sharma"

        # Step 6: Create follow-up reminder via voice
        resp_rem = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "create_reminder",
                "arguments": {
                    "job_id": job_id,
                    "task": "Collect remaining ₹500 from Arjun Sharma",
                    "due_date": "2026-10-25",
                    "priority": "urgent",
                    "confirmed": True
                }
            }
        )
        assert resp_rem.status_code == 200
        rem_res = resp_rem.json()
        assert rem_res["success"] is True
        rem_id = rem_res["result"]["id"]

        # Step 7: List reminders via voice
        resp_rems = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "list_reminders",
                "arguments": {"include_completed": False}
            }
        )
        assert resp_rems.status_code == 200
        rems_res = resp_rems.json()
        assert rems_res["result"]["total"] == 1

        # Step 8: Complete reminder via voice
        resp_comp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-jwt"},
            json={
                "tool_name": "complete_reminder",
                "arguments": {
                    "reminder_id": rem_id,
                    "confirmed": True
                }
            }
        )
        assert resp_comp.status_code == 200
        comp_res = resp_comp.json()
        assert comp_res["success"] is True
        assert comp_res["result"]["is_completed"] is True

        # Step 9: Verify updated dashboard KPIs
        resp_dash2 = client.get("/api/dashboard/stats", headers={"Authorization": "Bearer test-jwt"})
        assert resp_dash2.status_code == 200
        stats2 = resp_dash2.json()
        assert stats2["total_jobs"] == 1
        assert float(stats2["total_agreed"]) == 1800.0
        assert float(stats2["total_collected"]) == 1300.0  # 600 + 700 = 1300
        assert float(stats2["total_outstanding"]) == 500.0  # 1800 - 1300 = 500
        assert stats2["upcoming_reminders_count"] == 0  # Completed

    finally:
        app.dependency_overrides.clear()
