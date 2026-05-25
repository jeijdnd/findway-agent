@echo off
title FindWay Agent - Desktop

cd /d "%~dp0"

:: Step 1: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend (first time)...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

:: Step 2: Check Electron
if not exist "node_modules\electron" (
    echo [INFO] Downloading Electron (~100MB, first time only)...
    echo 请勿关闭此窗口，预计1-3分钟...
    call npm install
)

:: Step 3: Launch
echo [INFO] Starting FindWay Agent Desktop...
start "" "node_modules\.bin\electron.cmd" .

echo.
echo Electron window should open shortly.
echo If not, check that install.bat was run first.
pause
