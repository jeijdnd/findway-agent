@echo off
setlocal
cd /d "%~dp0.."

if not defined FINDWAY_NODE (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "FINDWAY_NODE=%ProgramFiles%\nodejs\node.exe"
  ) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "FINDWAY_NODE=%LOCALAPPDATA%\Programs\node\node.exe"
  ) else (
    set "FINDWAY_NODE=node"
  )
)

"%FINDWAY_NODE%" "%~dp0dev-launcher.js"
exit /b %ERRORLEVEL%