@echo off
REM SiliconFeed: only the backend worker (RSS + queue + publish). No Astro — not required for publishing.
setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node 20+ from nodejs.org
  pause
  exit /b 1
)

if not exist "%BACKEND%\.env" (
  echo Missing: backend\.env
  echo Copy backend\.env.example to backend\.env and fill keys.
  pause
  exit /b 1
)

if not exist "%BACKEND%\node_modules" (
  echo Installing backend dependencies ^(npm ci^)...
  pushd "%BACKEND%"
  call npm ci
  if errorlevel 1 popd & pause & exit /b 1
  popd
)

echo.
echo Starting worker only ^(embedded RSS gatekeeper + job pipeline^).
echo For local site preview also run: start-local.bat
echo Close the window to stop.
echo.

start "SiliconFeed worker" cmd /k "cd /d ""%BACKEND%"" && npm run worker"
echo Done.
pause
