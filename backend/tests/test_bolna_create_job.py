import pytest
from unittest.mock import MagicMock
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_client, get_user_scoped_db
from app.services.bolna_tools import BolnaToolExecutor, BOLNA_FUNCTION_CONTRACTS, get_bolna_custom_tasks
from app.schemas import JobStatus

client = TestClient(app)

class MockQuery:
    def __init__(self, data=None, error=None):
        self._data = data if data is not None else []
        self._error = error

    def select(self, *args, **kwargs):
        return self

    def insert(self, payload):
        if self._error:
            raise self._error
        # Simulate Supabase returning inserted row with generated ID and balances
        row = dict(payload)
        row["id"] = "job-uuid-12345"
        agreed = Decimal(str(row.get("agreed_amount", 0)))
        paid = Decimal(str(row.get("amount_paid", 0)))
        row["remaining_balance"] = float(max(Decimal("0.00"), agreed - paid))
        self._data = [row]
        return self

    def execute(self):
        if self._error:
            raise self._error
        mock_res = MagicMock()
        mock_res.data = self._data
        return mock_res

def make_mock_client(data=None, error=None):
    mock = MagicMock()
    mock.table.return_value = MockQuery(data=data, error=error)
    return mock

# ==============================================================================
# 1. Unauthenticated Request & Security Tests
# ==============================================================================

def test_bolna_create_job_unauthenticated():
    """Unauthenticated execution requests must be rejected with 401 Unauthorized."""
    resp = client.post(
        "/api/bolna/tools/execute",
        json={
            "tool_name": "create_job",
            "arguments": {
                "customer_name": "Amit Sen",
                "trade": "electrical",
                "description": "Ceiling fan installation",
                "agreed_amount": 1200,
                "confirmed": True
            }
        }
    )
    assert resp.status_code == 401
    assert "Authentication required" in resp.json()["detail"]

# ==============================================================================
# 2. Verbal Confirmation Guard & User Cancellation
# ==============================================================================

def test_bolna_create_job_requires_verbal_confirmation():
    """
    When confirmed is False, create_job must NOT save to the ledger.
    It must return a clear readback asking for technician confirmation.
    """
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Suman Ghosh",
                    "trade": "electrical",
                    "description": "Wiring repair in kitchen",
                    "agreed_amount": 1500,
                    "amount_paid": 500,
                    "confirmed": False
                }
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["requires_confirmation"] is True
        assert "Suman Ghosh" in data["readback"]
        assert "₹1500" in data["readback"] or "1500" in data["readback"]
        assert "₹1000" in data["readback"] or "1000" in data["readback"]  # Balance
        assert "Please confirm" in data["message"]
        # Ensure database table insert was NEVER called
        mock_db.table.assert_not_called()
    finally:
        app.dependency_overrides.clear()

def test_bolna_create_job_user_cancellation():
    """
    If technician cancels/denies confirmation, job is aborted and not saved.
    """
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # User explicitly passes confirmed=False or omits it
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Ramesh Kumar",
                    "trade": "plumbing",
                    "description": "Pipe leakage fixing",
                    "agreed_amount": 800,
                    "confirmed": False
                }
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["requires_confirmation"] is True
        # Ledger is untouched
        mock_db.table.assert_not_called()
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 3. Ambiguous, Missing, or Invalid Amounts
# ==============================================================================

def test_bolna_create_job_ambiguous_or_missing_amounts():
    """
    Rejects zero, negative, non-numeric, or missing agreed amounts with clear messages.
    """
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Zero amount
        resp1 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Pooja Das",
                    "trade": "appliance",
                    "description": "Microwave repair",
                    "agreed_amount": 0,
                    "confirmed": True
                }
            }
        )
        assert resp1.status_code == 200
        assert resp1.json()["success"] is False
        assert "greater than zero" in resp1.json()["message"]

        # Negative amount
        resp2 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Pooja Das",
                    "trade": "appliance",
                    "description": "Microwave repair",
                    "agreed_amount": -400,
                    "confirmed": True
                }
            }
        )
        assert resp2.status_code == 200
        assert resp2.json()["success"] is False
        assert "greater than zero" in resp2.json()["message"]

        # Non-numeric amount string
        resp3 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Pooja Das",
                    "trade": "appliance",
                    "description": "Microwave repair",
                    "agreed_amount": "not_a_number",
                    "confirmed": True
                }
            }
        )
        assert resp3.status_code == 200
        assert resp3.json()["success"] is False
        assert "valid number" in resp3.json()["message"]

        # Negative paid amount
        resp4 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Pooja Das",
                    "trade": "appliance",
                    "description": "Microwave repair",
                    "agreed_amount": 1000,
                    "amount_paid": -100,
                    "confirmed": True
                }
            }
        )
        assert resp4.status_code == 200
        assert resp4.json()["success"] is False
        assert "cannot be negative" in resp4.json()["message"]

        # Excess advance payment
        resp5 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Pooja Das",
                    "trade": "appliance",
                    "description": "Microwave repair",
                    "agreed_amount": 1000,
                    "amount_paid": 1500,
                    "confirmed": True
                }
            }
        )
        assert resp5.status_code == 200
        assert resp5.json()["success"] is False
        assert "cannot exceed agreed" in resp5.json()["message"]

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 4. Missing Customer Name or Description
# ==============================================================================

def test_bolna_create_job_missing_required_fields():
    """Customer name and description must be present and non-empty."""
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Empty customer name
        resp1 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "   ",
                    "description": "Fan service",
                    "agreed_amount": 500,
                    "confirmed": True
                }
            }
        )
        assert resp1.status_code == 200
        assert resp1.json()["success"] is False
        assert "customer_name is required" in resp1.json()["message"]

        # Empty description
        resp2 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Rahul Verma",
                    "description": "   ",
                    "agreed_amount": 500,
                    "confirmed": True
                }
            }
        )
        assert resp2.status_code == 200
        assert resp2.json()["success"] is False
        assert "description is required" in resp2.json()["message"]

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 5. Status Validation
# ==============================================================================

def test_bolna_create_job_status_validation():
    """Validates job status and rejects unrecognized statuses."""
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Invalid status
        resp_invalid = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Bikash Roy",
                    "trade": "electrical",
                    "description": "Submeter installation",
                    "agreed_amount": 2200,
                    "status": "cancelled",
                    "confirmed": True
                }
            }
        )
        assert resp_invalid.status_code == 200
        assert resp_invalid.json()["success"] is False
        assert "Invalid job status" in resp_invalid.json()["message"]

        # Valid status (in_progress)
        resp_valid = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Bikash Roy",
                    "trade": "electrical",
                    "description": "Submeter installation",
                    "agreed_amount": 2200,
                    "status": "in_progress",
                    "confirmed": True
                }
            }
        )
        assert resp_valid.status_code == 200
        assert resp_valid.json()["success"] is True
        assert resp_valid.json()["result"]["status"] == "in_progress"

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 6. User Corrections Workflow
# ==============================================================================

def test_bolna_create_job_user_corrections():
    """
    Technician flow:
    1. Technician provides draft details. System asks for confirmation with readback.
    2. Technician notices amount was incorrect and updates it with confirmed=True.
    3. System validates corrected amount and persists accurately.
    """
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Step 1: Draft with wrong amount (technician said 800)
        resp1 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Subhashish Sen",
                    "trade": "appliance",
                    "description": "AC compressor capacitor change",
                    "agreed_amount": 800,
                    "confirmed": False
                }
            }
        )
        assert resp1.json()["requires_confirmation"] is True
        assert "₹800" in resp1.json()["readback"] or "800" in resp1.json()["readback"]

        # Step 2: Technician corrects to ₹1800 with confirmed=True
        resp2 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Subhashish Sen",
                    "trade": "appliance",
                    "description": "AC compressor capacitor change",
                    "agreed_amount": 1800,
                    "amount_paid": 500,
                    "confirmed": True
                }
            }
        )
        assert resp2.status_code == 200
        res = resp2.json()
        assert res["success"] is True
        assert "Subhashish Sen" in res["message"]
        assert res["result"]["agreed_amount"] == 1800.0
        assert res["result"]["remaining_balance"] == 1300.0

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 7. Repeated Submissions (Idempotent Handling)
# ==============================================================================

def test_bolna_create_job_repeated_submission():
    """
    Submitting job details twice executes deterministically without crashing.
    """
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        payload = {
            "tool_name": "create_job",
            "arguments": {
                "customer_name": "Deepak Sharma",
                "trade": "plumbing",
                "description": "Water motor pump servicing",
                "agreed_amount": 2500,
                "amount_paid": 2500,
                "confirmed": True
            }
        }
        resp1 = client.post("/api/bolna/tools/execute", headers={"Authorization": "Bearer test-token"}, json=payload)
        resp2 = client.post("/api/bolna/tools/execute", headers={"Authorization": "Bearer test-token"}, json=payload)

        assert resp1.status_code == 200
        assert resp1.json()["success"] is True
        assert resp2.status_code == 200
        assert resp2.json()["success"] is True
        assert resp2.json()["result"]["remaining_balance"] == 0.0
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 8. Database Request Failure Guard (Never Claim Success on Failure)
# ==============================================================================

def test_bolna_create_job_failed_database_request():
    """
    If Supabase raises an exception, the system must report failure.
    It must NEVER claim that the job was saved.
    """
    mock_db = make_mock_client(error=Exception("Connection to PostgreSQL pool timed out"))
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-user-111"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer test-token"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Ananya Chatterjee",
                    "trade": "electrical",
                    "description": "Fuse box replacement",
                    "agreed_amount": 1600,
                    "confirmed": True
                }
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "Database error" in data["message"] or "failed" in data["message"].lower()
        assert data["result"] is None
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 9. Bolna Tools Schema Contract & Custom Tasks Export
# ==============================================================================

def test_bolna_tools_schema_endpoints():
    """Tests GET /api/bolna/tools returning OpenAI and Bolna Custom Task formats."""
    # Test all
    resp_all = client.get("/api/bolna/tools")
    assert resp_all.status_code == 200
    data_all = resp_all.json()
    assert "tools" in data_all
    assert "custom_tasks" in data_all
    assert len(data_all["tools"]) >= 8
    assert len(data_all["custom_tasks"]) >= 8

    # Verify create_job schema parameters
    cj_tool = next(t for t in data_all["tools"] if t["name"] == "create_job")
    assert "customer_name" in cj_tool["parameters"]["properties"]
    assert "agreed_amount" in cj_tool["parameters"]["properties"]
    assert "status" in cj_tool["parameters"]["properties"]
    assert "confirmed" in cj_tool["parameters"]["properties"]

    # Verify Bolna custom task structure
    cj_task = next(t for t in data_all["custom_tasks"] if t["name"] == "create_job")
    assert cj_task["key"] == "custom_task"
    assert cj_task["value"]["method"] == "POST"
    assert "/api/bolna/tools/execute" in cj_task["value"]["url"]

    # Test format query filters
    resp_openai = client.get("/api/bolna/tools?format=openai")
    assert "tools" in resp_openai.json()
    assert "custom_tasks" not in resp_openai.json()

    resp_task = client.get("/api/bolna/tools?format=bolna_task")
    assert "tasks" in resp_task.json()
