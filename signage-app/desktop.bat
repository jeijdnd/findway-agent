@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [INFO] Starting backend...
start "FindWay Backend" /MIN venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

echo [INFO] Waiting 5 seconds for backend...
timeout /t 5 /nobreak >nul

echo [INFO] Starting Electron...
start "" "node_modules\.bin\electron.cmd" .

echo Done. Backend: http://127.0.0.1:8765
pause
