# Start ApplyPilot AI v2 on Windows

## 1. Extract and open PowerShell in the project folder

```powershell
Copy-Item .env.example .env
```

## 2. Install packages

```powershell
npm install
npx playwright install chromium
```

## 3. Start MongoDB

With Docker Desktop:

```powershell
docker compose up -d
```

Or use your existing local MongoDB and edit `MONGO_URI` in `.env`.

## 4. Create sample data

```powershell
npm run seed
```

## 5. Start API + frontend

```powershell
npm run dev
```

Open http://localhost:5173

## 6. Configure in this order

Profile -> Resumes -> Sources -> Discover -> Matches.

For web discovery add `SERPER_API_KEY` to `.env`. For AI matching/answers add `GEMINI_API_KEY`.

## 7. Autofill a chosen job

Copy the command shown on the job card, for example:

```powershell
npm run autofill -- --job 68c...
```

Review everything in the opened browser and click Submit yourself.
