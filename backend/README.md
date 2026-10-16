# KaamSaathi Backend (FastAPI + Supabase)

FastAPI REST backend with Supabase PostgreSQL, Row Level Security (RLS), and Bolna AI Voice tool calling integration for the KaamSaathi field technician application.

---

## 📁 Architecture & Directory Structure

```
backend/
├── app/
│   ├── main.py              # Application entrypoint, CORS, route mounting, & uvicorn runner
│   ├── config.py            # Pydantic BaseSettings, .env loader, environment flags
│   ├── database.py          # Supabase client singleton & auth re-exports
│   ├── schemas/             # Pydantic validation models (Job, Payment, Reminder, Bolna)
│   ├── routes/              # Modular API endpoints (jobs, payments, reminders, dashboard, bolna)
│   ├── services/            # Core business logic, reconciliation, calculations, tool executors
│   └── dependencies/        # FastApi dependency injection (auth validation, Supabase client)
├── tests/                   # Pytest automated test suite (19 test cases)
├── requirements.txt         # Production and testing Python dependencies
├── pytest.ini               # Pytest configuration and pythonpath resolution
├── .env.example             # Backend environment template
└── README.md                # This documentation
```

---

## 🛠️ Prerequisites

- **Windows 10/11**
- **Python 3.11+** installed and available on PATH
- **PowerShell 5.1+** or **PowerShell 7+**
- A **Supabase** account and project (for PostgreSQL database & Auth)
- *(Optional)* **Bolna AI** account (for conversational voice calls)

---

## 1. Environment Setup (Windows PowerShell)

Open PowerShell and navigate to the backend directory:

```powershell
cd backend
```

### Create a Python Virtual Environment

```powershell
python -m venv venv
```

### Activate the Virtual Environment

```powershell
.\venv\Scripts\Activate.ps1
```

> **Note**: If you encounter an execution policy error (`running scripts is disabled on this system`), run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> .\venv\Scripts\Activate.ps1
> ```

### Install Dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 2. Supabase Configuration & Migrations

1. In your [Supabase Dashboard](https://supabase.com/dashboard), navigate to **SQL Editor**.
2. Run the migration scripts located at the project root `supabase/migrations/` in sequence:
   - `001_create_jobs_table.sql`
   - `002_create_customers_table.sql`
   - `003_create_payment_events_table.sql`
   - `004_create_reminders_table.sql`
   - `005_create_audit_events_table.sql`
3. Obtain your Supabase API credentials:
   - Navigate to **Project Settings** -> **API**.
   - Copy **Project URL** (`SUPABASE_URL`).
   - Copy **anon / public key** (`SUPABASE_KEY`).
4. Copy `.env.example` to `.env` inside `backend/`:
   ```powershell
   Copy-Item .env.example .env
   ```
5. Configure `.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=eyJhbGciOi...your-anon-key
   ENVIRONMENT=development
   HOST=127.0.0.1
   PORT=8000
   FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   
   # Optional Bolna Voice Agent Credentials
   # BOLNA_API_KEY=bn-your-secret-api-key
   # BOLNA_AGENT_ID=your-agent-uuid
   ```

---

## 3. Run the Backend Server

With the virtual environment activated inside `backend/`:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or from the repository root:
```powershell
backend\venv\Scripts\uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## 4. API Verification & Testing

- **Root info**: `http://127.0.0.1:8000/`
- **Health check**: `http://127.0.0.1:8000/health`
- **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`
- **Interactive ReDoc**: `http://127.0.0.1:8000/redoc`

### Run Automated Tests

From the `backend/` directory:
```powershell
.\venv\Scripts\pytest tests -v
```

From workspace root:
```powershell
backend\venv\Scripts\pytest backend/tests -v
```

---

## 5. Security & Quality Assurance Guarantees

1. **Identity Derivation**: `owner_id` is never trusted from request body or query parameters; it is derived strictly from verified Supabase JWT Bearer tokens (`auth.get_user(token)`).
2. **Row Level Security (RLS)**: Client PostgREST sessions carry the authenticated user's JWT, enforcing `auth.uid() = owner_id` across all database operations.
3. **Financial Invariants**: Decimal-safe math guarantees agreed amounts > 0, amount paid <= agreed amount, and balances cannot be overpaid.
4. **Explicit Confirmation**: Financial mutations (job creations, updates to charges, and payment entries) strictly require `confirmed: true`.
