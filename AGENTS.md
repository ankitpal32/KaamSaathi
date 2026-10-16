# AGENTS.md — Engineering Rules & Operational Governance for KaamSaathi

> **Scope**: This document defines mandatory rules, architecture boundaries, coding standards, and operational guidelines for all AI agents, engineers, and contributors working on the KaamSaathi codebase.

---

## 1. Project Purpose & Core Philosophy

KaamSaathi is a mission-critical tool for independent Indian field technicians. Because it handles real-world earnings, daily job logs, and customer debts ("udhaar"):
- **Accuracy is non-negotiable**: Mathematical computations must be deterministic and verifiable.
- **Privacy & Safety First**: Customer phone numbers, addresses, and transaction logs must be protected by strict authorization boundaries.
- **Never Fake Working Features**: Do not simulate API responses in production paths, pretend authentication is verified when it is not, or claim a cloud integration is functional without automated or live confirmation.

---

## 2. Prime Directive for Code Modifications

1. **Inspect Before Modifying**:
   - Always run directory listings, grep searches, or view active files before proposing or writing code edits.
   - Understand existing patterns, types, and styling before introducing new constructs.
2. **Preserve Working Frontend Code**:
   - The UI, navigation, language toggle, and responsive layouts were intentionally designed. Do not rewrite components wholesale or break mobile usability.
3. **No Phantom Integrations**:
   - If a backend service or database credential is not configured, implement safe fallbacks with clear, honest status labels (e.g., "Demo Mode / LocalStorage"). Never display fake success messages for failed network calls.
4. **Mandatory Verification**:
   - Always verify TypeScript compilation (`npm run lint`), build integrity (`npm run build`), and Python tests (`pytest backend/tests/ -v`) after making code changes.

---

## 3. Architecture & Boundary Rules

1. **Frontend (`src/`)**:
   - **Framework**: React 19 + TypeScript.
   - **Styling**: Tailwind CSS v4. Maintain the warm ivory and indigo design system with high-contrast elements.
   - **State**: Keep business state cleanly isolated. API calls must live in `src/services/` and use configurable URLs (`VITE_API_BASE_URL`).
   - **Secret Isolation**: **NEVER** expose backend secret keys, database service-role keys, or Gemini/Bolna API secret keys in frontend code.
2. **Backend (`backend/`)**:
   - **Framework**: FastAPI with Python 3.11+.
   - **Design**: Layered architecture (`main.py` -> `routes/` -> `services/` -> `database.py` / `schemas.py`).
   - **Identity Derivation**: Never trust `owner_id` or user IDs supplied in the request body. Always derive user identity from the verified Supabase Bearer JWT token (`supabase.auth.get_user(token)`).
   - **Financial Validation**: All monetary numbers must use decimal validation (e.g., Pydantic `Decimal` with 2 decimal places). Reject zero or negative job charges. Reject payments exceeding agreed amounts.
3. **Database (`Supabase PostgreSQL`)**:
   - **Row Level Security (RLS)**: Must be enabled on all tables containing user or business data.
   - **Strict Ownership**: Use `auth.uid() = owner_id` on all CRUD policies.
   - **No Disabling RLS**: Never disable RLS or write `USING (true)` policies to make a test pass.

---

## 4. Coding Conventions & Folder Organization

### Directory Layout
```
kaamsaathi/
├── frontend/                # React 19 + TypeScript + Tailwind CSS application
│   ├── public/              # Static public assets
│   ├── src/                 # Application source code
│   │   ├── assets/          # Static media, icons, graphics
│   │   ├── components/      # Reusable view components and modals
│   │   ├── layouts/         # Page layout structures
│   │   ├── pages/           # High-level route views
│   │   ├── services/        # Client services (jobApi, storage, bolna, voiceParser)
│   │   ├── hooks/           # Custom React hooks (voice recording, Web Speech API)
│   │   ├── types/           # TypeScript interfaces and domain types
│   │   ├── utils/           # Formatting and arithmetic helpers
│   │   ├── locales/         # Translations (en, bn)
│   │   ├── App.tsx          # Main application component
│   │   ├── main.tsx         # DOM entrypoint
│   │   └── index.css        # Tailwind CSS styles
│   ├── index.html           # SPA entry point
│   ├── package.json         # Frontend dependencies and scripts
│   ├── package-lock.json    # Deterministic dependency lockfile
│   ├── tsconfig.json        # Strict TypeScript configuration
│   ├── vite.config.ts       # Vite + Tailwind configuration
│   ├── .env.example         # Client environment template
│   └── README.md            # Frontend guide
├── backend/                 # FastAPI + Python backend
│   ├── app/                 # Application package
│   │   ├── main.py          # Application entrypoint & CORS
│   │   ├── config.py        # Pydantic BaseSettings
│   │   ├── database.py      # Supabase client singleton & dependency re-exports
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── routes/          # API route modules (jobs, payments, reminders, dashboard, bolna)
│   │   ├── services/        # Business logic & DB operations
│   │   └── dependencies/    # FastAPI dependencies (auth, scoped db client)
│   ├── tests/               # Pytest test suite (19 passing unit & integration tests)
│   ├── requirements.txt     # Python dependencies
│   ├── pytest.ini           # Pytest pythonpath configuration
│   ├── .env.example         # Server environment template
│   └── README.md            # Backend setup and API guide
├── supabase/                # Cloud database specifications
│   └── migrations/          # Authoritative SQL migrations (001 to 005)
├── docs/                    # System specifications, architecture, and ADRs
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   ├── TEST_PLAN.md
│   ├── PROJECT_PLAN.md
│   ├── PROJECT_STATUS.md
│   ├── ROADMAP.md
│   ├── DECISIONS.md
│   ├── ENVIRONMENT_SETUP.md
│   └── DEVELOPMENT_LOG.md
├── .agents/                 # AI Agent instructions and governance
│   └── rules/               # Architectural, security, and testing rules
├── AGENTS.md                # This governance document
├── PROJECT_STATUS.md        # Current live state and task tracking
├── .gitignore               # Root git exclusions (node_modules, venvs, secrets)
├── .env.example             # Project-level environment template
└── README.md                # Top-level workspace overview
```

### TypeScript & React Standards
- Prefer explicit types over `any`.
- Keep components focused and modular (<350 lines where possible).
- Format currency strictly in Indian Rupee format (`₹{amount.toLocaleString('en-IN')}`) with tabular numerals (`font-mono tabular-nums`).

### Python & FastAPI Standards
- Follow PEP 8 formatting and type annotations.
- Use Pydantic v2 `BaseModel` for validation.
- Return explicit HTTP status codes (`status.HTTP_201_CREATED`, `status.HTTP_400_BAD_REQUEST`, `status.HTTP_401_UNAUTHORIZED`, `status.HTTP_404_NOT_FOUND`).

---

## 5. Security & Secret Management

- **Zero Secret Commits**: Check `.gitignore` before creating any files. Never write real API keys or DB passwords into source code.
- **Frontend Keys**: Only public, rate-limited tokens (like Supabase anon key or public Vite variables) are permitted in client bundles.
- **CORS**: Configure CORS strictly for verified local frontend origins (`http://localhost:3000`, `http://127.0.0.1:3000`). Never use wildcard `*` with credentials in production.

---

## 6. Testing & Quality Assurance Requirements

Every modification must be verified using the appropriate test harness:
1. **Backend Tests**: Run `pytest backend/tests/ -v`.
2. **Frontend Type Check**: Run `npm run lint` (`tsc --noEmit`).
3. **Frontend Build Check**: Run `npm run build`.
4. **Behavioral Checks**: If adding an endpoint, write a corresponding unit or integration test in `backend/tests/`.

---

## 7. Change Management & Documentation

Whenever a feature, endpoint, or architecture decision changes:
1. Update `PROJECT_STATUS.md` with the new state.
2. Log the change in `docs/DEVELOPMENT_LOG.md` with the date, files changed, and test outcomes.
3. If an architectural decision was made, create an entry in `docs/DECISIONS.md`.
