# 🚀 SmartAssistant Super App

<div align="center">
  <p><strong>A Next-Generation Personal Finance & Health Tracking Platform</strong></p>
  <img src="https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Vite-PWA-purple.svg?style=for-the-badge&logo=vite" alt="Vite PWA" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-Backend-green.svg?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Prisma-ORM-1B2228.svg?style=for-the-badge&logo=prisma" alt="Prisma" />
</div>

<br />

Welcome to **SmartAssistant**, a premium, full-stack application that acts as your personal life OS. It seamlessly combines intelligent budget tracking, calorie/health monitoring, and intermittent fasting tools into a single, beautiful "Super App". 

Engineered with modern technologies like WebAuthn (Biometrics), Offline-First Service Workers, and an AI-driven Voice Assistant, this project is built to demonstrate production-ready architectural skills.

## ✨ Key Features

- 🧬 **Biometric Passwordless Login:** Integrated WebAuthn (`@simplewebauthn`) allowing users to securely log in using FaceID, TouchID, or Windows Hello.
- 🎤 **Voice-Activated AI Bot:** Features a built-in assistant using the `SpeechRecognition` API. Simply speak to your assistant to get contextual data about your finances or health.
- 📡 **Offline-First (PWA):** Built as a Progressive Web App utilizing Workbox Background Sync. Lose connection? No problem. The app locally caches your inputs and syncs when you're back online.
- 🧊 **3D Data Visualization:** Real-time 3D interactive charts built with `Three.js` and `@react-three/fiber` for an immersive data overview.
- 🌍 **Global Leaderboard:** Track your consistency with the community! Integrated gamification via user Streaks and global ranking systems.
- 📸 **OCR Receipt Scanning:** Built-in receipt scanning utilizing `Tesseract.js` on the backend to automatically parse expenses.
- 💅 **Next-Gen UI/UX:** Styled with Tailwind CSS, Framer Motion, and custom glassmorphism effects for a deeply satisfying visual experience.
- 🌐 **Full i18n Support:** Fully translated into English and Turkish out of the box using `react-i18next`.

## 🛠️ Technology Stack

### Frontend
- **React 18 & Vite:** Lightning-fast HMR and optimized builds.
- **Tailwind CSS & Framer Motion:** For utility-first styling and buttery smooth animations.
- **Three.js & React Three Fiber:** For 3D budget visualization.
- **React Joyride:** For guided onboarding tours with custom glassmorphic tooltips.
- **Vite PWA Plugin:** Providing offline capabilities and background sync.

### Backend
- **Node.js & Express:** Robust REST API architecture.
- **Prisma ORM:** Type-safe database access (configured with SQLite for easy setup).
- **SimpleWebAuthn:** For managing passwordless biometric credentials.
- **Tesseract.js:** Optical Character Recognition (OCR) for receipts.

## 🚀 Getting Started

Follow these steps to get the project up and running locally.

### 1. Clone the repository
```bash
git clone https://github.com/your-username/smartassistant-super-app.git
cd smartassistant-super-app
```

### 2. Setup Backend
```bash
cd backend
npm install

# Setup Prisma Database
npx prisma db push

# Start the development server (runs on port 5000)
npm run dev
```

### 3. Setup Frontend
Open a new terminal window.
```bash
cd frontend
npm install

# Start the Vite development server (runs on port 5173)
npm run dev
```

### 4. Experience the App
Visit `http://localhost:5173` in your browser. 
- Try registering a new account.
- In Settings, enable **Biometric Login**.
- Turn off your internet connection via the Network tab and test the **Offline Sync** feature.
- Enjoy the beautiful **3D Chart** and **Voice Assistant**.

## 📄 License
This project is open-source and available under the MIT License.
