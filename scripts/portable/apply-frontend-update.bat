@echo off
setlocal
set "TARGET=%~1"
if not defined TARGET set "TARGET=%~dp0..\fasad-portable"
if not exist "%TARGET%\frontend\server.js" if exist "%~dp0..\frontend\server.js" set "TARGET=%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-frontend-update.ps1" -Target "%TARGET%"
if errorlevel 1 (
  echo Update failed. The current frontend is still available or restored from backup.
  pause
  exit /b 1
)
echo Update complete. Start the app with start.bat in the portable folder.
pause
