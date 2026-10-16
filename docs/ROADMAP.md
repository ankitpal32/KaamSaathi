# KaamSaathi — Comprehensive Engineering Roadmap

> **Target Release**: MVP v1.0.0  
> **Status**: Synchronized with `PROJECT_STATUS.md` and `docs/PROJECT_PLAN.md`

---

## Roadmap Overview

```
[Step 1: Frontend UI] ──────────► [Step 2: Bolna Voice SDK] ────► [Step 2.5: Architecture & Docs]
      (COMPLETED)                          (COMPLETED)                        (COMPLETED)
                                                                                   │
                                                                                   ▼
[Step 6: Deploy & Demo] ◄─────── [Step 5: Voice Functions] ◄──── [Step 4: Auth & Multi-Entity] ◄── [Step 3: FastAPI & Job API]
      (PLANNED)                            (PLANNED)                          (PLANNED)                   (IN PROGRESS)
```

---

## Detailed Step Breakdown

### Step 1: Frontend Prototype & Core UX
- **Status**: ✅ **Done**
- **Objectives**:
  - High-contrast, mobile-first responsive dashboard for Indian technicians.
  - Searchable, status-filtered Jobs ledger.
  - Payment collection modal with Cash, UPI, and Bank Transfer support.
  - Follow-up reminder manager.
  - Bilingual localization dictionary (English and Bengali).
  - Client-side persistence using `localStorage`.

---

### Step 2: Bolna Voice Agent & WebRTC Interface
- **Status**: ✅ **Done**
- **Objectives**:
  - Wire official `@bolna/web-call` SDK client for WebRTC voice streaming.
  - Create interactive `VoiceAssistantModal` with audio visualizer and call states.
  - Provide an offline Web Speech API entity parsing fallback for local development.
  - Build technician quick-fill scenario presets.

---

### Step 2.5: Project Management & Documentation Setup
- **Status**: ✅ **Done (Current Milestone)**
- **Objectives**:
  - Author and synchronize core governance files: [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md), [`PROJECT_STATUS.md`](../PROJECT_STATUS.md).
  - Create detailed specifications in `docs/`:
    - [`docs/PROJECT_PLAN.md`](PROJECT_PLAN.md): Milestone criteria and risk management.
    - [`docs/ARCHITECTURE.md`](ARCHITECTURE.md): System topology and Mermaid diagrams.
    - [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md): PostgreSQL entities, constraints, and RLS.
    - [`docs/API_SPEC.md`](API_SPEC.md): REST endpoints, parameters, and payloads.
    - [`docs/TEST_PLAN.md`](TEST_PLAN.md): Test harness and scenario coverage.
    - [`docs/DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md): Verifiable execution log.
    - [`docs/DECISIONS.md`](DECISIONS.md): Architecture Decision Records (ADRs).
    - [`docs/ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md): Windows setup manual and Supabase checklist.
    - [`docs/ROADMAP.md`](ROADMAP.md): Synchronized roadmap.

---

### Step 3: FastAPI Backend & First Verified Job API
- **Status**: 🟡 **In Progress (Backend Scaffolding Complete, Supabase Credentials Blocked)**
- **Objectives**:
  - [x] Build modular FastAPI application (`main.py`, `config.py`, `database.py`, `schemas.py`, `routes/jobs.py`, `services/jobs.py`).
  - [x] Implement decimal-safe financial validation and mandatory confirmation gates.
  - [x] Author Supabase PostgreSQL migration script with RLS (`001_create_jobs_table.sql`).
  - [x] Implement test suite with 100% passing tests (`backend/tests/test_api.py`).
  - [x] Build frontend API client service (`src/services/jobApi.ts`) with live status ribbon.
  - [ ] **Next Step**: User provisions Supabase credentials in `backend/.env` to verify persistent cloud writes.

---

### Step 4: Supabase Schema, Authentication & Multi-Entity Ledger
- **Status**: ⏳ **Planned**
- **Objectives**:
  - Implement Supabase Auth (Magic Link or Phone OTP) for real technician logins.
  - Create database tables and RLS policies for `customers`, `payments`, and `reminders`.
  - Replace mock payment recording with backend API integration (`POST /api/payments`).
  - Replace mock reminder scheduling with backend API integration (`POST /api/reminders`).
  - Enable automatic debt status recalculations on job entities via PostgreSQL triggers.

---

### Step 5: Voice Function Calling & Webhook Automation
- **Status**: ⏳ **Planned**
- **Objectives**:
  - Build backend session minting endpoint (`POST /api/bolna-session`) using `BOLNA_API_KEY`.
  - Create webhook endpoint for Bolna tool execution (`POST /api/bolna/tools/save_job`).
  - Configure Bolna agent system prompt in Bengali and English to confirm details prior to tool invocation.
  - Verify end-to-end voice flow: technician speaks -> Bolna extracts details -> technician says "Confirm" -> backend creates persistent PostgreSQL record.

---

### Step 6: Testing, Production Deployment & Demo Preparation
- **Status**: ⏳ **Planned**
- **Objectives**:
  - Execute end-to-end integration test suite.
  - Containerize FastAPI backend with Docker.
  - Deploy frontend to Vercel/Netlify with CDN caching.
  - Deploy backend to Cloud Run / Railway.
  - Record video demonstration showing both offline demo mode and live voice-to-database persistence.
