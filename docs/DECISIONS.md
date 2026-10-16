# KaamSaathi — Architecture Decision Records (ADRs)

> **Document Version**: 1.0.0  
> **Status**: Active Reference

---

## ADR-001: Deterministic Financial Arithmetic vs LLM Calculation

- **Context**: When technicians speak a job summary (e.g. *"Suman's fan was ₹1200, he paid ₹500"*), the system must compute the unpaid balance and update ledgers.
- **Decision**: All financial subtraction, summation, and balance status transitions are strictly performed by deterministic code (`agreed_amount - amount_paid`) using Pydantic `Decimal` on the backend and JavaScript arithmetic on the client. Generative AI is solely used for entity extraction (speech-to-intent).
- **Alternatives Considered**: Allowing the LLM to output the calculated remaining balance directly.
- **Rationale**: LLMs can hallucinate math, especially with currency symbols and local dialect numbers. Technicians will lose trust if an invoice calculation is inaccurate.
- **Validation Status**: ✅ Verified in `backend/tests/test_api.py` and frontend modals.

---

## ADR-002: Mandatory User Confirmation Step Before Saving

- **Context**: In hands-free voice workflows, ambient background noise on a noisy construction site or misrecognized words could create false entries.
- **Decision**: Jobs cannot be persisted to the database without explicit confirmation (`confirmed == true`). The UI presents an editable breakdown sheet and requires confirmation before the save payload is dispatched.
- **Alternatives Considered**: Auto-saving speech directly to the ledger as soon as speech pauses.
- **Rationale**: An errant entry could result in incorrect billing, missed collection of debts, or erroneous customer records.
- **Validation Status**: ✅ Enforced in `backend/services/jobs.py` (rejects unconfirmed jobs with HTTP 400) and in `src/components/JobModal.tsx`.

---

## ADR-003: Row Level Security (RLS) over Application-Only Filtering

- **Context**: The database holds customer phone numbers, home addresses, and financial balances. We must ensure technician records remain isolated.
- **Decision**: Enforce tenant isolation directly in PostgreSQL using Supabase Row Level Security (`auth.uid() = owner_id`). Application queries forward the user's JWT so the database engine guarantees that no technician can read or modify another's records.
- **Alternatives Considered**: Disabling RLS and filtering exclusively with `WHERE owner_id = :id` in Python application code.
- **Rationale**: Application-level filtering is vulnerable to developer oversight, SQL injection, or misconfigured queries. RLS provides defense-in-depth at the data layer.
- **Validation Status**: 🟡 Migration script prepared; requires live Supabase project to verify multi-tenant isolation.

---

## ADR-004: Dual-Mode Voice Architecture (Live WebRTC + Local Speech Recognition)

- **Context**: Technicians frequently work in basements or areas with fluctuating mobile internet.
- **Decision**: Implement a hybrid voice interface:
  1. Primary: `@bolna/web-call` SDK for live bi-directional WebRTC voice calls with AI agents.
  2. Fallback: Browser native `webkitSpeechRecognition` combined with a local regex entity parser for offline voice demos.
- **Alternatives Considered**: Requiring live WebRTC internet connection at all times.
- **Rationale**: Guarantees the application remains interactive and testable even when offline or when third-party cloud voice services are unavailable.
- **Validation Status**: ✅ Both interfaces active in `VoiceAssistantModal.tsx`.

---

## ADR-005: Backend Secret Isolation & Ephemeral SIP Session Minting

- **Context**: The Bolna Voice SDK requires API credentials to establish WebRTC calls.
- **Decision**: Never place `BOLNA_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in frontend source code or client `.env` files. The frontend requests an ephemeral session via `POST /api/bolna-session`, where the backend authenticates the user and contacts Bolna to mint short-lived credentials.
- **Alternatives Considered**: Hardcoding the Bolna API key in frontend Vite environment variables.
- **Rationale**: Hardcoded client keys can be extracted by inspecting the JavaScript bundle, risking API quota exhaustion and financial liabilities.
- **Validation Status**: ⏳ Architecture designed; backend session route scheduled for Milestone 5.

---

## ADR-006: Clean Two-Folder Restructuring (`frontend/` and `backend/app/`)

- **Context**: The repository previously mingled frontend configuration files (`package.json`, `vite.config.ts`, `tsconfig.json`) in the workspace root alongside root documentation, while backend modules lived directly in `backend/` without a standard package namespace.
- **Decision**: Segregate the repository into two distinct primary application directories:
  1. `frontend/`: React 19 + Vite + TypeScript + Tailwind CSS application with its own dependencies, assets, build artifacts, and client environment configuration.
  2. `backend/`: FastAPI + Python application structured under the `app/` subpackage (`app.main`, `app.config`, `app.database`, `app.routes`, `app.services`, `app.dependencies`), with isolated virtual environment, test suite (`tests/`), and server environment configuration.
  3. Authoritative PostgreSQL migrations remain centralized at root `supabase/migrations/`. Shared engineering rules, architectural documentation, and project plans remain in root `docs/`, `AGENTS.md`, and `README.md`.
- **Alternatives Considered**: Monolithic root layout or a complex monorepo tooling suite (Turborepo/Nx).
- **Rationale**: Isolates Node.js and Python toolchains, eliminates dependency leakage, makes containerization straightforward, and enforces client/server secret isolation.
- **Validation Status**: ✅ Verified via `npm run build` in `frontend/` (418ms) and `pytest tests -v` in `backend/` (19/19 passed in 0.82s).

---

## Decisions Requiring Future Validation
1. **Offline Sync Queue Strategy**: When offline jobs are logged in `localStorage`, what conflict resolution policy should be used when the technician reconnects to the network? (Planned for Milestone 6).
2. **Authentication Method**: Phone Number OTP via Twilio/Supabase SMS vs WhatsApp login for non-technical tradespeople (Scheduled for review in Milestone 4).

