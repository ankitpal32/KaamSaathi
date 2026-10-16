# KaamSaathi — Quality Assurance & Test Plan

> **Document Version**: 1.0.0  
> **Testing Strategy**: Layered verification spanning unit tests, API integration tests, client-side validation, and manual scenario walk-throughs.

---

## 1. Test Harness Overview

| Test Layer | Framework / Tools | Execution Command | Scope |
|---|---|---|---|
| **Backend Unit Tests** | Pytest, FastAPI TestClient | `cd backend; .\venv\Scripts\pytest tests -v` | Models, validation, endpoints, auth dependencies. |
| **Frontend Static Typing** | TypeScript (`tsc`) | `cd frontend; npm run lint` | Type coverage, interface mapping, JSX errors. |
| **Frontend Production Build** | Vite, Rollup | `cd frontend; npm run build` | Bundle optimization, missing imports, module resolution. |
| **Manual User Scenarios** | Browser / Edge / Chrome | Interactive UI testing | Ergonomics, responsive layout, modal transitions. |

---

## 2. Test Suites & Verification Scenarios

### 2.1 Backend API Tests (`backend/tests/test_api.py`)

| Test ID | Test Target | Input / Precondition | Expected Result | Verified Status |
|---|---|---|---|---|
| **[TEST-API-01]** | Root Endpoint | `GET /` | Returns `200 OK` with running status and docs link | ✅ Verified |
| **[TEST-API-02]** | Health Endpoint | `GET /health` | Returns `200 OK` with DB status; no secrets leaked | ✅ Verified |
| **[TEST-API-03]** | Unauthenticated List | `GET /api/jobs` without header | Returns `401 Unauthorized` | ✅ Verified |
| **[TEST-API-04]** | Unauthenticated Create | `POST /api/jobs` without header | Returns `401 Unauthorized` | ✅ Verified |
| **[TEST-API-05]** | Unauthenticated Get | `GET /api/jobs/{id}` without header | Returns `401 Unauthorized` | ✅ Verified |
| **[TEST-API-06]** | Invalid Bearer Token | `GET /api/jobs` with `Bearer bad` | Returns `401` or `503` if DB unconfigured | ✅ Verified |
| **[TEST-API-07]** | Negative Agreed Amount | `agreed_amount = -100` | Rejected by Pydantic validator (`422`) | ✅ Verified |
| **[TEST-API-08]** | Empty Customer Name | `customer_name = "   "` | Rejected by Pydantic validator (`422`) | ✅ Verified |
| **[TEST-API-09]** | Payment Exceeds Agreed | `agreed = 500, paid = 800` | Rejected by Pydantic validator (`422`) | ✅ Verified |
| **[TEST-API-10]** | Unconfirmed Job Save | `confirmed = False` | Rejected by `JobService` (`400 Bad Request`) | ✅ Verified |
| **[TEST-API-11]** | Status Calculation | `agreed = 1200, paid = 500` | Calculated `partially_paid`, balance `700.00` | ✅ Verified |

---

### 2.2 Financial Arithmetic Scenarios

Technician trust depends entirely on zero arithmetic discrepancy. All calculations must satisfy:
$$\text{Remaining Balance} = \max(0, \text{Agreed Amount} - \text{Amount Paid})$$

| Scenario | Agreed Amount (₹) | Initial Paid (₹) | Expected Balance (₹) | Expected Status |
|---|---|---|---|---|
| **Zero Advance** | 1,500.00 | 0.00 | 1,500.00 | `pending` |
| **Partial Advance** | 2,400.00 | 1,400.00 | 1,000.00 | `partially_paid` |
| **Paid in Full** | 950.00 | 950.00 | 0.00 | `completed` |
| **Subsequent Cash Payment** | 1,000.00 (balance) | 1,000.00 | 0.00 | Transitions to `completed` |

---

### 2.3 Frontend Smoke Tests & Scenarios

| Test ID | Flow | Verification Steps |
|---|---|---|
| **[TEST-FE-01]** | Dashboard Load | Open `http://localhost:3000`. Confirm KPI numbers match summary of active jobs. |
| **[TEST-FE-02]** | Language Toggle | Click "English / বাংলা" button. Confirm tabs change to "ড্যাশবোর্ড", "কাজের হিসাব", "পেমেন্ট", "অনুস্মারক". |
| **[TEST-FE-03]** | Job Creation with Confirmation | Open New Job modal. Fill details. Confirm submit button is disabled until checking "Confirm job details". Submit and verify toast. |
| **[TEST-FE-04]** | Offline Demo Fallback | Disconnect backend. Verify top status banner shows "Backend Offline · Running in Local Demo Mode". Confirm jobs still save to `localStorage`. |
| **[TEST-FE-05]** | Voice Speech Recognition Fallback | Open Voice modal in Demo mode. Select preset "Suman Ghosh fan repair ₹1,200". Verify editable confirmation sheet populates correctly. |

---

### 2.4 Voice Recognition & Tool-Calling Test Scenarios (Planned — Milestone 5)

| Test ID | Audio Input (Bengali / English) | Expected Entity Extraction | Expected Confirmation |
|---|---|---|---|
| **[TEST-VOICE-01]** | "Repaired kitchen switchboard for Priya Roy. Charged 850 rupees, paid full cash." | Customer: Priya Roy<br/>Trade: electrical<br/>Agreed: 850<br/>Paid: 850 | "Priya Roy, Electrical, ₹850 paid in full. Confirm to save?" |
| **[TEST-VOICE-02]** | "Amit Sen AC servicing done for 2400. He gave 1000 cash advance." | Customer: Amit Sen<br/>Trade: appliance<br/>Agreed: 2400<br/>Paid: 1000 | "Amit Sen, Appliance, Agreed ₹2,400, Advance ₹1,000, Balance ₹1,400. Confirm?" |

---

### 2.5 Security & Failure Scenarios

- **SQL Injection Attempt**: Test job search and customer name fields with `' OR 1=1; --`. Supabase PostgREST parameterization guarantees safety.
- **Cross-Tenant Data Tampering**: Injecting a foreign `job_id` into `GET /api/jobs/{id}` or `POST /api/jobs/{id}/payments` returns `404 Not Found` due to owner validation and RLS `auth.uid() = owner_id`.
- **Secret Extraction Audit**: Inspect client production bundle (`dist/assets/*.js`) for keywords like `SERVICE_ROLE_KEY` or `BOLNA_API_KEY`. Must return 0 matches.

---

### 2.6 Automated Pytest Execution Matrix (36/36 Passing)

#### A. Core API & Financial Engine (`test_api.py` — 19 Tests)
| Test Function | Target Feature | Verification Type | Status |
|---|---|---|---|
| `test_root_endpoint` | System Root | 200 OK, version, documentation URLs | ✅ Verified |
| `test_health_endpoint` | System Health | Safe status check without leaking secret credentials | ✅ Verified |
| `test_jobs_unauthenticated_requests` | Security | 401 Unauthorized rejection on missing Bearer token | ✅ Verified |
| `test_payments_and_reminders_unauthenticated` | Security | 401 Unauthorized rejection on payments and reminders | ✅ Verified |
| `test_bolna_tools_endpoint` | Bolna Voice | 7 function calling tool schemas registered | ✅ Verified |
| `test_bolna_session_unconfigured` | Bolna WebRTC | 503 Service Unavailable when keys absent from env | ✅ Verified |
| `test_jobs_invalid_token` | Auth Verification | 401 Unauthorized on invalid/forged Bearer token | ✅ Verified |
| `test_job_create_schema_validation` | Financial Validation | Rejection of negative amounts, empty names, excess paid | ✅ Verified |
| `test_job_service_unconfirmed_rejected` | Workflow | Rejection of unconfirmed job creation | ✅ Verified |
| `test_payment_excess_rejected` | Math Integrity | Payment exceeding remaining balance rejected with 400 | ✅ Verified |
| `test_job_service_business_logic` | Job Lifecycle | Balance calculation and status auto-reconciliation | ✅ Verified |
| `test_job_update_requires_confirmation` | Job Workflow | Financial edits require explicit confirmation | ✅ Verified |
| `test_job_search_and_filter` | Job Search | Text search (`q`) and status filter verification | ✅ Verified |
| `test_payment_correction_deterministic` | Payment Audit | Corrections require confirmation; recalculates balance | ✅ Verified |
| `test_reminder_date_validation_and_lifecycle` | Reminders | Validates YYYY-MM-DD date format; toggle & delete | ✅ Verified |
| `test_dashboard_stats_calculation` | Dashboard Data | Deterministic KPI totals and 7-day earnings breakdown | ✅ Verified |
| `test_bolna_tool_execution_all_seven_tools` | Voice Tools | Execution of all 7 tools with read-back & confirmation | ✅ Verified |
| `test_cross_user_tenant_isolation` | Security / RLS | User A cannot access or tamper with User B's records | ✅ Verified |
| `test_bilingual_voice_recognition_heuristics`| Voice Recognition| English & Bengali numerical and entity extraction | ✅ Verified |

#### B. Bolna Voice `create_job` & Schema Suite (`test_bolna_create_job.py` — 10 Tests)
| Test Function | Target Scenario | Verification Details | Status |
|---|---|---|---|
| `test_bolna_create_job_unauthenticated` | Security Boundary | Voice tool rejects missing Bearer token with HTTP 401 | ✅ Verified |
| `test_bolna_create_job_requires_verbal_confirmation` | Confirmation Guard | `confirmed=False` generates readback; zero DB mutation | ✅ Verified |
| `test_bolna_create_job_user_cancellation` | Cancellation Handling | Technician denial prevents ledger commit | ✅ Verified |
| `test_bolna_create_job_ambiguous_or_missing_amounts` | Math Guardrails | Rejects zero, negative, non-numeric & excess paid | ✅ Verified |
| `test_bolna_create_job_missing_required_fields` | Schema Integrity | Rejects missing/whitespace customer name or description | ✅ Verified |
| `test_bolna_create_job_status_validation` | Enum Enforcement | Validates status enum; rejects invalid values | ✅ Verified |
| `test_bolna_create_job_user_corrections` | Interactive Editing | Readback -> technician corrects amount -> confirmed save | ✅ Verified |
| `test_bolna_create_job_repeated_submission` | Idempotency | Duplicate submissions processed deterministically | ✅ Verified |
| `test_bolna_create_job_failed_database_request` | Honest Error Handling | DB failure reports error; never claims fake success | ✅ Verified |
| `test_bolna_tools_schema_endpoints` | Bolna Schema Export | Exports OpenAI tools & Bolna `custom_task` formats | ✅ Verified |

#### C. Bolna Voice Workflows (`test_bolna_workflows.py` — 10 Tests)
| Test Function | Target Tool | Verification Details | Status |
|---|---|---|---|
| `test_bolna_record_payment_unauthenticated` | `record_payment` | Unauthenticated voice request rejected with HTTP 401 | ✅ Verified |
| `test_bolna_record_payment_requires_verbal_confirmation` | `record_payment` | Generates readback; halts before mutating payment table | ✅ Verified |
| `test_bolna_record_payment_excess_rejected` | `record_payment` | Payment exceeding outstanding udhaar balance rejected | ✅ Verified |
| `test_bolna_record_payment_invalid_amount_or_job` | `record_payment` | Rejects missing job_id or zero/negative payment | ✅ Verified |
| `test_bolna_get_outstanding_balances_workflow` | `get_outstanding_balances` | Computes aggregate unpaid udhaar and debtor list | ✅ Verified |
| `test_bolna_create_reminder_workflow` | `create_reminder` | Enforces verbal confirmation; validates task & date | ✅ Verified |
| `test_bolna_list_jobs_workflow` | `list_jobs` | Filters technician jobs by status via voice | ✅ Verified |
| `test_bolna_list_reminders_workflow` | `list_reminders` | Retrieves technician reminders with completion filters | ✅ Verified |
| `test_bolna_correct_record_workflow` | `correct_record` | Requires verbal confirmation; executes field correction | ✅ Verified |
| `test_bolna_answer_ledger_question_workflows` | `answer_ledger_question` | Answers customer debts, earnings, and follow-ups | ✅ Verified |

#### D. End-to-End MVP Job Lifecycle (`test_end_to_end_mvp.py` — 1 Comprehensive Integration Test)
| Test Function | Scope | Verification Details | Status |
|---|---|---|---|
| `test_complete_fictional_job_lifecycle_workflow` | Complete Lifecycle (Steps 1–9) | 1. Speak job description & verify unconfirmed readback<br>2. Confirm & save job with deterministic balance (₹1200 agreed, ₹500 paid, ₹700 balance)<br>3. Record incremental partial payment (₹300 via UPI) -> balance updates to ₹400<br>4. Query outstanding balance -> verifies ₹400 debt for Suman Ghosh<br>5. Natural language queries answered accurately (udhaar, customer inquiries, collections)<br>6. Create follow-up reminder with confirmation and mark completed<br>7. Test corrections with confirmation guard<br>8. Test excess payment (₹500 on ₹400 balance) & negative amount rejections<br>9. Verify strict multi-tenant isolation (Technician 2 cannot view or query Technician 1 data) | ✅ Verified |

