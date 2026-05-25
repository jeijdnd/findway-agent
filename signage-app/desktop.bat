@echo off
title FindWay Agent - Desktop
echo.

:: Check if Electron is installed
if not exist "node_modules\electron" (
    echo [INFO] Installing Electron (first time)...
    call npm install
    echo.
)

:: Check if frontend is built
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
    echo.
)

echo [INFO] Starting FindWay Agent Desktop...
echo.

:: Launch Electron (it auto-starts Python backend)
call npx electron .

