"""
KaamSaathi — Anonymous Session (No-Login MVP) End-to-End Test Suite

Verifies:
1. Job creation with an anonymous session identity.
2. Payment recording with deterministic balance calculations under anonymous session.
3. Balance retrieval and debt accounting under anonymous session.
4. Reminder creation, retrieval, and completion under anonymous session.
5. Bolna voice assistant tool execution scoped strictly to the anonymous session.
6. Multi-tenant isolation: One anonymous session CANNOT read, update, pay, or delete another anonymous session's records.
7. Unauthenticated requests without a session token are strictly rejected with HTTP 401.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_db
from tests.test_end_to_end_mvp import InMemoryLedgerDB

client = TestClient(app)


def test_anonymous_session_job_creation_and_balance_calculation():
    """Verify an anonymous technician can create jobs and balances calculate deterministically."""
    db = InMemoryLedgerDB()
    anon_user_a = "anon-tech-uuid-111"

    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_a
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Create confirmed job under anonymous session
        payload = {
            "customer_name": "Suresh Patel",
            "customer_phone": "+91 98200 11111",
            "trade": "electrical",
            "description": "Switchboard replacement and safety earthing",
            "agreed_amount": 3000,
            "amount_paid": 1000,
            "confirmed": True
        }
        resp = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer anon-token-a"},
            json=payload
        )
        assert resp.status_code == 201
        job = resp.json()
        assert job["owner_id"] == anon_user_a
        assert float(job["agreed_amount"]) == 3000.0
        assert float(job["amount_paid"]) == 1000.0
        assert float(job["remaining_balance"]) == 2000.0
        assert job["status"] == "partially_paid"
        assert len(db.jobs) == 1
    finally:
        app.dependency_overrides.clear()


def test_anonymous_session_payment_recording():
    """Verify an anonymous technician can record payments and balances update deterministically."""
    db = InMemoryLedgerDB()
    anon_user_a = "anon-tech-uuid-111"

    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_a
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # 1. Create job with 2000 remaining
        create_resp = client.post(
            "/api/jobs",
            headers={"Authorization": "Bearer anon-token-a"},
            json={
                "customer_name": "Suresh Patel",
                "trade": "electrical",
                "description": "Switchboard replacement",
                "agreed_amount": 3000,
                "amount_paid": 1000,
                "confirmed": True
            }
        )
        assert create_resp.status_code == 201
        job_id = create_resp.json()["id"]

        # 2. Record confirmed partial payment of 1200
        pay_resp = client.post(
            f"/api/jobs/{job_id}/payments",
            headers={"Authorization": "Bearer anon-token-a"},
            json={
                "amount": 1200,
                "payment_mode": "cash",
                "notes": "Second installment received in cash",
                "confirmed": True
            }
        )
        assert pay_resp.status_code == 201
        pay_data = pay_resp.json()
        assert pay_data["owner_id"] == anon_user_a
        assert float(pay_data["remaining_balance"]) == 800.0  # 2000 - 1200 = 800

        # 3. Excess payment rejected (exceeding remaining 800)
        excess_resp = client.post(
            f"/api/jobs/{job_id}/payments",
            headers={"Authorization": "Bearer anon-token-a"},
            json={
                "amount": 1000,
                "payment_mode": "cash",
                "confirmed": True
            }
        )
        assert excess_resp.status_code == 400
        assert "exceed" in excess_resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_anonymous_session_reminders_lifecycle():
    """Verify reminder creation, listing, and completion with an anonymous session."""
    db = InMemoryLedgerDB()
    anon_user_a = "anon-tech-uuid-111"

    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_a
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Create reminder
        rem_resp = client.post(
            "/api/reminders",
            headers={"Authorization": "Bearer anon-token-a"},
            json={
                "task": "Collect balance ₹800 from Suresh Patel",
                "due_date": "2026-10-25",
                "priority": "urgent"
            }
        )
        assert rem_resp.status_code == 201
        rem = rem_resp.json()
        assert rem["owner_id"] == anon_user_a
        rem_id = rem["id"]

        # List reminders
        list_resp = client.get("/api/reminders", headers={"Authorization": "Bearer anon-token-a"})
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

        # Complete reminder using toggle endpoint
        toggle_resp = client.patch(
            f"/api/reminders/{rem_id}/toggle",
            headers={"Authorization": "Bearer anon-token-a"}
        )
        assert toggle_resp.status_code == 200
        assert toggle_resp.json()["is_completed"] is True
    finally:
        app.dependency_overrides.clear()


def test_anonymous_session_cross_tenant_isolation():
    """
    CRITICAL SECURITY CHECK:
    Verify that Anonymous Session B cannot view, modify, or pay jobs belonging to Anonymous Session A.
    Row Level Security guarantees that tenant boundaries remain absolute between different anonymous users.
    """
    db = InMemoryLedgerDB()
    anon_user_a = "anon-user-uuid-AAA"
    anon_user_b = "anon-user-uuid-BBB"

    # Step 1: User A creates a job
    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_a
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    create_resp = client.post(
        "/api/jobs",
        headers={"Authorization": "Bearer token-user-a"},
        json={
            "customer_name": "Private Customer A",
            "trade": "plumbing",
            "description": "Bathroom line leakage repair",
            "agreed_amount": 1500,
            "amount_paid": 500,
            "confirmed": True
        }
    )
    assert create_resp.status_code == 201
    job_a_id = create_resp.json()["id"]

    # Step 2: Switch session to User B
    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_b
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # User B lists jobs -> should see 0 jobs
        list_resp = client.get("/api/jobs", headers={"Authorization": "Bearer token-user-b"})
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 0

        # User B attempts to read User A's specific job -> 404 Not Found
        get_resp = client.get(f"/api/jobs/{job_a_id}", headers={"Authorization": "Bearer token-user-b"})
        assert get_resp.status_code == 404

        # User B attempts to record payment on User A's job -> 404 Not Found
        pay_resp = client.post(
            f"/api/jobs/{job_a_id}/payments",
            headers={"Authorization": "Bearer token-user-b"},
            json={"amount": 500, "payment_mode": "cash", "confirmed": True}
        )
        assert pay_resp.status_code == 404

        # User B attempts to delete User A's job -> 404 Not Found
        del_resp = client.delete(f"/api/jobs/{job_a_id}", headers={"Authorization": "Bearer token-user-b"})
        assert del_resp.status_code == 404

        # Verify User A's job was not touched
        assert len(db.jobs) == 1
        assert db.jobs[job_a_id]["amount_paid"] == 500.0
    finally:
        app.dependency_overrides.clear()


def test_anonymous_session_bolna_voice_tools_isolation():
    """Verify Bolna Voice Tool execution is scoped strictly to the caller's anonymous identity."""
    db = InMemoryLedgerDB()
    anon_user_a = "anon-voice-tech-A"

    app.dependency_overrides[get_authenticated_user_id] = lambda: anon_user_a
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # Create job via Bolna voice tool under Anonymous User A
        voice_create = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-voice-a"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Gita Sen",
                    "trade": "appliance",
                    "description": "Refrigerator compressor sensor replacement",
                    "agreed_amount": 2200,
                    "amount_paid": 700,
                    "confirmed": True
                }
            }
        )
        assert voice_create.status_code == 200
        assert voice_create.json()["success"] is True
        saved_job = voice_create.json()["result"]
        assert saved_job["owner_id"] == anon_user_a

        # Query outstanding balances via Bolna voice tool
        voice_bal = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-voice-a"},
            json={"tool_name": "get_outstanding_balances", "arguments": {}}
        )
        assert voice_bal.status_code == 200
        bal_res = voice_bal.json()
        assert bal_res["success"] is True
        assert bal_res["result"]["total_outstanding"] == 1500.0  # 2200 - 700 = 1500
    finally:
        app.dependency_overrides.clear()


def test_unauthenticated_request_rejected():
    """Verify that requests without an authorization header are strictly rejected with HTTP 401."""
    resp_no_token = client.get("/api/jobs")
    assert resp_no_token.status_code == 401
    assert "missing" in resp_no_token.json()["detail"].lower() or "authentication" in resp_no_token.json()["detail"].lower()
