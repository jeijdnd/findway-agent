@echo off
title FindWay Agent - Signage Design AI Assistant
echo.
echo ========================================
echo   FindWay Agent - 建筑导视标识设计AI助手
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found or not in PATH
    echo Please install Python 3.10+ and add to PATH
    pause
    exit /b 1
)

:: Check venv
if not exist "venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
)

:: Activate venv
call venv\Scripts\activate.bat

:: Check backend deps
if not exist "venv\Lib\site-packages\fastapi" (
    echo [INFO] Installing backend dependencies...
    pip install fastapi uvicorn openpyxl ezdxf
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
)

:: Check frontend build
if not exist "frontend\dist\index.html" (
    echo [INFO] Frontend not built, building now...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

echo.
echo [INFO] Starting backend service...
echo [INFO] Browser will open http://localhost:8765 automatically
echo [INFO] Press Ctrl+C to stop
echo.

:: Open browser
start http://localhost:8765

:: Start backend (production mode - serves frontend too)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8765

pause