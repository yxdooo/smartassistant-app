# 🚀 SmartAssistant: Privacy-First Personal Life OS

<div align="center">
  <p><strong>An Intelligent Financial Runway, Nutritional Telemetry & Biometric Life OS</strong></p>
  <img src="https://img.shields.io/badge/React-19-blue.svg?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-PWA-purple.svg?style=for-the-badge&logo=vite" alt="Vite PWA" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-v24-green.svg?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Prisma-ORM-1B2228.svg?style=for-the-badge&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/AI-BYOK%20%26%20SmartEngine-orange.svg?style=for-the-badge&logo=openai" alt="BYOK AI" />
</div>

<br />

**SmartAssistant** is an open-source, full-stack Personal Life OS engineered to give individuals complete command over their daily finances, health metrics, and habits. Built with privacy-first architecture, it pairs local offline-first storage with optional frontier intelligence.

Instead of artificial intelligence hype, SmartAssistant is designed around **tangible utility**: tracking your real daily financial runway, calculating metabolic burn rates and macronutrients, monitoring fasting cycles, and running a **Bring Your Own Key (BYOK)** AI engine with an automatic deterministic fallback.

---

## ⚡ Core Architecture & Engineering Highlights

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React 19 + Vite)                 │
│  - 3D Three.js Visualizer        - WebAuthn Biometrics (FaceID) │
│  - Financial Runway Gauges       - PWA Offline Background Sync  │
│  - Macro Progress Bars           - Web Speech Voice Interface   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ REST API (JSON)
┌─────────────────────────────────▼───────────────────────────────┐
│                    Backend Server (Node.js & Express)           │
│  - Prisma ORM Data Layer         - Tesseract.js OCR Engine      │
│  - Telemetry Context Aggregator  - WebAuthn Hardware Server     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  BYOK AI Engine (Gemini/OAI) │        │ Built-in SmartEngine Fallback│
│ - Live context injection     │        │ - Zero API keys required     │
│ - Deep contextual advice     │        │ - Deterministic calculations │
└──────────────────────────────┘        └──────────────────────────────┘
```

### 1. 🧠 Dual-Mode AI Architecture (BYOK & Fallback)
* **Bring Your Own Key (BYOK):** Users can enter their personal Google Gemini or OpenAI API key in Settings. The server aggregates live financial and health telemetry into a structured system prompt, enabling frontier conversational analysis without consuming developer API quotas.
* **Deterministic SmartEngine:** If no key is provided—or if an external API rate-limits—the engine automatically falls back to an offline-capable, rule-based algorithm that calculates exact daily budgets, macros, and fasting progress in GitHub Markdown.
* **Live Connection Validator:** Built-in `/api/ai/validate-key` endpoint to verify credentials instantly.

### 2. 💸 Financial Runway & Safe Daily Burn Rate
* **Daily Spending Allowance:** Dynamically calculates `(Remaining Budget / Days Remaining in Month)` to provide a concrete, daily pacing target.
* **Timeline vs. Budget Gauge:** Visualizes month elapsed versus percentage of budget spent to immediately detect pacing drift.
* **3D Category Visualizer:** Interactive 3D financial overview built with Three.js and `@react-three/fiber`.
* **Receipt OCR Parsing:** Extract total expense amounts directly from paper receipts using backend `Tesseract.js`.

### 3. 🥗 Nutritional & Health Telemetry
* **Macronutrient Tracking:** Real-time tracking and progress bars for Protein (g), Carbohydrates (g), and Dietary Fats (g) against goal targets.
* **TDEE & BMR Calculations:** Automated caloric calculations using the clinical Mifflin-St Jeor formula based on biometric profile and activity level.
* **16:8 Fasting Protocol:** Integrated fasting timer with live elapsed hours, circular SVG progress, and 16-hour completion notifications.
* **Hydration Tracker:** 8-glass water tracker with quick one-click increment.

### 4. 🧬 Hardware Biometrics & Offline-First PWA
* **WebAuthn Passwordless Login:** Authenticate using TouchID, FaceID, or Windows Hello via `@simplewebauthn`.
* **Progressive Web App (PWA):** Service Worker precaching with Workbox Background Sync ensures data logged while offline syncs automatically once connectivity returns.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, Tailwind CSS, Framer Motion, Three.js, React Three Fiber, Recharts, Lucide Icons, canvas-confetti, react-joyride |
| **Backend** | Node.js (v20+), Express.js, Prisma ORM, SQLite / PostgreSQL, JWT, bcrypt |
| **Security & Auth** | WebAuthn (`@simplewebauthn/server` & `@simplewebauthn/browser`), Token Authentication |
| **Intelligence** | Google Gemini REST API, OpenAI REST API, SmartEngine Deterministic Analyzer, Tesseract.js OCR |
| **PWA & Offline** | Vite Plugin PWA, Workbox Background Sync |
| **Internationalization** | `i18next` & `react-i18next` (English & Turkish) |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **npm** or **yarn**

### 1. Clone & Install
```bash
git clone https://github.com/yxdooo/smartassistant-app.git
cd smartassistant-app
```

### 2. Configure Backend
```bash
cd backend
npm install

# Initialize SQLite database with Prisma schema
npx prisma db push

# (Optional) Seed initial exercise and category data
node seed_exercises.js

# Start backend server (Port 5000)
npm run dev
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install

# Start Vite development server (Port 5173)
npm run dev
```

### 4. Open in Browser
Visit **`http://localhost:5173`**.
- Sign up for a new account or sign in with:
  - **Email:** `test@example.com`
  - **Password:** `password123`
- Open **Settings** (⚙️) to configure Biometrics or connect your optional **Google Gemini / OpenAI** API key.
- Open the bottom-right **SmartBot** to test live contextual queries.

---

## 📡 API Overview

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Public service health check |
| `/api/auth/register` | `POST` | User registration with initial biometric profile |
| `/api/auth/login` | `POST` | Password login returning JWT |
| `/api/auth/webauthn/*` | `GET/POST`| WebAuthn registration and authentication challenge flow |
| `/api/auth/profile` | `GET/PUT` | Retrieve or update user telemetry and AI preferences |
| `/api/budget` | `GET/POST`| Log and list expenses |
| `/api/budget/forecast` | `GET` | Calculate monthly forecast and daily average spending |
| `/api/budget/scan-receipt` | `POST` | Tesseract.js OCR endpoint for uploaded receipt images |
| `/api/calorie/summary` | `GET` | Calorie and macronutrient daily digest |
| `/api/tracker/water` | `POST` | Hydration glass counter |
| `/api/tracker/fasting` | `POST` | Start/stop fasting session |
| `/api/ai/validate-key` | `POST` | Test validity of a custom Gemini or OpenAI key |
| `/api/ai/chat` | `POST` | Context-aware AI chat with automatic SmartEngine fallback |

---

## 🔒 Privacy

SmartAssistant is built with a strict offline-first, local-storage architecture:

- **Local Storage:** All financial runway numbers, logged meals, and hydration data are stored exclusively in your local storage / Anna storage (`smartassistant:v1`). No data is sent to external servers or telemetry services.
- **Data Retention & Auto-Pruning:** Entries older than 120 days are automatically deleted to keep your storage lightweight.
- **Full Data Wipe:** You can permanently delete all stored profile targets and entries at any time via the "Delete all my data" button in Settings.
- **Medical Disclaimer:** Calorie, macronutrient, and metabolic burn estimates use the clinical Mifflin-St Jeor formula and are for informational purposes only, not medical advice.

---

## 📄 License
This project is open-source and released under the **MIT License**.


---

## SmartAssistant on Anna

The `anna/` directory is a separate build of SmartAssistant for [Anna](https://anna.partners). It is a small static app plus a Python Executa, and it does not need the backend in `backend/` or the React app in `frontend/`. Those still work on their own.

What the Anna app does:

- A one-minute setup (budget, fixed costs, weight, height, age, goal) that returns a safe daily spend and daily calorie, protein and water targets.
- Logging an expense, a meal or a glass of water in one or two taps.
- A weekly review of the last 7 days: spending against your weekly allowance, your biggest category, average calories and protein against target, and water goal days, followed by specific changes for next week. With fewer than 3 logged days it says so instead of guessing.

See [anna/README.md](anna/README.md) for development, tests, the Linux binary build and the publishing checklist.