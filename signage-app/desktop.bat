@echo off
cd /d "%~dp0"

if not exist "node_modules\.bin\electron.cmd" (
  echo [ERROR] node_modules not found. Run: npm install
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  echo [ERROR] Python venv not found. Run install.bat first.
  pause
  exit /b 1
)

echo [INFO] Starting FindWay Agent...
call node_modules\.bin\electron.cmd .

if errorlevel 1 (
  echo [ERROR] Electron exited with an error.
  pause
)
