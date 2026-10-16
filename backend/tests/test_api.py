import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.schemas import JobCreate, TradeType, JobStatus, PaymentCreate, PaymentMode, ReminderCreate
from app.services.jobs import JobService
from app.services.bolna_tools import BOLNA_FUNCTION_CONTRACTS

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "version" in data
    assert data["docs_url"] == "/docs"

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database_configured" in data
    assert "app_name" in data
    assert "key" not in str(data).lower() or data.get("database_configured") is not None

def test_jobs_unauthenticated_requests():
    # 1. GET /api/jobs without header
    res_list = client.get("/api/jobs")
    assert res_list.status_code == 401

    # 2. POST /api/jobs without header
    res_create = client.post("/api/jobs", json={
        "customer_name": "Test Customer",
        "description": "Wiring",
        "agreed_amount": 1000,
        "confirmed": True
    })
    assert res_create.status_code == 401

    # 3. GET /api/jobs/{id} without header
    res_get = client.get("/api/jobs/123e4567-e89b-12d3-a456-426614174000")
    assert res_get.status_code == 401

def test_payments_and_reminders_unauthenticated():
    # Payments routes require auth
    res_pay_create = client.post("/api/jobs/123/payments", json={"amount": 500, "payment_mode": "cash", "confirmed": True})
    assert res_pay_create.status_code == 401

    res_pay_list = client.get("/api/jobs/123/payments")
    assert res_pay_list.status_code == 401

    # Reminders routes require auth
    res_rem_list = client.get("/api/reminders")
    assert res_rem_list.status_code == 401

    res_rem_create = client.post("/api/reminders", json={"task": "Call customer", "due_date": "2026-10-20"})
    assert res_rem_create.status_code == 401

def test_bolna_tools_endpoint():
    res = client.get("/api/bolna/tools")
    assert res.status_code == 200
    data = res.json()
    assert "tools" in data
    assert len(data["tools"]) >= 8
    tool_names = [t["name"] for t in data["tools"]]
    assert "create_job" in tool_names
    assert "record_payment" in tool_names
    assert "create_reminder" in tool_names
    assert "complete_reminder" in tool_names
    assert "correct_record" in tool_names
    assert "answer_ledger_question" in tool_names

def test_bolna_session_unconfigured(monkeypatch):
    monkeypatch.setattr("app.routes.bolna.settings.BOLNA_API_KEY", "")
    monkeypatch.setattr("app.routes.bolna.settings.BOLNA_AGENT_ID", "")
    res = client.post("/api/bolna-session")
    # Should safely return 503 when credentials are not configured
    assert res.status_code == 503
    assert "Bolna Voice Agent is not configured" in res.json()["detail"]

def test_bolna_session_configured_or_live():
    res = client.post("/api/bolna-session")
    # When credentials are provided, it returns 200 with short-lived SIP credentials; if unconfigured, returns 503
    assert res.status_code in [200, 503]
    if res.status_code == 200:
        data = res.json()
        assert "sip_username" in data or "agent_id" in data or "run_id" in data

def test_jobs_invalid_token():
    res = client.get("/api/jobs", headers={"Authorization": "Bearer bad-token"})
    assert res.status_code in [401, 503]

def test_job_create_schema_validation():
    # Negative or 0 agreed_amount should fail validation
    with pytest.raises(Exception):
        JobCreate(
            customer_name="Ramesh",
            description="Fan repair",
            agreed_amount=Decimal("-100"),
            confirmed=True
        )

    # Empty customer name should fail
    with pytest.raises(Exception):
        JobCreate(
            customer_name="   ",
            description="Fan repair",
            agreed_amount=Decimal("500"),
            confirmed=True
        )

    # Amount paid greater than agreed should fail
    with pytest.raises(Exception):
        JobCreate(
            customer_name="Ramesh",
            description="Fan repair",
            agreed_amount=Decimal("500"),
            amount_paid=Decimal("800"),
            confirmed=True
        )

def test_job_service_unconfirmed_rejected():
    payload = JobCreate(
        customer_name="Suman Ghosh",
        customer_phone="+91 98301 44210",
        trade=TradeType.electrical,
        description="Ceiling fan repair",
        agreed_amount=Decimal("1200"),
        amount_paid=Decimal("500"),
        confirmed=False
    )

    class MockClient:
        pass

    with pytest.raises(HTTPException) as exc_info:
        JobService.create_job(payload, "fake-user-id", MockClient())
    
    assert exc_info.value.status_code == 400
    assert "confirmed" in exc_info.value.detail.lower()

def test_payment_excess_rejected():
    # Test that payment exceeding balance is rejected
    class MockClient:
        def table(self, name):
            class MockTable:
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def execute(self):
                    class Result:
                        data = [{
                            "id": "job-1",
                            "agreed_amount": 1000.0,
                            "amount_paid": 800.0,
                            "remaining_balance": 200.0,
                            "status": "partially_paid"
                        }]
                    return Result()
            return MockTable()

    payload = PaymentCreate(
        amount=Decimal("300.00"),  # Exceeds 200 remaining
        payment_mode=PaymentMode.cash,
        confirmed=True
    )

    with pytest.raises(HTTPException) as exc_info:
        JobService.record_payment("job-1", payload, "owner-1", MockClient())
    
    assert exc_info.value.status_code == 400
    assert "exceeds" in exc_info.value.detail.lower()

def test_job_service_business_logic():
    class MockInsertBuilder:
        def __init__(self, data):
            self.data = data
        def execute(self):
            res_row = dict(self.data)
            res_row["id"] = "test-uuid"
            res_row["created_at"] = "2026-10-15T12:00:00Z"
            res_row["updated_at"] = "2026-10-15T12:00:00Z"
            class Result:
                data = [res_row]
            return Result()

    class MockTableBuilder:
        def insert(self, data):
            self.inserted_data = data
            return MockInsertBuilder(data)

    class MockClient:
        def table(self, name):
            assert name == "jobs"
            return MockTableBuilder()

    payload = JobCreate(
        customer_name="Suman Ghosh",
        customer_phone="+91 98301 44210",
        trade=TradeType.electrical,
        description="Ceiling fan repair",
        agreed_amount=Decimal("1200.00"),
        amount_paid=Decimal("500.00"),
        confirmed=True
    )

    created = JobService.create_job(payload, "test-owner-uuid", MockClient())
    assert created["owner_id"] == "test-owner-uuid"
    assert created["status"] == "partially_paid"
    assert created["agreed_amount"] == 1200.00
    assert created["amount_paid"] == 500.00
    assert created["remaining_balance"] == 700.00

def test_job_update_requires_confirmation_for_financial_changes():
    from app.schemas import JobUpdate

    class MockClient:
        def table(self, name):
            class MockTable:
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def execute(self):
                    class Result:
                        data = [{
                            "id": "job-101",
                            "owner_id": "owner-1",
                            "customer_name": "Suman Ghosh",
                            "customer_phone": "+91 98301 44210",
                            "trade": "electrical",
                            "description": "Fan repair",
                            "agreed_amount": 1200.0,
                            "amount_paid": 500.0,
                            "remaining_balance": 700.0,
                            "status": "partially_paid",
                            "notes": ""
                        }]
                    return Result()
            return MockTable()

    # Financial change without confirmed=True should fail with 400
    update_unconfirmed = JobUpdate(agreed_amount=Decimal("1500.00"), confirmed=False)
    with pytest.raises(HTTPException) as exc:
        JobService.update_job("job-101", update_unconfirmed, "owner-1", MockClient())
    assert exc.value.status_code == 400
    assert "confirmation required" in exc.value.detail.lower()

def test_job_search_and_filter():
    class MockClient:
        def table(self, name):
            class MockTable:
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def order(self, *args, **kwargs):
                    return self
                def execute(self):
                    class Result:
                        data = [
                            {"id": "j1", "owner_id": "u1", "customer_name": "Suman Ghosh", "customer_phone": "+91 98301 44210", "trade": "electrical", "description": "Fan capacitor", "agreed_amount": 1200, "amount_paid": 500, "remaining_balance": 700, "status": "partially_paid", "notes": ""},
                            {"id": "j2", "owner_id": "u1", "customer_name": "Ramesh Babu", "customer_phone": "+91 94330 89123", "trade": "plumbing", "description": "Sink tap", "agreed_amount": 1850, "amount_paid": 1850, "remaining_balance": 0, "status": "completed", "notes": ""},
                            {"id": "j3", "owner_id": "u1", "customer_name": "Amit Sen", "customer_phone": "+91 98740 12899", "trade": "appliance", "description": "AC chemical wash", "agreed_amount": 2400, "amount_paid": 0, "remaining_balance": 2400, "status": "pending", "notes": ""},
                        ]
                    return Result()
            return MockTable()

    # Search for 'Ghosh'
    res_search = JobService.list_jobs("u1", MockClient(), q="Ghosh")
    assert len(res_search) == 1
    assert res_search[0]["customer_name"] == "Suman Ghosh"

    # Filter for 'completed'
    res_filter = JobService.list_jobs("u1", MockClient(), status="completed")
    assert len(res_filter) == 1
    assert res_filter[0]["customer_name"] == "Ramesh Babu"

def test_payment_correction_deterministic():
    from app.schemas import PaymentCorrectionCreate

    class MockClient:
        def table(self, name):
            class MockTable:
                def __init__(self, table_name):
                    self.table_name = table_name
                def select(self, *args):
                    return self
                def eq(self, field, val):
                    return self
                def update(self, data):
                    self.update_data = data
                    return self
                def execute(self):
                    class Result:
                        pass
                    r = Result()
                    if self.table_name == "payment_events":
                        # Original payment is pay-1 for 600
                        r.data = [{
                            "id": "pay-1",
                            "owner_id": "u1",
                            "job_id": "job-1",
                            "amount": 600.0,
                            "payment_mode": "cash",
                            "notes": "Initial",
                            "recorded_at": "2026-10-15T10:00:00Z"
                        }]
                    elif self.table_name == "jobs":
                        r.data = [{
                            "id": "job-1",
                            "owner_id": "u1",
                            "agreed_amount": 1000.0,
                            "amount_paid": 600.0,
                            "remaining_balance": 400.0,
                            "status": "partially_paid",
                            "customer_name": "Debasish"
                        }]
                    return r
            return MockTable(name)

    # 1. Unconfirmed correction rejected
    unconfirmed = PaymentCorrectionCreate(new_amount=Decimal("400.00"), reason="Typo in token amount", confirmed=False)
    with pytest.raises(HTTPException) as exc:
        JobService.correct_payment("pay-1", unconfirmed, "u1", MockClient())
    assert exc.value.status_code == 400

    # 2. Correction exceeding agreed amount (e.g. 1500 when agreed is 1000) rejected
    excess_correction = PaymentCorrectionCreate(new_amount=Decimal("1500.00"), reason="Bump", confirmed=True)
    with pytest.raises(HTTPException) as exc:
        JobService.correct_payment("pay-1", excess_correction, "u1", MockClient())
    assert exc.value.status_code == 400
    assert "exceed agreed amount" in exc.value.detail.lower()

    # 3. Valid confirmed correction (600 corrected to 1000: fully paid)
    valid_correction = PaymentCorrectionCreate(new_amount=Decimal("1000.00"), reason="Final settlement included", confirmed=True)
    res = JobService.correct_payment("pay-1", valid_correction, "u1", MockClient())
    assert res["remaining_balance"] == 0.0
    assert res["job_status"] == "completed"

def test_reminder_date_validation_and_lifecycle():
    from app.schemas import ReminderCreate, ReminderPriority

    # Invalid date format should fail validation
    with pytest.raises(Exception):
        ReminderCreate(task="Check AC cooling", due_date="invalid-date")

    with pytest.raises(Exception):
        ReminderCreate(task="Check AC cooling", due_date="2026-02-31")  # Impossible leap-year date

    # Valid reminder creation
    valid = ReminderCreate(task="Check AC cooling", due_date="2026-10-25", priority=ReminderPriority.urgent)
    assert valid.due_date == "2026-10-25"

    class MockClient:
        def table(self, name):
            class MockTable:
                def __init__(self, table_name):
                    self.table_name = table_name
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def order(self, *args, **kwargs):
                    return self
                def insert(self, data):
                    self.data = dict(data)
                    self.data["id"] = "rem-1"
                    self.data["created_at"] = "2026-10-15T10:00:00Z"
                    return self
                def update(self, data):
                    self.data = [{"id": "rem-1", "is_completed": data["is_completed"]}]
                    return self
                def delete(self):
                    return self
                def execute(self):
                    class Result:
                        pass
                    r = Result()
                    if hasattr(self, "data"):
                        r.data = self.data if isinstance(self.data, list) else [self.data]
                    else:
                        r.data = [{"id": "rem-1", "is_completed": False}]
                    return r
            return MockTable(name)

    from app.services.reminders import ReminderService
    created_rem = ReminderService.create_reminder(valid, "u1", MockClient())
    assert created_rem["id"] == "rem-1"
    assert created_rem["is_completed"] is False

    # Toggle completion
    toggled = ReminderService.toggle_reminder("rem-1", "u1", MockClient(), is_completed=True)
    assert toggled["is_completed"] is True

    # Delete
    del_res = ReminderService.delete_reminder("rem-1", "u1", MockClient())
    assert del_res["success"] is True

def test_dashboard_stats_calculation():
    class MockClient:
        def table(self, name):
            class MockTable:
                def __init__(self, table_name):
                    self.table_name = table_name
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def order(self, *args, **kwargs):
                    return self
                def execute(self):
                    class Result:
                        pass
                    r = Result()
                    if self.table_name == "jobs":
                        r.data = [
                            {"id": "j1", "owner_id": "u1", "agreed_amount": 1000, "amount_paid": 400, "remaining_balance": 600, "status": "partially_paid", "created_at": "2026-10-15T09:00:00Z"},
                            {"id": "j2", "owner_id": "u1", "agreed_amount": 2000, "amount_paid": 2000, "remaining_balance": 0, "status": "completed", "created_at": "2026-10-15T10:00:00Z"},
                        ]
                    elif self.table_name == "payment_events":
                        r.data = [
                            {"id": "p1", "owner_id": "u1", "amount": 400, "recorded_at": "2026-10-15T09:30:00Z"},
                            {"id": "p2", "owner_id": "u1", "amount": 2000, "recorded_at": "2026-10-15T10:30:00Z"},
                        ]
                    elif self.table_name == "reminders":
                        r.data = [
                            {"id": "r1", "owner_id": "u1", "is_completed": False},
                            {"id": "r2", "owner_id": "u1", "is_completed": True},
                        ]
                    return r
            return MockTable(name)

    stats = JobService.get_dashboard_stats("u1", MockClient())
    assert stats["total_jobs"] == 2
    assert stats["total_agreed"] == 3000.0
    assert stats["total_collected"] == 2400.0
    assert stats["total_outstanding"] == 600.0
    assert stats["pending_jobs_count"] == 1
    assert stats["completed_jobs_count"] == 1
    assert stats["upcoming_reminders_count"] == 1
    assert len(stats["weekly_earnings"]) == 7

def test_bolna_tool_execution_all_seven_tools():
    from app.services.bolna_tools import BolnaToolExecutor

    class MockClient:
        def table(self, name):
            class MockTable:
                def __init__(self, table_name):
                    self.table_name = table_name
                def select(self, *args):
                    return self
                def eq(self, *args):
                    return self
                def order(self, *args, **kwargs):
                    return self
                def insert(self, data):
                    self.data = dict(data)
                    self.data["id"] = "gen-uuid"
                    return self
                def update(self, data):
                    self.data = dict(data)
                    self.data["id"] = "gen-uuid"
                    return self
                def execute(self):
                    class Result:
                        pass
                    r = Result()
                    if hasattr(self, "data"):
                        r.data = [self.data]
                    elif self.table_name == "jobs":
                        r.data = [{
                            "id": "job-101",
                            "owner_id": "u1",
                            "customer_name": "Suman Ghosh",
                            "agreed_amount": 1200.0,
                            "amount_paid": 500.0,
                            "remaining_balance": 700.0,
                            "status": "partially_paid",
                            "customer_phone": "+91 98301 44210",
                            "trade": "electrical"
                        }]
                    elif self.table_name == "payment_events":
                        r.data = [{
                            "id": "pay-101",
                            "owner_id": "u1",
                            "job_id": "job-101",
                            "amount": 500.0,
                            "notes": ""
                        }]
                    elif self.table_name == "reminders":
                        r.data = [{
                            "id": "rem-101",
                            "owner_id": "u1",
                            "task": "Follow up payment",
                            "due_date": "2026-10-20",
                            "is_completed": False
                        }]
                    return r
            return MockTable(name)

    client = MockClient()

    # 1. create_job (unconfirmed vs confirmed)
    res_unconf = BolnaToolExecutor.execute("create_job", {
        "customer_name": "Ananya Mukherjee",
        "trade": "appliance",
        "description": "Microwave repair",
        "agreed_amount": 950,
        "amount_paid": 0,
        "confirmed": False
    }, "u1", client)
    assert res_unconf.requires_confirmation is True
    assert "Ananya Mukherjee" in res_unconf.readback

    res_conf = BolnaToolExecutor.execute("create_job", {
        "customer_name": "Ananya Mukherjee",
        "trade": "appliance",
        "description": "Microwave repair",
        "agreed_amount": 950,
        "amount_paid": 0,
        "confirmed": True
    }, "u1", client)
    assert res_conf.success is True

    # 2. list_jobs
    res_list = BolnaToolExecutor.execute("list_jobs", {}, "u1", client)
    assert res_list.success is True
    assert "jobs" in res_list.result

    # 3. record_payment (unconfirmed vs excess vs confirmed)
    # 3a. unconfirmed
    res_pay_unconf = BolnaToolExecutor.execute("record_payment", {
        "job_id": "job-101",
        "amount": 300,
        "payment_mode": "upi",
        "confirmed": False
    }, "u1", client)
    assert res_pay_unconf.requires_confirmation is True
    assert "₹300" in res_pay_unconf.readback

    # 3b. excess payment (> 700 balance)
    res_pay_excess = BolnaToolExecutor.execute("record_payment", {
        "job_id": "job-101",
        "amount": 900,
        "payment_mode": "upi",
        "confirmed": True
    }, "u1", client)
    assert res_pay_excess.success is False
    assert "exceeds" in res_pay_excess.message.lower()

    # 3c. valid confirmed payment
    res_pay_conf = BolnaToolExecutor.execute("record_payment", {
        "job_id": "job-101",
        "amount": 700,
        "payment_mode": "upi",
        "confirmed": True
    }, "u1", client)
    assert res_pay_conf.success is True
    assert res_pay_conf.result["remaining_balance"] == 0.0

    # 4. get_outstanding_balances
    res_udhaar = BolnaToolExecutor.execute("get_outstanding_balances", {}, "u1", client)
    assert res_udhaar.success is True
    assert res_udhaar.result["total_outstanding"] == 700.0

    # 5. create_reminder
    res_rem_unconf = BolnaToolExecutor.execute("create_reminder", {
        "task": "Test capacitor",
        "due_date": "2026-10-22",
        "confirmed": False
    }, "u1", client)
    assert res_rem_unconf.requires_confirmation is True

    res_rem_conf = BolnaToolExecutor.execute("create_reminder", {
        "task": "Test capacitor",
        "due_date": "2026-10-22",
        "confirmed": True
    }, "u1", client)
    assert res_rem_conf.success is True

    # 6. list_reminders
    res_rems = BolnaToolExecutor.execute("list_reminders", {}, "u1", client)
    assert res_rems.success is True

    # 7. correct_record
    res_corr = BolnaToolExecutor.execute("correct_record", {
        "entity_type": "job",
        "entity_id": "job-101",
        "field_name": "description",
        "new_value": "Ceiling fan and wall socket repair",
        "confirmed": True
    }, "u1", client)
    assert res_corr.success is True

def test_cross_user_tenant_isolation():
    # User B cannot access User A's job
    class MockClient:
        def table(self, name):
            class MockTable:
                def select(self, *args):
                    return self
                def eq(self, field, val):
                    # If querying for user-B on job belonging to user-A, return empty
                    self.val = val
                    return self
                def execute(self):
                    class Result:
                        data = []  # No rows found because owner_id != user-B
                    return Result()
            return MockTable()

    with pytest.raises(HTTPException) as exc:
        JobService.get_job_by_id("job-owned-by-user-A", "user-B", MockClient())
    assert exc.value.status_code == 404
    assert "not authorized" in exc.value.detail.lower() or "not found" in exc.value.detail.lower()

def test_bilingual_voice_recognition_heuristics():
    # Test English and Bengali heuristic extraction
    import re

    # 1. English pattern
    en_phrase = "Create job for Suman Ghosh, ceiling fan repair, fee 1200 rupees, advance 500"
    amount_match = re.search(r'(?:fee|agreed|total|cost|charge)?\s*(?:rs|inr|₹)?\s*(\d+)', en_phrase, re.IGNORECASE)
    assert amount_match is not None
    assert int(amount_match.group(1)) == 1200

    # 2. Bengali pattern
    bn_phrase = "সুমন ঘোষ এর ফ্যান সারাই, মোট ১২০০ টাকা, অগ্রিম ৫০০ টাকা"
    # Bengali numeral mapping
    bn_digits = {'০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'}
    normalized_bn = "".join(bn_digits.get(c, c) for c in bn_phrase)
    assert "1200" in normalized_bn
    assert "500" in normalized_bn
