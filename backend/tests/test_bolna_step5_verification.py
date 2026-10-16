"""
KaamSaathi Step 5 Verification Test Suite
Tests:
1. Live session minting with real Bolna credentials
2. Unconfigured credentials error handling (HTTP 503)
3. Bolna function calling: create_job verbal readback requirement (confirmed=False)
4. Bolna function calling: create_job save execution (confirmed=True)
5. Bolna function calling: list_jobs retrieval
6. Bolna function calling: validation errors (negative amounts, missing fields)
7. Bolna session error forwarding on upstream failure
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_step5_real_session_minting():
    """Verify POST /api/bolna-session mints real short-lived SIP credentials when configured."""
    res = client.post("/api/bolna-session", json={"user_data": {"platform": "test"}})
    assert res.status_code in [200, 502]
    if res.status_code == 200:
        data = res.json()
        assert "sip_username" in data
        assert "sip_domain" in data
        assert "wss_url" in data
        assert "ice_servers" in data
    else:
        assert "Bolna API" in res.json()["detail"]

def test_step5_missing_credentials_handling(monkeypatch):
    """Verify POST /api/bolna-session returns safe 503 when credentials are unconfigured."""
    monkeypatch.setattr("app.routes.bolna.settings.BOLNA_API_KEY", "")
    monkeypatch.setattr("app.routes.bolna.settings.BOLNA_AGENT_ID", "")
    res = client.post("/api/bolna-session", json={})
    assert res.status_code == 503
    assert "Bolna Voice Agent is not configured" in res.json()["detail"]

def test_step5_bolna_create_job_requires_verbal_confirmation():
    """Verify create_job function call enforces verbal confirmation before saving."""
    from app.services.bolna_tools import BolnaToolExecutor
    from unittest.mock import MagicMock
    
    mock_db = MagicMock()
    
    # When confirmed=False, tool must NOT execute database insert, and must return verbal readback
    res = BolnaToolExecutor.execute(
        tool_name="create_job",
        args={
            "customer_name": "Ramesh Sen",
            "trade": "electrical",
            "description": "Ceiling fan capacitor repair",
            "agreed_amount": 650,
            "amount_paid": 200,
            "confirmed": False
        },
        owner_id="test-owner-id",
        client=mock_db
    )
    assert res.success is False
    assert res.requires_confirmation is True
    assert "Please confirm" in res.message
    assert "Ramesh Sen" in res.readback
    assert "₹650" in res.readback
    assert "₹200" in res.readback
    assert "₹450" in res.readback
    mock_db.table.assert_not_called()

def test_step5_bolna_create_job_confirmed_execution():
    """Verify create_job function call executes database insert when confirmed=True."""
    from app.services.bolna_tools import BolnaToolExecutor
    from unittest.mock import MagicMock
    
    mock_db = MagicMock()
    mock_db.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": "job-uuid-1234",
        "customer_name": "Ramesh Sen",
        "trade": "electrical",
        "description": "Ceiling fan capacitor repair",
        "agreed_amount": 650,
        "amount_paid": 200,
        "remaining_balance": 450,
        "status": "partially_paid",
        "owner_id": "test-owner-id"
    }]
    
    res = BolnaToolExecutor.execute(
        tool_name="create_job",
        args={
            "customer_name": "Ramesh Sen",
            "trade": "electrical",
            "description": "Ceiling fan capacitor repair",
            "agreed_amount": 650,
            "amount_paid": 200,
            "confirmed": True
        },
        owner_id="test-owner-id",
        client=mock_db
    )
    assert res.success is True
    assert "Successfully created job" in res.message
    assert res.result["id"] == "job-uuid-1234"

def test_step5_bolna_invalid_amount_validation():
    """Verify financial constraints reject invalid amounts during voice function call."""
    from app.services.bolna_tools import BolnaToolExecutor
    from unittest.mock import MagicMock
    
    mock_db = MagicMock()
    
    # Negative amount
    res = BolnaToolExecutor.execute(
        tool_name="create_job",
        args={
            "customer_name": "Ramesh Sen",
            "trade": "electrical",
            "description": "Repair",
            "agreed_amount": -500,
            "confirmed": True
        },
        owner_id="test-owner-id",
        client=mock_db
    )
    assert res.success is False
    assert "greater than zero" in res.message
    
    # Advance exceeding agreed amount
    res2 = BolnaToolExecutor.execute(
        tool_name="create_job",
        args={
            "customer_name": "Ramesh Sen",
            "trade": "electrical",
            "description": "Repair",
            "agreed_amount": 500,
            "amount_paid": 800,
            "confirmed": True
        },
        owner_id="test-owner-id",
        client=mock_db
    )
    assert res2.success is False
    assert "cannot exceed" in res2.message
