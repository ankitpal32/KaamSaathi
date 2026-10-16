# KaamSaathi Frontend

> **Voice-First Workday Assistant & Multilingual Ledger for Field Technicians**

The frontend of KaamSaathi is built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Vite**. It provides a high-contrast, responsive interface designed for one-handed outdoor mobile operation with English and Bengali (বাংলা) support.

---

## 📁 Directory Structure

```
frontend/
├── public/                  # Static assets and favicons
├── src/
│   ├── assets/              # Static media, icons, and illustrations
│   ├── components/          # Reusable UI widgets, cards, and modals
│   ├── layouts/             # App shell and page layout wrappers
│   ├── pages/               # Page-level route views
│   ├── services/            # API client services (jobApi, storage, bolna, voiceParser)
│   ├── hooks/               # Custom React hooks (voice recording, speech recognition)
│   ├── types/               # TypeScript domain interfaces and types
│   ├── utils/               # Formatting, currency, and date helpers
│   ├── locales/             # English and Bengali localization dictionaries
│   ├── App.tsx              # Main application root component
│   ├── main.tsx             # DOM mounting entrypoint
│   └── index.css            # Tailwind CSS styling and theme setup
├── index.html               # Single-page application HTML entrypoint
├── package.json             # NPM package definitions and scripts
├── package-lock.json        # Deterministic dependency lockfile
├── tsconfig.json            # Strict TypeScript configuration
├── vite.config.ts           # Vite + Tailwind build configuration
├── .env.example             # Client environment template
└── README.md                # This documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### Installation

```powershell
cd frontend
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```powershell
cp .env.example .env
```

Configure your backend URL:
```env
VITE_API_BASE_URL="http://127.0.0.1:8000/api"
VITE_BOLNA_SESSION_URL="http://127.0.0.1:8000/api/bolna-session"
```

> **Security Note**: Never place privileged backend secrets, Supabase service-role keys, or private Bolna API keys into frontend `.env` files. Only `VITE_`-prefixed public variables are bundled into client code.

### Development Server

Run the local Vite development server:

```powershell
npm run dev
```

The application will be accessible at:
```
http://localhost:3000
```

### Type Checking & Build

Run strict TypeScript verification:
```powershell
npm run lint
```

Create an optimized production bundle in `dist/`:
```powershell
npm run build
```

Preview the production build locally:
```powershell
npm run preview
```

---

## 🎨 Design System & Guidelines

- **Typography**: Plus Jakarta Sans for UI readability, JetBrains Mono for numbers and transaction amounts.
- **Color Palette**: Warm ivory background (`#FBF9F5`), deep slate text, vibrant indigo primary accents, and emerald accents for payment completions.
- **Currency Formatting**: Format Indian Rupee values with `₹{amount.toLocaleString('en-IN')}` and tabular numerals (`font-mono tabular-nums`).
- **Offline & Connectivity Status**: When the backend is offline or unconfigured, the application renders honest empty states with clear connectivity indicators ("Live Supabase Ledger", "Awaiting Auth Token", "Backend Offline") rather than fabricating demo records or silent failures.
