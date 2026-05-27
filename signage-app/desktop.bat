@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

if not exist "node_modules\.bin\electron.cmd" (
  call "%~dp0scripts\i18n-echo.cmd" error_node_modules_not_found
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  call "%~dp0scripts\i18n-echo.cmd" error_venv_not_found
  pause
  exit /b 1
)

start /MIN "" "%~dp0node_modules\.bin\electron.cmd" .
exit /b 0
