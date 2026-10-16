# KaamSaathi: Voice-First Workday Assistant for Independent Technicians

KaamSaathi is a voice-first workday companion engineered specifically for independent field technicians in India (electricians, plumbers, and appliance repair specialists). It simplifies day-to-day work tracking, payment collection, and follow-up management through rapid voice logging, clear financial arithmetic, and a high-contrast mobile-first responsive dashboard.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience preferences have been incorporated based on your choices:

- **Confirmed Trade Focus**: Multi-trade technician mix featuring electrical wiring/repairs, plumbing fixes, and AC servicing. Realistic sample data will span all three domains.
- **Confirmed Voice Architecture**: Interactive microphone support using the browser's native **Web Speech API** (`webkitSpeechRecognition`/`SpeechRecognition`) with an instant text-input fallback, realistic audio visualizer waves, and quick-fill technician scenario presets (e.g. *"I repaired Suman's fan for ₹1,200. He paid ₹500."*).
- **Confirmed Navigation Pattern**: Ergonomic mobile bottom navigation bar on handheld screens ($<768\text{px}$) expanding smoothly into a desktop sidebar on larger displays ($1024\text{px}+$ and $1440\text{px}$ viewports).
- **No Mock Backend or Real Cloud Keys**: Fully client-side architecture using `localStorage` persistence and deterministic JavaScript math for all balances. Structured cleanly so future Bolna Voice AI and FastAPI endpoints can be dropped in without redesigning UI components.

---

## 1. Overview & Core Concept

- **What It Does**: Provides technicians with an effortless, hands-free way to log completed jobs, record partial/full cash or UPI payments, track unpaid customer balances, and maintain follow-up service reminders while on the move or with dirty hands on site.
- **Target Audience / Persona**: Independent Indian technicians, handymen, and field contractors who manage their own billing, customer calls, and scheduling without formal accounting software.
- **Key Value**: Eliminates lost earnings and forgotten follow-ups by replacing messy paper diaries and memory with a simple voice-driven workflow and instant financial clarity in Rupees (₹).

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Dashboard Overview**: Technician opens the app, sees warm greeting (*“Namaste! Ready for your workday?”*), top KPI summary (Today's Jobs, Pending Payments, Upcoming Follow-ups), today's scheduled jobs, overdue payments, and a 7-day earnings trend chart powered by Recharts.
2. **Voice Job Logging Flow**:
   - Technician taps the prominent microphone button or selects a quick scenario preset.
   - States cycle seamlessly: **Idle** $\rightarrow$ **Listening** (animated soundwave rings) $\rightarrow$ **Processing** (analyzing transcript) $\rightarrow$ **Confirmation** (editable breakdown sheet showing Customer Name, Trade Category, Description, Agreed Amount ₹, Amount Paid ₹, Remaining Balance ₹).
   - Once confirmed, job and initial payment are saved to `localStorage`, showing a **Success** toast and immediately updating the Dashboard and Jobs tabs.
3. **Jobs Ledger Flow**:
   - Filter jobs by status (`All`, `Pending Payment`, `Completed & Paid`, `In Progress`).
   - Search by customer name, phone number, or work description.
   - Add new jobs manually or edit existing records with live balance calculation.
4. **Payments & Cashflow Ledger**:
   - Overview cards: Total Billed, Total Collected, Outstanding Market Credit (Udhaar).
   - Tap any customer with outstanding balance to record a new partial payment (Cash / UPI / Bank transfer), automatically reducing the remaining balance to ₹0 when cleared.
5. **Customer Reminders**:
   - Add follow-up reminders (e.g., *"AC gas leak inspection for Ramesh Ji in 3 days"*).
   - Toggle completed reminders or remove them; clearly labeled due dates.
6. **Bilingual Support**:
   - One-tap language toggle between **English** and **বাংলা (Bengali)** for all major navigation labels, greetings, status tags, and metric headers.

### Visual Identity & Theme

- **Aesthetic Direction**: Modern, clean, trustworthy SaaS dashboard built for outdoor legibility and single-handed touch usability.
- **Color Palette**:
  - *Dominant Canvas (60%)*: Warm white / soft ivory canvas (`#F8F9FA` / `#FAF9F6`), light slate surface cards (`#FFFFFF`).
  - *Structural Surfaces (30%)*: Border lines (`#E2E8F0`), muted labels (`#64748B`), dark slate typography (`#0F172A`).
  - *Deep Indigo Accents (10%)*: Deep indigo primary buttons and active indicators (`#4338CA` / `#3730A3`), with emerald for fully collected payments (`#16A34A`) and amber for pending balances (`#D97706`).
- **Typography & Formatting**:
  - Crisp modern typography paired with strict tabular figures (`tabular-nums`) for all monetary amounts (`₹1,200`), dates, and job counts.
  - Zero-pill discipline: Clean text separators (`·` and `/`) for metadata; no decorative pulsing dots or pseudo-technical code headers.
- **Ergonomics & Touch Targets**:
  - Touch targets $\ge 44\text{px} \times 44\text{px}$.
  - Mobile bottom tab bar strictly within thumb zone; floating action mic button positioned for thumb reach.

---

## 3. Key Product Decisions & Trade-Offs

- **Deterministic Financial Arithmetic**:
  - *Decision*: Balances are strictly computed using explicit JavaScript math (`remainingBalance = Math.max(0, agreedAmount - amountPaid)`).
  - *Why*: Technicians must trust their numbers. Financial figures are never estimated or left to unstructured text parsing.
- **Voice Recognition with Smart Local Heuristic Parser**:
  - *Decision*: Combine browser Web Speech API with an intelligent local entity extractor (regex/pattern matcher for amounts like ₹1200 / 1200 rupees, customer names, and common trade terms), supported by a manual fallback editor.
  - *Why*: Allows instantaneous, offline-capable simulation without external server dependencies or API rate limits, while demonstrating the exact UX workflow needed for production Bolna integration.
- **Persistent Local State**:
  - *Decision*: Store all jobs, payments, and reminders in `localStorage` with a pre-seeded realistic dataset for Kolkata/Bengaluru multi-trade technicians.
  - *Why*: Provides immediate, rich interactivity upon launch, survives page reloads, and includes a "Reset Demo Data" option.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              KaamSaathi                                │
│                     (App.tsx / LanguageContext)                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Desktop Nav    │      │  Active View     │      │  Mobile Bottom   │
│ (Left Sidebar)   │      │  (Main Router)   │      │  Tab Bar         │
└──────────────────┘      └────────┬─────────┘      └──────────────────┘
                                   │
      ┌────────────────┬───────────┼───────────┬────────────────┐
      ▼                ▼           ▼           ▼                ▼
┌───────────┐    ┌───────────┐ ┌───────┐ ┌───────────┐    ┌───────────┐
│ Dashboard │    │   Voice   │ │ Jobs  │ │ Payments  │    │ Reminders │
│  + Charts │    │ Assistant │ │ Ledger│ │  Ledger   │    │  Manager  │
└─────┬─────┘    └─────┬─────┘ └───────┘ └─────┬─────┘    └───────────┘
      │                │                       │
      │                ▼                       │
      │         ┌───────────────┐              │
      │         │ Voice Modal / │              │
      │         │ Job Confirm   │              │
      │         └───────┬───────┘              │
      │                 │                      │
      └─────────────────┴──────────┬───────────┴────────────────┘
                                   ▼
                      ┌─────────────────────────┐
                      │    Storage Service      │
                      │  (localStorage CRUD)    │
                      └─────────────────────────┘
```

### Core Entities

- **Job**:
  - `id`: string
  - `customerName`: string
  - `customerPhone`: string
  - `trade`: `'electrical' | 'plumbing' | 'appliance' | 'other'`
  - `description`: string
  - `agreedAmount`: number
  - `amountPaid`: number
  - `remainingBalance`: number
  - `date`: string (ISO date)
  - `status`: `'pending' | 'partially_paid' | 'completed' | 'in_progress'`
  - `notes`?: string
- **PaymentRecord**:
  - `id`: string
  - `jobId`: string
  - `customerName`: string
  - `amount`: number
  - `paymentMode`: `'cash' | 'upi' | 'bank_transfer'`
  - `date`: string
- **Reminder**:
  - `id`: string
  - `customerName`: string
  - `jobId`?: string
  - `task`: string
  - `dueDate`: string
  - `isCompleted`: boolean
  - `trade`: string

---

## 5. Implementation Roadmap

1. **Package Installation**: Install `recharts` for the dashboard weekly earnings and job distribution charts.
2. **Types & Storage Store**: Create typed data interfaces, default seed data (realistic Indian technician jobs across Kolkata/Delhi/Bengaluru), and localStorage helper functions with reset capability.
3. **Localization System**: Simple lightweight dictionary for English and বাংলা (Bengali).
4. **Voice Assistant Component**:
   - Web Speech API integration with microphone permission handling.
   - Multi-state visualizer (Idle, Listening, Processing, Confirmation, Success, Error).
   - Audio waveform animation using Tailwind / CSS motion.
   - Preset technician voice scenario chips for quick testing.
   - Pre-save editable confirmation sheet with auto-calculated balance.
5. **Dashboard View**:
   - Namaste greeting header with today's date and language switch.
   - 3 Summary KPI cards (Today's Jobs, Pending Payments, Upcoming Follow-ups).
   - Weekly earnings bar/area chart using Recharts.
   - Today's active job card list with quick status toggles.
   - Pending balance callout list with 1-click payment trigger.
   - Quick reminders list.
6. **Jobs View**:
   - Multi-trade search and status filter tabs.
   - Add Job modal with instant balance preview.
   - Edit / View Job modal with customer contact link (`tel:`).
7. **Payments View**:
   - Total Agreed, Total Collected, Outstanding balance metrics.
   - Collect Payment modal (Cash, UPI, Transfer) with instant math validation.
   - Payment history transaction feed.
8. **Reminders View**:
   - Task list grouped by Today, Upcoming, and Completed.
   - Quick Add reminder modal with preset technician intervals (Tomorrow, 3 days, 1 week).
9. **Polishing & Verification**:
   - Responsive verification (mobile 375px thumb layout $\rightarrow$ desktop 1440px wide layout).
   - Accessibility and keyboard navigation checks.
   - Compilation and error-free build verification.
