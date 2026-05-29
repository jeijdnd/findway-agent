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

if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
  set "NODE_EXE=%LOCALAPPDATA%\Programs\node\node.exe"
) else (
  set "NODE_EXE=node"
)

wscript.exe "%~dp0scripts\launch-hidden.vbs"
if errorlevel 1 (
  echo 启动失败，请查看 %%APPDATA%%\FindWay-Agent\launch.log
  pause
  exit /b 1
)
exit /b 0
