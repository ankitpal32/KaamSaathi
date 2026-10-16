# KaamSaathi — REST API Specification

> **Base URL**: `http://127.0.0.1:8000` (Local) / Configurable via `VITE_API_BASE_URL`  
> **Protocol**: HTTPS (Production) / HTTP (Local Development)  
> **Content-Type**: `application/json`  
> **Status Overview**:  
> - System, Jobs, Payments, Reminders, and Bolna Session APIs: **Implemented & Verified in Step 3**

---

## 1. Authentication Scheme

Protected endpoints require a standard HTTP Authorization header carrying a verified Supabase JWT access token:

```http
Authorization: Bearer <supabase_access_token>
```

- If the header is missing: HTTP `401 Unauthorized` with `WWW-Authenticate: Bearer`.
- If the token is invalid or expired: HTTP `401 Unauthorized`.
- If Supabase environment variables are missing: HTTP `503 Service Unavailable`.

---

## 2. Implemented Endpoints

### 2.1 System Endpoints

#### `GET /` — API Welcome & Root Information
- **Auth**: None
- **Response**: `200 OK`
```json
{
  "message": "Welcome to KaamSaathi API",
  "version": "1.0.0",
  "docs_url": "/docs",
  "health_url": "/health",
  "status": "running"
}
```

#### `GET /health` — Configuration Health Check
- **Auth**: None
- **Description**: Returns operational health without leaking secret keys, credentials, or URLs.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "app_name": "KaamSaathi Backend API",
  "version": "1.0.0",
  "database_configured": true,
  "environment": "development"
}
```

---

### 2.2 Jobs Endpoints

#### `POST /api/jobs` — Create a Confirmed Job
- **Auth**: Required (`Bearer <token>`)
- **Validation Rules**:
  - `customer_name`: String, 1–100 chars, non-whitespace.
  - `description`: String, 1–500 chars, non-whitespace.
  - `agreed_amount`: Decimal, strictly `> 0`.
  - `amount_paid`: Decimal, `>= 0` and `<= agreed_amount`.
  - `trade`: Enum (`electrical`, `plumbing`, `appliance`, `other`).
  - `confirmed`: Boolean, **must be `true`**; rejects unconfirmed speech drafts with 400.
- **Request Body**:
```json
{
  "customer_name": "Suman Ghosh",
  "customer_phone": "+91 98301 44210",
  "trade": "electrical",
  "description": "Ceiling fan bearing repair & capacitor replacement",
  "agreed_amount": 1200.00,
  "amount_paid": 500.00,
  "notes": "Promised remaining balance on Friday",
  "confirmed": true
}
```
- **Response**: `201 Created`

#### `GET /api/jobs` — List Authorized Jobs
- **Auth**: Required (`Bearer <token>`)
- **Description**: Returns jobs belonging strictly to the authenticated `owner_id`.
- **Response**: `200 OK`

#### `GET /api/jobs/{job_id}` — Get Single Authorized Job
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK` (if owned by user), `404 Not Found` (if missing or owned by another user).

---

### 2.3 Payments Endpoints

#### `POST /api/jobs/{job_id}/payments` — Record Payment Event
- **Auth**: Required (`Bearer <token>`)
- **Validation Rules**:
  - `amount`: Decimal strictly `> 0` and `<= remaining unpaid balance`.
  - `payment_mode`: Enum (`cash`, `upi`, `bank_transfer`).
  - `confirmed`: Boolean, must be `true`.
- **Request Body**:
```json
{
  "amount": 700.00,
  "payment_mode": "upi",
  "notes": "UPI transfer via PhonePe",
  "confirmed": true
}
```
- **Response**: `201 Created`
```json
{
  "id": "e9c2b1a3-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "owner_id": "8f3e2b1a-9c4d-4e5f-a6b7-c8d9e0f1a2b3",
  "job_id": "7b8e1f54-0b1a-4c2d-9e6a-93f548d12345",
  "amount": "700.00",
  "payment_mode": "upi",
  "notes": "UPI transfer via PhonePe",
  "recorded_at": "2026-10-15T18:00:00Z"
}
```

#### `GET /api/jobs/{job_id}/payments` — List Payments for a Job
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK` (list of payment events).

#### `GET /api/payments` — List All Payments for Technician
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK` (list of all payment events across jobs).

#### `POST /api/payments/{payment_id}/correct` — Correct a Payment Entry
- **Auth**: Required (`Bearer <token>`)
- **Validation**:
  - `new_amount`: Decimal > 0, cannot cause job payments to exceed agreed amount.
  - `reason`: String explaining correction.
  - `confirmed`: Boolean, must be `true`.
- **Response**: `200 OK` (updated payment event with reconciled job remaining balance).

---

### 2.4 Reminders Endpoints

#### `POST /api/reminders` — Schedule Customer Follow-up
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "task": "Test microwave heating and collect balance",
  "due_date": "2026-10-18",
  "job_id": "7b8e1f54-0b1a-4c2d-9e6a-93f548d12345",
  "trade": "appliance",
  "priority": "urgent"
}
```
- **Response**: `201 Created`

#### `GET /api/reminders` — List Reminders
- **Auth**: Required (`Bearer <token>`)
- **Query Params**: `include_completed=true|false`
- **Response**: `200 OK` (list of reminders sorted by due date).

#### `PATCH /api/reminders/{reminder_id}/toggle` — Toggle Reminder Completion
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK` (updated reminder with new `is_completed` boolean).

#### `DELETE /api/reminders/{reminder_id}` — Delete a Reminder
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK`

---

### 2.5 Dashboard Statistics Endpoints

#### `GET /api/dashboard/stats` — Deterministic Dashboard Metrics
- **Auth**: Required (`Bearer <token>`)
- **Response**: `200 OK`
```json
{
  "total_jobs": 12,
  "total_agreed": 18500.0,
  "total_collected": 14200.0,
  "total_outstanding": 4300.0,
  "pending_jobs_count": 4,
  "completed_jobs_count": 8,
  "upcoming_reminders_count": 3,
  "weekly_earnings": [
    {"date": "2026-10-15", "day": "Thu", "amount": 2400.0, "jobs_count": 2}
  ]
}
```

---

### 2.6 Bolna Voice Integration Endpoints

#### `GET /api/bolna/tools` — Get Tool Contracts
- **Auth**: None
- **Response**: `200 OK` (returns 7 registered JSON schemas for Bolna agent).

#### `POST /api/bolna-session` — Mint Bolna WebRTC Session
- **Auth**: None / Optional Bearer
- **Description**: Secure backend proxy using `BOLNA_API_KEY` to mint short-lived WebRTC session credentials. Returns `503 Service Unavailable` if credentials are not configured in `backend/.env`.

#### `POST /api/bolna/tools/execute` — Execute Function Call
- **Auth**: Required (`Bearer <token>`)
- **Description**: Validates tool arguments, enforces technician confirmation on financial actions, performs read-backs, and executes verified tool actions (`create_job`, `list_jobs`, `record_payment`, `get_outstanding_balances`, `create_reminder`, `list_reminders`, `correct_record`).
- **Response**: `200 OK`
```json
{
  "success": true,
  "requires_confirmation": false,
  "readback": null,
  "message": "Payment of ₹700 recorded. Updated balance: ₹0.",
  "result": { ... }
}
```
