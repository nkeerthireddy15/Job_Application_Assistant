# ApplyPilot AI v2

A local-first job discovery and application-assistance dashboard for software roles.

## What v2 does

- Imports published jobs from Greenhouse, Lever, Ashby and Workable career boards.
- Optional Serper-powered web discovery for public job links from LinkedIn, Indeed, Naukri, Wellfound and company career pages.
- Deduplicates jobs by URL and ranks them against your profile.
- Uses a deterministic local matcher by default; optionally blends Gemini semantic scoring.
- Stores multiple resumes and recommends the best resume for each job.
- Generates truthful application-question answers from your saved profile.
- Tracks New, Shortlisted, Applied, Interview, Rejected and Offer states.
- Runs a daily collection task while the API server is running.
- Detects interview/recruiting signals from pasted email text and optionally scans Gmail using a supplied OAuth access token.
- Playwright autofill fills recognizable fields and attaches the recommended resume.
- Intentionally never clicks the final application Submit/Apply button and never attempts CAPTCHA bypass.

## Stack

React 19 + Vite, Node.js + Express, MongoDB/Mongoose, Playwright, optional Gemini REST API, optional Serper API.

## Quick start (Windows PowerShell)

```powershell
Copy-Item .env.example .env
npm install
npx playwright install chromium
docker compose up -d
npm run seed
npm run dev
```

Open http://localhost:5173

If you already have MongoDB running locally, you can skip Docker.

## Recommended first-time setup

1. Open **Profile** and enter your real job-search details.
2. Open **Resumes** and upload at least one resume. Add role/skill tags so ApplyPilot can route resumes.
3. Open **Sources** and add ATS feeds you care about.
4. Optionally put `SERPER_API_KEY` in `.env` for broader public-link discovery.
5. Optionally put `GEMINI_API_KEY` in `.env` for semantic rescoring and better application answers.
6. Open **Discover** and run the collector.
7. In **Matches**, open a job, review the listing, then copy the autofill command.

## Adding ATS sources

Use the token visible in a company's hosted careers URL:

- Greenhouse: `https://boards.greenhouse.io/COMPANY_TOKEN` -> type `greenhouse`, value `COMPANY_TOKEN`
- Lever: `https://jobs.lever.co/SITE` -> type `lever`, value `SITE`
- Ashby: `https://jobs.ashbyhq.com/BOARD_NAME` -> type `ashby`, value `BOARD_NAME`
- Workable: `https://apply.workable.com/SUBDOMAIN` -> type `workable`, value `SUBDOMAIN`

ApplyPilot uses published/public job endpoints. Do not add private recruiter/admin API credentials.

## Optional web discovery

Set:

```env
SERPER_API_KEY=your_key
```

The collector builds role/location searches for public pages on LinkedIn, Indeed, Naukri, Wellfound, and company careers sites. It stores search-result links/snippets; it does not log into those platforms or bypass bot protections.

## Optional Gemini matching

Set:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

When **Gemini semantic rescoring** is enabled, final score is blended from local matching (55%) and AI matching (45%). If Gemini fails, the local score remains usable.

## Multiple resumes

Upload resumes under **Resumes** with tags such as:

- `MERN / Full Stack`: React, Node.js, MongoDB, Next.js
- `React Native`: React Native, Android, iOS
- `Frontend`: React, Next.js, JavaScript, TypeScript

The autofill runner uses the job's recommended resume.

## Application-answer assistant

Open a job -> **Application answers** -> paste a question. Answers are based only on your saved profile and job text. Review/edit before use.

## Autofill

From a job card, copy:

```powershell
npm run autofill -- --job JOB_ID
```

The browser opens visibly, fills recognizable fields, and attaches the recommended resume. You must review the page and submit manually.

## Daily scheduler

The API checks once per minute and runs once on the configured local-server time:

```env
DAILY_DISCOVERY_ENABLED=true
DAILY_DISCOVERY_HOUR=7
DAILY_DISCOVERY_MINUTE=0
DISCOVERY_MIN_SCORE=55
DISCOVERY_MAX_JOBS=500
```

The server must be running at that time. For always-on scheduling, deploy the API or use Windows Task Scheduler to start it.

## Gmail signal scan

The **Email signals** tab always supports pasted-email analysis. The optional Gmail scan expects a valid OAuth access token:

```env
GMAIL_ACCESS_TOKEN=...
```

The current implementation is intentionally a hook, not a full Google OAuth UI. Access tokens expire; for production use, add refresh-token OAuth storage.

## Scripts

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run seed
npm test
npm run autofill -- --job JOB_ID
```

## Safety / reliability choices

ApplyPilot does not automate logins, defeat CAPTCHA, hide browser automation, or blindly submit applications. Job sites change frequently, and application questions can materially affect candidacy. The tool automates discovery, ranking, repetitive form entry, and preparation while keeping the final submission decision with you.
