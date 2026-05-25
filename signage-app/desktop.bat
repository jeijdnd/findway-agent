@echo off
chcp 65001 >nul
title FindWay Agent - Desktop

cd /d "%~dp0"

:: Step 1: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

:: Step 2: Check Electron  
if not exist "node_modules\electron" (
    echo [INFO] Installing Electron (~100MB, one-time)...
    echo DO NOT close this window
    call npm install
)

:: Step 3: Launch
echo [INFO] Starting FindWay Agent Desktop...
start "" "node_modules\.bin\electron.cmd" .

echo.
echo Electron should open shortly.
echo If nothing happens, run install.bat first.
pause
