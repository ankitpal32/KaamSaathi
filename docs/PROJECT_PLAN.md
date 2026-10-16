# KaamSaathi — Master Project Plan

> **Document Version**: 1.0.0  
> **Target Release**: MVP v1.0.0  
> **Methodology**: Milestone-driven incremental delivery with strict verification gates.

---

## 1. Project Overview & Delivery Strategy

KaamSaathi is delivered through six phased milestones, ensuring that each phase produces a fully verifiable, non-breaking artifact before progressing to the next.

```
Step 1: Frontend Prototype (DONE)
   │
   ▼
Step 2: Bolna Voice Integration Interface (DONE)
   │
   ▼
Step 2.5: Project Management & Documentation Setup (CURRENT)
   │
   ▼
Step 3: FastAPI Backend + Verified Job API (IN PROGRESS)
   │
   ▼
Step 4: Supabase Schema, Auth & Multi-Entity Ledger (PLANNED)
   │
   ▼
Step 5: Voice Function Calling & Webhooks (PLANNED)
   │
   ▼
Step 6: Testing, Production Deployment & Demo (PLANNED)
```

---

## 2. Milestone Breakdown & Deliverables

### Milestone 1: Frontend Prototype & Ergonomics
- **Status**: ✅ **Done**
- **Deliverables**:
  - High-contrast, mobile-first responsive dashboard (`DashboardView.tsx`).
  - Searchable and filterable jobs ledger (`JobsView.tsx`).
  - Payment collection and balance breakdown modal (`RecordPaymentModal.tsx`).
  - Follow-up reminder scheduler (`RemindersView.tsx`).
  - Bilingual English/Bengali localization dictionary (`locales/translations.ts`).
- **Acceptance Criteria**:
  - [x] All views render cleanly on mobile (<768px) and desktop (1024px+).
  - [x] Zero layout shift during navigation transitions.
  - [x] Local storage persistence keeps mock data intact across browser refreshes.

---

### Milestone 2: Bolna Voice Agent & WebRTC Interface
- **Status**: ✅ **Done**
- **Deliverables**:
  - Integrated `@bolna/web-call` SDK client (`src/services/bolnaVoiceService.ts`).
  - Voice assistant modal with live volume meters and call status indicators (`VoiceAssistantModal.tsx`).
  - Browser Speech Recognition fallback mode with heuristic entity parser (`src/services/voiceParser.ts`).
  - Quick-scenario presets for realistic technician voice testing.
- **Acceptance Criteria**:
  - [x] Voice modal cycles through idle, connecting, active, and ended states.
  - [x] Offline fallback extracts customer name, trade, amount, and payment from sample speech.
  - [x] Job confirmation card allows manual adjustments prior to saving.

---

### Milestone 2.5: Project Governance, Architecture & Documentation
- **Status**: 🟢 **In Progress (Active)**
- **Deliverables**:
  - Standardized governance docs: `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`.
  - Engineering specifications: `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_SPEC.md`.
  - Testing & DevOps guides: `TEST_PLAN.md`, `ENVIRONMENT_SETUP.md`, `DEVELOPMENT_LOG.md`, `DECISIONS.md`.
  - Comprehensive roadmap: `ROADMAP.md`, `PROJECT_PLAN.md`.
- **Acceptance Criteria**:
  - [x] All internal file links and markdown references verified.
  - [x] Zero discrepancy between documentation claims and physical codebase.
  - [x] Clear isolation established between verified features and planned features.

---

### Milestone 3: FastAPI Backend & Verified Job API
- **Status**: 🟡 **In Progress (Backend Scaffolding Complete, DB Integration Blocked)**
- **Deliverables**:
  - FastAPI application structure (`main.py`, `config.py`, `database.py`, `schemas.py`, `routes/jobs.py`, `services/jobs.py`).
  - Python virtual environment with dependencies installed.
  - Endpoints: `GET /`, `GET /health`, `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/{job_id}`.
  - Automated unit test suite (`backend/tests/test_api.py`).
  - Frontend client service (`src/services/jobApi.ts`) and status ribbon in `App.tsx`.
- **Acceptance Criteria**:
  - [x] All endpoints pass automated Pytest suite (7/7 passed).
  - [x] Unauthenticated calls strictly return `401 Unauthorized`.
  - [x] Monetary validation prevents zero, negative, or excessive payments.
  - [ ] **Pending User Action**: User supplies Supabase credentials in `backend/.env` to verify real cloud persistence.

---

### Milestone 4: Supabase Schema, Auth & Multi-Entity Ledger
- **Status**: ⏳ **Planned**
- **Deliverables**:
  - Supabase Auth integration (email/magic link or phone OTP).
  - Production tables for `customers`, `payments`, and `reminders`.
  - Row Level Security (RLS) policies on all tables.
  - Automated database migration runner or Supabase CLI workflow.
- **Acceptance Criteria**:
  - [ ] Technicians cannot read, write, or delete another technician's records.
  - [ ] Balances computed deterministically in database or backend.

---

### Milestone 5: Voice Function Calling & Webhook Automation
- **Status**: ⏳ **Planned**
- **Deliverables**:
  - Backend Bolna session minting endpoint (`POST /api/bolna-session`).
  - Webhook / function-calling endpoint for Bolna agent (`POST /api/bolna/tools/save_job`).
  - Bolna prompt configuration and JSON schema registration.
- **Acceptance Criteria**:
  - [ ] Spoken confirmation logs a job into PostgreSQL without manual typing.
  - [ ] Voice assistant verbally confirms the calculated remaining balance.

---

### Milestone 6: Quality Assurance, Deployment & Demo Preparation
- **Status**: ⏳ **Planned**
- **Deliverables**:
  - Full end-to-end integration test harness.
  - Production containerization (Dockerfile for FastAPI).
  - Vercel/Netlify frontend deployment and Cloud Run / Railway backend deployment.
  - Video walkthrough and demonstration scripts.
- **Acceptance Criteria**:
  - [ ] Zero critical security vulnerabilities or credential leaks.
  - [ ] Page load under 1.5 seconds on simulated 4G mobile connection.

---

## 3. Risk Management & Mitigation Matrix

| Risk | Impact | Probability | Mitigation Strategy |
|---|---|---|---|
| **R-1: Token Expiration / Unauthenticated Technicians** | High | Medium | Graceful fallback to LocalStorage demo mode with clear UI banner; never crash the app. |
| **R-2: Voice Recognition Errors with Accents** | High | High | Mandatory visual confirmation step before saving; editable draft card for quick correction. |
| **R-3: Currency Calculation Rounding Errors** | High | Low | Enforce 2 decimal places (`Decimal(12, 2)`) across Pydantic schemas and PostgreSQL DDL. |
| **R-4: Network Interruption on Job Site** | Medium | High | Offline first caching in local storage; queue operations for background synchronization. |
| **R-5: Secret Key Leaks in Client Code** | Critical | Low | Strict `.gitignore` enforcement; all AI and voice API keys maintained exclusively in backend. |

---

## 4. Verification & Gate Checklist

Before advancing to any subsequent milestone:
1. `npm run lint` must pass with 0 errors.
2. `npm run build` must produce a valid production bundle.
3. `pytest backend/tests/ -v` must execute with 100% passing tests.
4. `PROJECT_STATUS.md` must be updated with newly verified achievements.
