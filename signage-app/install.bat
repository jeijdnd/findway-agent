@echo off
title FindWay Agent - Installer
echo.
echo ========================================
echo   FindWay Agent - 一键安装脚本
echo   建筑导视标识设计AI助手
echo ========================================
echo.

:: Check Python
echo [1/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.10+ not found!
    echo Please install from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
python --version
echo [OK] Python found.
echo.

:: Check Node.js
echo [2/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 18+ not found!
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo [OK] Node.js found.
echo.

:: Create virtual environment
echo [3/5] Setting up Python environment...
if not exist "venv" (
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Virtual environment already exists.
)
echo.

:: Install Python dependencies
echo [4/5] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install fastapi uvicorn openpyxl ezdxf "openai>=1.30.0" python-multipart
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)
echo [OK] Python dependencies installed.
echo.

:: Install frontend dependencies and build
echo [5/5] Installing and building frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend built successfully.
echo.

echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo   Next steps:
echo   1. Double-click run.bat to start the app
echo   2. Browser will open http://localhost:8765
echo.
pause