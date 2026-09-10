$ErrorActionPreference = "Stop"
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm install
npx playwright install chromium
Write-Host "Dependencies installed. Next: docker compose up -d; npm run seed; npm run dev" -ForegroundColor Green
