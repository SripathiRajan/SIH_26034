# ==============================================================================
# PRAMAN v4 — Legal Metrology Compliance Inspection Platform
# Unified Monorepo Runner: Starts FastAPI Backend + Expo Web Frontend
# ==============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "        PRAMAN v4 — Legal Metrology AI System           " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/2] Launching PRAMAN FastAPI Backend (port 8000)..." -ForegroundColor Yellow

$backendScript = @"
`$Host.UI.RawUI.WindowTitle = 'PRAMAN Backend (Port 8000)'
Write-Host 'Starting PRAMAN v4 FastAPI Backend...' -ForegroundColor Green
py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Start-Sleep -Seconds 2

Write-Host "[2/2] Launching PRAMAN Expo Frontend (Web)..." -ForegroundColor Yellow

$frontendScript = @"
`$Host.UI.RawUI.WindowTitle = 'PRAMAN Frontend (Expo Web)'
Set-Location -Path '$PSScriptRoot\frontend'
Write-Host 'Starting Expo Web Frontend...' -ForegroundColor Cyan
npx expo start --web
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

Write-Host ""
Write-Host "✓ Both services launched in separate windows!" -ForegroundColor Green
Write-Host "   - Backend API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "   - Backend Health:    http://localhost:8000/health" -ForegroundColor White
Write-Host "   - Frontend UI (Web): http://localhost:19006 (or Expo browser tab)" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
