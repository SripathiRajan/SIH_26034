@echo off
title PRAMAN v4 Public Cloud Backend
cls
echo ======================================================================
echo    PRAMAN v4 -- Starting AI Backend + Free Public Cloudflare Tunnel
echo ======================================================================
echo.
echo [1/2] Launching Python 3.11 FastAPI Backend on port 8000...
start "PRAMAN API Server" py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
timeout /t 3 /nobreak >nul
echo.
echo [2/2] Opening Secure Cloudflare HTTPS Tunnel...
echo Look for the link ending in .trycloudflare.com below:
echo ======================================================================
echo.
.\cloudflared.exe tunnel --url http://localhost:8000
pause
