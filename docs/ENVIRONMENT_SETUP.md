# KaamSaathi — Windows & Environment Setup Guide

> **Target Platform**: Windows 10/11 (PowerShell 5.1+ or PowerShell Core 7+)  
> **Development Stack**: Node.js 18+ & Python 3.11  
> **Architecture**: Two-Folder Application Layout (`frontend/` and `backend/`)

---

## 1. System Requirements & Toolchain

Ensure the following tools are installed and accessible from Windows PowerShell:

1. **Python 3.11**:
   Verify via PowerShell:
   ```powershell
   python --version
   # Expected output: Python 3.11.x
   ```
2. **Node.js & npm**:
   Verify via PowerShell:
   ```powershell
   node --version
   npm --version
   # Expected: Node v18+ and npm v9+
   ```
3. **PowerShell Execution Policy**:
   If script execution is disabled, allow local signed scripts:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   ```

---

## 2. Step-by-Step Local Setup

### Step 2.1: Frontend Setup & Build

Open a PowerShell terminal:

```powershell
# Navigate to the frontend directory
cd C:\Users\ankit\Desktop\kaamsaathi\frontend

# Install dependencies
npm install

# Verify TypeScript type integrity
npm run lint

# Test production build
npm run build

# Start Vite development server
npm run dev
# Accessible at http://localhost:3000
```

### Step 2.2: Backend Setup & Testing

Open a second PowerShell terminal:

```powershell
# Navigate to the backend directory
cd C:\Users\ankit\Desktop\kaamsaathi\backend

# Create virtual environment in backend/venv
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip and install required dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run backend automated test suite (19 test cases)
pytest tests -v

# Start FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# API Docs available at http://127.0.0.1:8000/docs
```

---

## 3. Environment Variables & Secret Configuration

### 3.1 Backend Configuration (`backend/.env`)
Create `backend/.env` from the provided template:
```powershell
cd C:\Users\ankit\Desktop\kaamsaathi\backend
Copy-Item .env.example .env
```

Edit `backend/.env` with your editor:
```env
# ==============================================================================
# Supabase Cloud Database Configuration
# ==============================================================================
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_KEY=eyJhbGciOi...<your-anon-or-service-key>

# Server Configuration
ENVIRONMENT=development
HOST=127.0.0.1
PORT=8000

# CORS Allowed Frontend Origins (Comma-separated)
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Optional Bolna Voice Agent Configuration
# BOLNA_API_KEY=bn-your-secret-api-key
# BOLNA_AGENT_ID=your-agent-uuid
```

> **Security Rule**: NEVER commit `backend/.env` to Git. The `.gitignore` file excludes all `.env` files.

### 3.2 Frontend Configuration (`frontend/.env`)
Create `frontend/.env` from the provided template:
```powershell
cd C:\Users\ankit\Desktop\kaamsaathi\frontend
Copy-Item .env.example .env
```

```env
# Backend API Base URL (must be backend origin, never an API key)
VITE_API_BASE_URL=http://127.0.0.1:8000

# Bolna WebRTC Voice Session URL (routed through backend to protect API keys)
VITE_BOLNA_SESSION_URL=http://127.0.0.1:8000/api/bolna-session
```

---

## 4. Supabase Cloud Configuration Checklist

Follow this checklist to provision your PostgreSQL database on Supabase:

- [ ] **1. Create Project**: Go to [supabase.com](https://supabase.com), log in, and create a new project.
- [ ] **2. Retrieve Project URL & Keys**:
  - Open **Project Settings** -> **API**.
  - Copy the **Project URL** into `backend/.env` as `SUPABASE_URL`.
  - Copy the **anon / public key** into `backend/.env` as `SUPABASE_KEY`.
- [ ] **3. Run Migration Scripts**:
  - Open the **SQL Editor** in the Supabase dashboard.
  - Run the scripts in [`supabase/migrations/`](../supabase/migrations/) in sequence:
    1. `001_create_jobs_table.sql`
    2. `002_create_customers_table.sql`
    3. `003_create_payment_events_table.sql`
    4. `004_create_reminders_table.sql`
    5. `005_create_audit_events_table.sql`
  - Click **Run** for each script.
- [ ] **4. Verify Tables & RLS**:
  - Go to **Table Editor** -> `jobs`.
  - Verify that columns (`id`, `owner_id`, `customer_name`, `agreed_amount`, `amount_paid`, `remaining_balance`, `status`) exist.
  - Verify that the shield icon indicates **RLS is Enabled**.

---

## 5. Verification Commands Summary

```powershell
# 1. Run backend unit tests from backend/
cd C:\Users\ankit\Desktop\kaamsaathi\backend
.\venv\Scripts\pytest tests -v

# 2. Check frontend type safety from frontend/
cd C:\Users\ankit\Desktop\kaamsaathi\frontend
npm run lint

# 3. Test production frontend build from frontend/
npm run build

# 4. Start backend dev server
cd C:\Users\ankit\Desktop\kaamsaathi\backend
.\venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 5. Start frontend dev server
cd C:\Users\ankit\Desktop\kaamsaathi\frontend
npm run dev
```
