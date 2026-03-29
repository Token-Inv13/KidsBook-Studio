@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1"
exit /b %ERRORLEVEL%
