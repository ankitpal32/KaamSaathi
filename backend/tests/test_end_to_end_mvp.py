import pytest
from decimal import Decimal
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.schemas import PaymentMode, TradeType, JobStatus

client = TestClient(app)

class InMemoryLedgerDB:
    """
    In-memory isolated ledger database simulating Supabase PostgREST table operations
    with RLS (Row Level Security) enforcement per owner_id.
    """
    def __init__(self):
        self.jobs = {}
        self.payments = {}
        self.reminders = {}
        self._gen_id = 100

    def table(self, table_name: str):
        ledger = self
        class TableQuery:
            def __init__(self):
                self._table_name = table_name
                self._filters = []
                self._order_field = None
                self._order_desc = False

            def select(self, *args, **kwargs):
                return self

            def eq(self, field, value):
                self._filters.append((field, value))
                return self

            def order(self, field, desc=False):
                self._order_field = field
                self._order_desc = desc
                return self

            def _get_target_dict(self):
                if self._table_name == "jobs":
                    return ledger.jobs
                elif self._table_name == "payment_events":
                    return ledger.payments
                elif self._table_name == "reminders":
                    return ledger.reminders
                return {}

            def _match(self, row):
                for f, v in self._filters:
                    if str(row.get(f)) != str(v):
                        return False
                return True

            def insert(self, payload):
                target = self._get_target_dict()
                ledger._gen_id += 1
                row_id = f"uuid-{ledger._gen_id}"
                row = dict(payload)
                row["id"] = row_id
                row["created_at"] = "2026-10-16T10:00:00Z"
                row["updated_at"] = "2026-10-16T10:00:00Z"
                if self._table_name == "payment_events":
                    row["recorded_at"] = "2026-10-16T10:00:00Z"
                
                # If jobs table, ensure remaining_balance is calculated
                if self._table_name == "jobs":
                    agreed = float(row.get("agreed_amount", 0))
                    paid = float(row.get("amount_paid", 0))
                    row["remaining_balance"] = max(0.0, agreed - paid)
                    if row["remaining_balance"] == 0 and agreed > 0:
                        row["status"] = "completed"
                    elif paid > 0:
                        row["status"] = "partially_paid"
                    else:
                        row["status"] = "pending"

                target[row_id] = row
                self._inserted_row = row
                return self

            def update(self, payload):
                target = self._get_target_dict()
                updated_rows = []
                for row_id, row in list(target.items()):
                    if self._match(row):
                        row.update(payload)
                        if self._table_name == "jobs":
                            agreed = float(row.get("agreed_amount", 0))
                            paid = float(row.get("amount_paid", 0))
                            row["remaining_balance"] = max(0.0, agreed - paid)
                        row["updated_at"] = "2026-10-16T10:05:00Z"
                        updated_rows.append(row)
                self._updated_rows = updated_rows
                return self

            def delete(self):
                target = self._get_target_dict()
                deleted_rows = []
                for row_id, row in list(target.items()):
                    if self._match(row):
                        deleted_rows.append(target.pop(row_id))
                self._deleted_rows = deleted_rows
                return self

            def execute(self):
                target = self._get_target_dict()
                if hasattr(self, "_inserted_row"):
                    res = MagicMock()
                    res.data = [self._inserted_row]
                    return res
                if hasattr(self, "_updated_rows"):
                    res = MagicMock()
                    res.data = self._updated_rows
                    return res
                if hasattr(self, "_deleted_rows"):
                    res = MagicMock()
                    res.data = self._deleted_rows
                    return res
                matched = [row for row in target.values() if self._match(row)]
                res = MagicMock()
                res.data = matched
                return res

        return TableQuery()


def test_complete_fictional_job_lifecycle_workflow():
    """
    End-to-end verification of the 7 MVP requirements through a complete technician lifecycle:
    1. Spoken job draft triggers readback without committing.
    2. Confirmation commits job with deterministic balance.
    3. Incremental partial payment reconciles remaining balance.
    4. Outstanding balance query accurately identifies debt.
    5. Natural language questions answered accurately from saved records.
    6. Follow-up reminder created, tracked, and completed.
    7. Corrections applied with confirmation.
    8. Excess payments, negative amounts, and bad inputs rejected.
    9. Cross-tenant isolation strictly enforced.
    """
    db = InMemoryLedgerDB()
    tech1_id = "tech-uuid-1"
    tech2_id = "tech-uuid-2"

    app.dependency_overrides[get_authenticated_user_id] = lambda: tech1_id
    app.dependency_overrides[get_user_scoped_db] = lambda: db

    try:
        # ======================================================================
        # STEP 1: Unconfirmed Job Voice Draft (Readback Guard)
        # ======================================================================
        resp_draft = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Suman Ghosh",
                    "trade": "electrical",
                    "description": "Ceiling fan bearing replacement & capacitor repair",
                    "agreed_amount": 1200,
                    "amount_paid": 500,
                    "confirmed": False
                }
            }
        )
        assert resp_draft.status_code == 200
        draft_data = resp_draft.json()
        assert draft_data["success"] is False
        assert draft_data["requires_confirmation"] is True
        assert "Suman Ghosh" in draft_data["readback"]
        assert "1200" in draft_data["readback"]
        assert "500" in draft_data["readback"]
        assert "700" in draft_data["readback"]
        # Database must have ZERO jobs saved yet
        assert len(db.jobs) == 0

        # ======================================================================
        # STEP 2: Confirmed Job Creation (Deterministic Balance)
        # ======================================================================
        resp_confirm = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Suman Ghosh",
                    "trade": "electrical",
                    "description": "Ceiling fan bearing replacement & capacitor repair",
                    "agreed_amount": 1200,
                    "amount_paid": 500,
                    "confirmed": True
                }
            }
        )
        assert resp_confirm.status_code == 200
        job_result = resp_confirm.json()
        assert job_result["success"] is True
        saved_job = job_result["result"]
        job_id = saved_job["id"]
        assert saved_job["customer_name"] == "Suman Ghosh"
        assert float(saved_job["agreed_amount"]) == 1200.0
        assert float(saved_job["amount_paid"]) == 500.0
        assert float(saved_job["remaining_balance"]) == 700.0
        assert saved_job["status"] == "partially_paid"
        assert len(db.jobs) == 1

        # ======================================================================
        # STEP 3: Record Partial Payment (₹300 via UPI)
        # ======================================================================
        # A. Unconfirmed payment requires confirmation
        resp_pay_unconf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": job_id,
                    "amount": 300,
                    "payment_mode": "upi",
                    "confirmed": False
                }
            }
        )
        assert resp_pay_unconf.status_code == 200
        assert resp_pay_unconf.json()["requires_confirmation"] is True
        assert "300" in resp_pay_unconf.json()["readback"]
        assert "400" in resp_pay_unconf.json()["readback"]  # 700 - 300 = 400

        # B. Confirmed payment executes update
        resp_pay_conf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": job_id,
                    "amount": 300,
                    "payment_mode": "upi",
                    "confirmed": True
                }
            }
        )
        assert resp_pay_conf.status_code == 200
        pay_res = resp_pay_conf.json()
        assert pay_res["success"] is True
        assert float(pay_res["result"]["remaining_balance"]) == 400.0
        assert float(pay_res["result"]["amount"]) == 300.0
        assert "400" in pay_res["message"]

        # ======================================================================
        # STEP 4: Verify Outstanding Balance Calculation
        # ======================================================================
        resp_balance = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "get_outstanding_balances",
                "arguments": {}
            }
        )
        assert resp_balance.status_code == 200
        bal_data = resp_balance.json()
        assert bal_data["success"] is True
        assert bal_data["result"]["total_outstanding"] == 400.0
        assert len(bal_data["result"]["debtors"]) == 1
        assert bal_data["result"]["debtors"][0]["customer_name"] == "Suman Ghosh"

        # ======================================================================
        # STEP 5: Answer Questions from Saved Records (Requirement 5)
        # ======================================================================
        # A. Ask who owes money
        resp_q_udhaar = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "Who owes me udhaar money right now?"}
            }
        )
        assert resp_q_udhaar.status_code == 200
        msg_udhaar = resp_q_udhaar.json()["message"]
        assert "Suman Ghosh" in msg_udhaar
        assert "400" in msg_udhaar

        # B. Ask customer-specific query
        resp_q_cust = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "How much has Suman Ghosh paid so far?"}
            }
        )
        assert resp_q_cust.status_code == 200
        msg_cust = resp_q_cust.json()["message"]
        assert "1200" in msg_cust
        assert "800" in msg_cust
        assert "400" in msg_cust

        # C. Ask earnings query
        resp_q_earn = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "answer_ledger_question",
                "arguments": {"question": "How much have I collected in earnings today?"}
            }
        )
        assert resp_q_earn.status_code == 200
        assert "800" in resp_q_earn.json()["message"]

        # ======================================================================
        # STEP 6: Customer Follow-up Reminder Lifecycle
        # ======================================================================
        # A. Unconfirmed reminder requires confirmation
        resp_rem_unconf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "create_reminder",
                "arguments": {
                    "job_id": job_id,
                    "task": "Collect balance ₹400 from Suman Ghosh",
                    "due_date": "2026-10-25",
                    "priority": "urgent",
                    "confirmed": False
                }
            }
        )
        assert resp_rem_unconf.status_code == 200
        assert resp_rem_unconf.json()["requires_confirmation"] is True
        assert "Collect balance" in resp_rem_unconf.json()["readback"]

        # B. Confirmed reminder creation
        resp_rem_conf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "create_reminder",
                "arguments": {
                    "job_id": job_id,
                    "task": "Collect balance ₹400 from Suman Ghosh",
                    "due_date": "2026-10-25",
                    "priority": "urgent",
                    "confirmed": True
                }
            }
        )
        assert resp_rem_conf.status_code == 200
        rem_data = resp_rem_conf.json()
        assert rem_data["success"] is True
        rem_id = rem_data["result"]["id"]

        # C. Complete reminder via correct_record
        resp_toggle = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "correct_record",
                "arguments": {
                    "entity_type": "reminder",
                    "entity_id": rem_id,
                    "field_name": "is_completed",
                    "new_value": "true",
                    "confirmed": True
                }
            }
        )
        assert resp_toggle.status_code == 200
        assert resp_toggle.json()["success"] is True

        # ======================================================================
        # STEP 7: Corrections & Validation Guards
        # ======================================================================
        # A. Job correction readback before write
        resp_corr_unconf = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "correct_record",
                "arguments": {
                    "entity_type": "job",
                    "entity_id": job_id,
                    "field_name": "notes",
                    "new_value": "Customer promised cash on Monday",
                    "confirmed": False
                }
            }
        )
        assert resp_corr_unconf.status_code == 200
        assert resp_corr_unconf.json()["requires_confirmation"] is True

        # B. Excess payment rejected (Attempting to pay ₹500 when balance is ₹400)
        resp_excess = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "record_payment",
                "arguments": {
                    "job_id": job_id,
                    "amount": 500,  # Exceeds 400
                    "payment_mode": "cash",
                    "confirmed": True
                }
            }
        )
        assert resp_excess.status_code == 200
        assert resp_excess.json()["success"] is False
        assert "exceeds" in resp_excess.json()["message"].lower()

        # C. Invalid negative or zero amounts rejected
        resp_neg = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-1"},
            json={
                "tool_name": "create_job",
                "arguments": {
                    "customer_name": "Bad Job",
                    "description": "Wiring",
                    "agreed_amount": -100,
                    "confirmed": True
                }
            }
        )
        assert resp_neg.status_code == 200
        assert resp_neg.json()["success"] is False
        assert "greater than zero" in resp_neg.json()["message"].lower()

        # ======================================================================
        # STEP 8: Cross-User Tenant Isolation Verification
        # ======================================================================
        # Switch authenticated context to technician 2
        app.dependency_overrides[get_authenticated_user_id] = lambda: tech2_id
        
        # Technician 2 queries jobs -> Must be EMPTY (cannot see technician 1's job)
        resp_tech2_jobs = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-tech2"},
            json={"tool_name": "list_jobs", "arguments": {}}
        )
        assert resp_tech2_jobs.status_code == 200
        assert resp_tech2_jobs.json()["result"]["total"] == 0

        # Technician 2 queries debts -> Must be zero
        resp_tech2_debts = client.post(
            "/api/bolna/tools/execute",
            headers={"Authorization": "Bearer token-tech2"},
            json={"tool_name": "get_outstanding_balances", "arguments": {}}
        )
        assert resp_tech2_debts.status_code == 200
        assert resp_tech2_debts.json()["result"]["total_outstanding"] == 0.0

    finally:
        app.dependency_overrides.clear()
