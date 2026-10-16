import pytest
from unittest.mock import MagicMock
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.services.bolna_tools import BolnaToolExecutor
from app.schemas import PaymentMode, TradeType

client = TestClient(app)

class MockQuery:
    def __init__(self, data=None, error=None):
        self._data = data if data is not None else []
        self._error = error

    def select(self, *args, **kwargs):
        return self

    def eq(self, field, value):
        return self

    def order(self, *args, **kwargs):
        return self

    def insert(self, payload):
        if self._error:
            raise self._error
        row = dict(payload)
        row["id"] = "mock-gen-uuid"
        row["created_at"] = "2026-10-16T10:00:00Z"
        self._data = [row]
        return self

    def update(self, payload):
        if self._error:
            raise self._error
        self._data = [dict(payload)]
        return self

    def delete(self):
        if self._error:
            raise self._error
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
# 1. record_payment Workflow Tests
# ==============================================================================

def test_bolna_record_payment_unauthenticated():
    """Unauthenticated payment recording via voice tool must return 401."""
    resp = client.post(
        "/api/bolna/tools/execute",
        json={
            "tool_name": "record_payment",
            "arguments": {
                "job_id": "job-101",
                "amount": 500,
                "payment_mode": "cash",
                "confirmed": True
            }
        }
    )
    assert resp.status_code == 401

def test_bolna_record_payment_requires_verbal_confirmation():
    """Unconfirmed payment recording generates readback and does NOT mutate balance."""
    mock_db = MagicMock()
    job_row = {
        "id": "job-101",
        "owner_id": "tech-1",
        "customer_name": "Ramesh Sen",
        "agreed_amount": 1500.0,
        "amount_paid": 500.0,
        "remaining_balance": 1000.0,
        "status": "partially_paid"
    }
    
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_res = MagicMock()
    mock_res.data = [job_row]
    mock_query.execute.return_value = mock_res
    mock_db.table.return_value = mock_query

    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": "job-101",
                    "amount": 500,
                    "payment_mode": "upi",
                    "confirmed": False
                }
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["requires_confirmation"] is True
        assert "Ramesh Sen" in data["readback"]
        assert "500" in data["readback"]
        assert "UPI" in data["readback"]
        assert "New balance will be ₹500" in data["readback"] or "500" in data["readback"]
        # No insert into payment_events should have happened
        mock_query.insert.assert_not_called()
    finally:
        app.dependency_overrides.clear()

def test_bolna_record_payment_excess_rejected():
    """Payment exceeding outstanding balance must be rejected."""
    mock_db = MagicMock()
    job_row = {
        "id": "job-101",
        "owner_id": "tech-1",
        "customer_name": "Ramesh Sen",
        "agreed_amount": 1000.0,
        "amount_paid": 800.0,
        "remaining_balance": 200.0,
        "status": "partially_paid"
    }
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_res = MagicMock()
    mock_res.data = [job_row]
    mock_query.execute.return_value = mock_res
    mock_db.table.return_value = mock_query

    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": "job-101",
                    "amount": 500,  # Exceeds 200 balance
                    "payment_mode": "cash",
                    "confirmed": True
                }
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "exceeds outstanding balance" in data["message"]
    finally:
        app.dependency_overrides.clear()

def test_bolna_record_payment_invalid_amount_or_job():
    """Rejects missing job_id or negative/zero amounts."""
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Zero amount
        resp1 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": "job-1",
                    "amount": 0,
                    "confirmed": True
                }
            }
        )
        assert resp1.json()["success"] is False
        assert "positive payment amount" in resp1.json()["message"]

        # Missing job_id
        resp2 = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": "",
                    "amount": 200,
                    "confirmed": True
                }
            }
        )
        assert resp2.json()["success"] is False
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 2. get_outstanding_balances Workflow Tests
# ==============================================================================

def test_bolna_get_outstanding_balances_workflow():
    """Calculates total outstanding debts accurately across jobs."""
    jobs_data = [
        {"id": "j1", "owner_id": "tech-1", "customer_name": "Anil Roy", "agreed_amount": 2000.0, "amount_paid": 500.0, "remaining_balance": 1500.0, "status": "partially_paid"},
        {"id": "j2", "owner_id": "tech-1", "customer_name": "Priya Sen", "agreed_amount": 800.0, "amount_paid": 800.0, "remaining_balance": 0.0, "status": "completed"},
        {"id": "j3", "owner_id": "tech-1", "customer_name": "Anil Roy", "agreed_amount": 1000.0, "amount_paid": 0.0, "remaining_balance": 1000.0, "status": "pending"},
    ]
    
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_res = MagicMock()
    mock_res.data = jobs_data
    mock_query.execute.return_value = mock_res
    mock_db.table.return_value = mock_query

    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # All outstanding debts
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "get_outstanding_balances",
                "arguments": {}
            }
        )
        assert resp.status_code == 200
        res = resp.json()
        assert res["success"] is True
        assert res["result"]["total_outstanding"] == 2500.0
        assert len(res["result"]["debtors"]) == 2

        # Filter by customer name 'Anil'
        resp_filtered = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "get_outstanding_balances",
                "arguments": {"customer_name": "Anil"}
            }
        )
        assert resp_filtered.status_code == 200
        res_filt = resp_filtered.json()
        assert res_filt["success"] is True
        assert len(res_filt["result"]["debtors"]) == 2
        assert res_filt["result"]["total_outstanding"] == 2500.0

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 3. create_reminder Workflow Tests
# ==============================================================================

def test_bolna_create_reminder_workflow():
    """Tests reminder confirmation guard and valid scheduling."""
    mock_db = make_mock_client()
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # Unconfirmed reminder returns readback
        resp_unconf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "create_reminder",
                "arguments": {
                    "task": "Test capacitor voltage for AC",
                    "due_date": "2026-10-25",
                    "priority": "urgent",
                    "confirmed": False
                }
            }
        )
        assert resp_unconf.status_code == 200
        assert resp_unconf.json()["requires_confirmation"] is True
        assert "2026-10-25" in resp_unconf.json()["readback"]
        assert "urgent" in resp_unconf.json()["readback"]

        # Missing task or date
        resp_missing = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "create_reminder",
                "arguments": {
                    "task": "",
                    "due_date": "2026-10-25",
                    "confirmed": True
                }
            }
        )
        assert resp_missing.json()["success"] is False

    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 4. list_jobs Workflow Tests
# ==============================================================================

def test_bolna_list_jobs_workflow():
    """Lists technician jobs with optional status filter."""
    jobs_data = [
        {"id": "j1", "owner_id": "tech-1", "customer_name": "A", "agreed_amount": 1000.0, "amount_paid": 500.0, "remaining_balance": 500.0, "status": "partially_paid"},
        {"id": "j2", "owner_id": "tech-1", "customer_name": "B", "agreed_amount": 500.0, "amount_paid": 500.0, "remaining_balance": 0.0, "status": "completed"},
    ]
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_res = MagicMock()
    mock_res.data = jobs_data
    mock_query.execute.return_value = mock_res
    mock_db.table.return_value = mock_query

    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "list_jobs",
                "arguments": {"status": "partially_paid"}
            }
        )
        assert resp.status_code == 200
        res = resp.json()
        assert res["success"] is True
        assert res["result"]["total"] == 1
        assert res["result"]["jobs"][0]["id"] == "j1"
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 5. list_reminders Workflow Tests
# ==============================================================================

def test_bolna_list_reminders_workflow():
    """Lists technician reminders correctly."""
    rems_data = [
        {"id": "r1", "owner_id": "tech-1", "task": "Check capacitor", "due_date": "2026-10-25", "is_completed": False},
        {"id": "r2", "owner_id": "tech-1", "task": "Collect balance", "due_date": "2026-10-26", "is_completed": True},
    ]
    mock_db = make_mock_client(data=rems_data)
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        resp = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "list_reminders",
                "arguments": {"include_completed": True}
            }
        )
        assert resp.status_code == 200
        res = resp.json()
        assert res["success"] is True
        assert res["result"]["total"] == 2
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 6. correct_record Workflow Tests
# ==============================================================================

def test_bolna_correct_record_workflow():
    """Requires confirmation before applying record correction; verifies execution."""
    job_row = {
        "id": "job-1",
        "owner_id": "tech-1",
        "customer_name": "Old Name",
        "description": "Wiring",
        "agreed_amount": 1000.0,
        "amount_paid": 500.0,
        "remaining_balance": 500.0,
        "status": "partially_paid"
    }
    mock_db = make_mock_client(data=[job_row])
    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_db

    try:
        # 1. Unconfirmed correction returns readback
        resp_unconf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "correct_record",
                "arguments": {
                    "entity_type": "job",
                    "entity_id": "job-1",
                    "field_name": "customer_name",
                    "new_value": "New Corrected Name",
                    "confirmed": False
                }
            }
        )
        assert resp_unconf.status_code == 200
        data_unconf = resp_unconf.json()
        assert data_unconf["requires_confirmation"] is True
        assert "New Corrected Name" in data_unconf["readback"]

        # 2. Confirmed correction executes update
        resp_conf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "correct_record",
                "arguments": {
                    "entity_type": "job",
                    "entity_id": "job-1",
                    "field_name": "customer_name",
                    "new_value": "New Corrected Name",
                    "confirmed": True
                }
            }
        )
        assert resp_conf.status_code == 200
        data_conf = resp_conf.json()
        assert data_conf["success"] is True
        assert "customer_name set to New Corrected Name" in data_conf["message"]
    finally:
        app.dependency_overrides.clear()

# ==============================================================================
# 7. answer_ledger_question Workflow Tests
# ==============================================================================

def test_bolna_answer_ledger_question_workflows():
    """Answers technician questions using saved jobs and payment records."""
    jobs_data = [
        {
            "id": "j1",
            "owner_id": "tech-1",
            "customer_name": "Ramesh Sen",
            "trade": "electrical",
            "description": "Fan repair",
            "agreed_amount": 1200.0,
            "amount_paid": 500.0,
            "remaining_balance": 700.0,
            "status": "partially_paid"
        },
        {
            "id": "j2",
            "owner_id": "tech-1",
            "customer_name": "Amit Sharma",
            "trade": "plumbing",
            "description": "Pipe fix",
            "agreed_amount": 800.0,
            "amount_paid": 800.0,
            "remaining_balance": 0.0,
            "status": "completed"
        }
    ]
    rems_data = [
        {
            "id": "r1",
            "owner_id": "tech-1",
            "task": "Collect ₹700 from Ramesh",
            "due_date": "2026-10-20",
            "is_completed": False
        }
    ]

    mock_client = MagicMock()
    jobs_mock = MockQuery(data=jobs_data)
    rems_mock = MockQuery(data=rems_data)
    mock_client.table.side_effect = lambda name: jobs_mock if name == "jobs" else rems_mock

    app.dependency_overrides[get_authenticated_user_id] = lambda: "tech-1"
    app.dependency_overrides[get_user_scoped_db] = lambda: mock_client

    try:
        # A. Customer specific inquiry
        resp_cust = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "How much did Ramesh Sen pay?"}
            }
        )
        assert resp_cust.status_code == 200
        res_cust = resp_cust.json()
        assert res_cust["success"] is True
        assert "Ramesh Sen" in res_cust["message"]
        assert "500" in res_cust["message"]
        assert "700" in res_cust["message"]

        # B. Udhaar / Debt inquiry
        resp_debt = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "Who owes me udhaar money?"}
            }
        )
        assert resp_debt.status_code == 200
        res_debt = resp_debt.json()
        assert res_debt["success"] is True
        assert "700" in res_debt["message"]
        assert "Ramesh Sen" in res_debt["message"]

        # C. Follow-up Reminders inquiry
        resp_rem = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "What are my upcoming reminders?"}
            }
        )
        assert resp_rem.status_code == 200
        res_rem = resp_rem.json()
        assert res_rem["success"] is True
        assert "Collect ₹700" in res_rem["message"]

        # D. Earnings inquiry
        resp_earn = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "How much have I earned today?"}
            }
        )
        assert resp_earn.status_code == 200
        res_earn = resp_earn.json()
        assert res_earn["success"] is True
        assert "1300" in res_earn["message"]  # 500 + 800

        # E. Empty question rejected
        resp_empty = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": ""}
            }
        )
        assert resp_empty.status_code == 200
        assert resp_empty.json()["success"] is False
    finally:
        app.dependency_overrides.clear()

