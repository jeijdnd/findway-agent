@echo off
title FindWay Agent Startup
echo ============================================
echo   FindWay Agent - Starting...
echo ============================================
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

:: Check venv
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found.
    echo Please run: python -m venv venv
    pause
    exit /b 1
)

:: Check backend directory
if not exist "backend\main.py" (
    echo [ERROR] backend\main.py not found.
    pause
    exit /b 1
)

:: Check frontend dependencies
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo [1/3] Starting backend server on http://127.0.0.1:8765 ...
start "FindWay Backend" /MIN cmd /c "venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload"

:: Wait for backend to be ready
echo [2/3] Waiting for backend to be ready...
set /a retries=0
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:8765/api/health >nul 2>&1
if %errorlevel% neq 0 (
    set /a retries+=1
    if %retries% geq 15 (
        echo [ERROR] Backend failed to start after 30 seconds.
        echo Please check if port 8765 is occupied.
        pause
        exit /b 1
    )
    goto wait_loop
)
echo        Backend is ready!

echo [3/3] Starting frontend dev server on http://localhost:5173 ...
start "FindWay Frontend" cmd /c "cd frontend && npx vite --host"

:: Wait a moment for frontend to start
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   FindWay Agent is running!
echo   Backend:  http://127.0.0.1:8765
echo   Frontend: http://localhost:5173
echo ============================================
echo.

:: Open browser
start http://localhost:5173

echo Press Ctrl+C to stop all services.
echo Closing this window will NOT stop the services.
pause >nul