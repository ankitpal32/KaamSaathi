# KaamSaathi (काम साथी / কাজ সাথী)

> **Voice-First Workday Assistant & Financial Ledger for Independent Technicians in India**

KaamSaathi is a mission-critical mobile web platform engineered for solo tradespeople—electricians, plumbers, and appliance repair technicians across India. It eliminates paper diaries, lost earnings, and forgotten follow-ups through bilingual voice logging, automated payment reconciliation, and customer relationship tracking.

---

## 📁 Repository Organization

The repository is organized into two primary applications with shared configuration, migrations, and documentation:

```
KaamSaathi/
├── frontend/                # React 19 + TypeScript + Tailwind CSS application
│   ├── public/              # Static assets and icons
│   ├── src/                 # Reusable components, pages, hooks, services, types
│   ├── index.html           # SPA entrypoint
│   ├── package.json         # Frontend dependencies and scripts
│   ├── vite.config.ts       # Vite + Tailwind build configuration
│   ├── tsconfig.json        # Strict TypeScript configuration
│   ├── .env.example         # Client environment template
│   └── README.md            # Frontend setup and developer guide
├── backend/                 # FastAPI + Python backend with Supabase & Bolna integration
│   ├── app/                 # Layered package (main, config, database, routes, services, dependencies)
│   ├── tests/               # Pytest automated test suite (19 passing unit & integration tests)
│   ├── requirements.txt     # Python dependencies
│   ├── pytest.ini           # Pytest pythonpath configuration
│   ├── .env.example         # Backend environment template
│   └── README.md            # Backend setup and API guide
├── supabase/                # Cloud database specifications
│   └── migrations/          # Authoritative PostgreSQL DDL migrations (001 to 005)
├── docs/                    # Architecture, API specifications, ADRs, test plans, and logs
│   ├── PROJECT_PLAN.md      # Milestones, deliverables, and acceptance criteria
│   ├── PROJECT_STATUS.md    # Real-time tracking of implemented and verified features
│   ├── ARCHITECTURE.md      # System, component, data flow, and voice architecture
│   ├── API_SPEC.md          # REST API endpoint documentation
│   ├── DATABASE_SCHEMA.md   # PostgreSQL schema, relations, constraints, and RLS policies
│   ├── TEST_PLAN.md         # Comprehensive test matrix and QA procedures
│   ├── ENVIRONMENT_SETUP.md # Windows PowerShell setup guide and secrets management
│   ├── DEVELOPMENT_LOG.md   # Chronological engineering log
│   └── DECISIONS.md         # Architecture Decision Records (ADRs)
├── .agents/                 # AI Agent instructions and governance
│   └── rules/               # Architectural, security, and testing rules
├── AGENTS.md                # System governance and engineering rules
├── PROJECT_STATUS.md        # Real-time state of the project
├── .gitignore               # Multi-language git ignore patterns
├── .env.example             # Project-level environment template
└── README.md                # This top-level overview
```

---

## 🚀 Quick Start Guide (Windows PowerShell)

### Prerequisites

- **Node.js**: v18.0.0+ (Tested on v24.21.0)
- **Python**: 3.11.x (Installed and available on Windows PATH)
- **PowerShell**: 5.1+ or PowerShell Core 7+

---

### 1. Frontend Setup & Execution

Open a terminal window:

```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server (runs on http://localhost:3000)
npm run dev

# Run TypeScript type verification
npm run lint

# Build production bundle
npm run build
```

---

### 2. Backend Setup & Execution

Open a second terminal window:

```powershell
# Navigate to the backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start the FastAPI server (runs on http://127.0.0.1:8000)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Run automated test suite
pytest tests -v
```

---

## 🌐 API & Documentation Links

Once the backend is running at `http://127.0.0.1:8000`:
- **API Root**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Interactive ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🔒 Security Architecture Highlights

1. **Strict User Ownership**: `owner_id` is derived server-side exclusively from verified Supabase JWT Bearer tokens (`auth.get_user(token)`). Body parameters cannot spoof record ownership.
2. **Row Level Security (RLS)**: Client database connections propagate user identity to ensure `auth.uid() = owner_id` at the database level.
3. **Deterministic Financial Validation**: Decimal-safe math prevents negative amounts, overpayments, or floating-point truncation.
4. **Explicit Confirmation**: Every job creation, charge adjustment, or payment requires `confirmed: true`.
5. **No Secret Leakage**: Secret keys (Supabase service role keys, Bolna API keys) are restricted to backend `.env` and never bundled into frontend builds.

---

## 📚 Project Documentation Index

- [Project Status & Health](PROJECT_STATUS.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Project Plan & Milestones](docs/PROJECT_PLAN.md)
- [Database Schema & RLS](docs/DATABASE_SCHEMA.md)
- [REST API Specification](docs/API_SPEC.md)
- [Quality Assurance & Test Plan](docs/TEST_PLAN.md)
- [Windows & Environment Setup Guide](docs/ENVIRONMENT_SETUP.md)
- [Development Audit Log](docs/DEVELOPMENT_LOG.md)
- [Architecture Decision Records (ADRs)](docs/DECISIONS.md)
- [Agent Governance & Engineering Rules](AGENTS.md)
