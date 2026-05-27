@echo off
REM Usage: call i18n-echo.cmd <json_key>
setlocal
set "I18N_KEY=%~1"
if "%I18N_KEY%"=="" exit /b 1
set "I18N_FILE=%~dp0..\backend\i18n\zh-CN.json"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%I18N_FILE%'; $k='%I18N_KEY%'; $j=Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json; $j.$k"`) do echo %%i
endlocal
