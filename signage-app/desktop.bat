@echo off
chcp 65001 >nul
title FindWay Agent - Desktop

cd /d "%~dp0"

:: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

:: Check Electron
if not exist "node_modules\electron" (
    echo [INFO] Installing Electron (~100MB, one-time)...
    echo DO NOT close this window
    call npm install
)

:: Start backend
echo [INFO] Starting backend...
start "FindWay Backend" /MIN venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

:: Wait for backend
echo Waiting for backend...
:wait
timeout /t 2 >nul
curl -s http://127.0.0.1:8765/api/health >nul 2>&1
if %errorlevel% neq 0 goto wait

:: Start Electron (loads backend URL only, no process management)
echo [INFO] Starting Electron...
start "" "node_modules\.bin\electron.cmd" .

echo.
echo FindWay Agent Desktop is running.
echo Backend: http://127.0.0.1:8765
echo Close this window does not stop the backend or Electron.
pause
