# AGENTS.md — Developer & AI Agent Guide (OpenAI Codex / Cloud Agents)

This repository contains **マッスルメモ 2.0 (Muscle Memo 2.0)**, a Progressive Web App (PWA) smart workout tracker with AI coaching powered by Google Gemini.

## 1. Quick Commands

```bash
# Install dependencies
npm install

# Run ESLint (must pass with 0 errors and 0 warnings)
npm run lint

# Build production bundle into docs/ (for GitHub Pages)
npm run build

# Start development server
npm run dev
```

## 2. Tech Stack & Architecture

- **Framework**: React 19 + Vite 7 (`type: "module"`)
- **Styling**: Tailwind CSS + `clsx` + `tailwind-merge` + `lucide-react` + `framer-motion`
- **AI Integration**: `@google/genai` (`src/services/gemini.js`), supporting multiple Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, etc.) and 4 distinct coach personas (`all-might`, `demon`, `gentle`, `professional`) with offline local fallback triggers.
- **Training Science Engine** (`src/lib/trainingEngine.js`):
  - Calculates estimated 1RM (Epley formula), mesocycle progression (4-week periodization), RIR (Reps in Reserve) targets, and compound vs. isolation rest intervals.
- **Mobile & PWA Capabilities**:
  - `public/manifest.json` & `public/sw.js`: Full offline-ready PWA with network-first caching and `SKIP_WAITING` instant update detection (`src/hooks/useMobileFeatures.js`).
  - **Screen Wake Lock API**: Prevents smartphone screen dimming during active sessions and interval timers.
  - **Haptics & Native Notifications** (`src/lib/audio.js`): Web Audio API synthetic countdown/alarm beeps, Web Vibration API haptics, and Service Worker notifications.
  - **Cross-Device Sync** (`src/services/mobileSync.js` & `src/components/Mobile/MobileSyncModal.jsx`):
    - Serverless compressed URL token transfer (`#sync=z...` using `CompressionStream('deflate-raw')`) with non-destructive workout session merging.
    - Optional LAN bridge endpoints (`/api/network-info`, `/api/sync-state`) injected by `vite.config.js` during local dev/preview.

## 3. Data Storage & Conventions

- **Local Storage Keys**:
  - `muscle-memo-workouts`: Array of horizontal session records (`{ id, date, timestamp, part, exercise, set1_weight, set1_reps, set1_rir, set1_form, set1_interval, ... }`, up to 30 sets per exercise per day).
  - `muscle-memo-user`: User display name.
  - `muscle-memo-gemini-key`: User's Gemini API key (stored strictly client-side).
  - `muscle-memo-gemini-model`: Selected Gemini model ID.
  - `muscle-memo-coach`: Active coach persona ID.
  - `muscle-memo-custom-exercises`: Custom exercises per body part (`胸`, `背中`, `肩`, `脚`, `腕`).
- **Date Handling**:
  - Always use `getLocalDateKey(timestamp)` from `src/lib/utils.js` (`YYYY-MM-DD` in local timezone) instead of `toISOString().split('T')[0]` to avoid UTC/JST date boundary bugs.
- **Asset Paths**:
  - Always use relative paths (`./icon.svg`, `./coach_all_might.png`, `./sw.js`, `./manifest.json`) and `base: './'` in `vite.config.js` so the app works seamlessly on GitHub Pages subpaths (`https://<user>.github.io/<repo>/`) as well as root domains.
- **ESLint Rules**:
  - `eslint-plugin-react-hooks` v7 is enabled (`react-hooks/set-state-in-effect` is enforced). Avoid calling `setState` synchronously inside `useEffect` bodies; always run `npm run lint` before committing.

## 4. Deployment (GitHub Pages)

- GitHub Pages serves directly from the `docs/` folder on the `main` branch (`https://imim100913-cell.github.io/muscle-memo-2/`).
- After making code changes (e.g. in OpenAI Codex), run `npm run lint` and `npm run build` so `docs/` is updated before committing and pushing to `main`.
