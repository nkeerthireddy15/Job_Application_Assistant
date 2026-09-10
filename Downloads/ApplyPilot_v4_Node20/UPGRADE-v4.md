# ApplyPilot v4 - Node 20.12.1

Based on your uploaded v2 source.

## Changes
- Pins React 18.3.1, Vite 5.4.14 and @vitejs/plugin-react 4.3.4 for Node 20.12.1.
- Removes the old lock file; `npm install` creates a fresh compatible one.
- Preserves Serper, Gemini, email signals, scheduler, ATS imports, matching, resume selection and application answers.
- Adds public-search discovery for Cutshort, Instahyre, Hirist and YC startup jobs.
- Adds source-priority scoring and dashboard source filters.
- LinkedIn uses conservative Assist Mode: no Easy Apply/Next/Review/Submit clicks.

## Start on Windows
```powershell
Copy-Item .env.example .env
npm install
npx playwright install chromium
docker compose up -d
npm run seed
npm run dev
```
Open http://localhost:5173

Cutshort, Instahyre, Hirist and YC are discovered through Serper/public search results; this build does not scrape login-protected pages. Direct ATS integrations remain Greenhouse, Lever, Ashby and Workable.
