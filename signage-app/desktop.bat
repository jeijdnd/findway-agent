@echo off
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

set "FINDWAY_NODE="
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "FINDWAY_NODE=%ProgramFiles%\nodejs\node.exe"
) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
  set "FINDWAY_NODE=%LOCALAPPDATA%\Programs\node\node.exe"
) else (
  set "FINDWAY_NODE=node"
)

wscript.exe //Nologo "%~dp0scripts\launch-hidden.vbs"
exit /b 0