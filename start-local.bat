@echo off
REM SiliconFeed: backend worker + Astro dev (local site). Publishing works with worker only — see start-worker-local.bat
setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node 22+ ^(frontend^) / 20+ ^(backend^) from nodejs.org
  pause
  exit /b 1
)

if not exist "%BACKEND%\.env" (
  echo Missing: backend\.env
  echo Copy backend\.env.example to backend\.env and fill keys.
  pause
  exit /b 1
)

if not exist "%FRONTEND%\.env" (
  echo WARNING: frontend\.env missing — copy frontend\.env.example for Supabase keys on local site.
  echo.
)

if not exist "%BACKEND%\node_modules" (
  echo Installing backend dependencies ^(npm ci^)...
  pushd "%BACKEND%"
  call npm ci
  if errorlevel 1 popd & pause & exit /b 1
  popd
)

if not exist "%FRONTEND%\node_modules" (
  echo Installing frontend dependencies ^(npm ci^)...
  pushd "%FRONTEND%"
  call npm ci
  if errorlevel 1 popd & pause & exit /b 1
  popd
)

echo.
echo Starting two windows:
echo   - SiliconFeed worker ^(RSS + jobs, backend^)
echo   - SiliconFeed frontend ^(Astro dev server^)
echo.
echo Frontend URL is usually http://localhost:4321
echo Close those windows to stop the processes.
echo.

start "SiliconFeed worker" cmd /k "cd /d ""%BACKEND%"" && npm run worker"
timeout /t 1 /nobreak >nul
start "SiliconFeed frontend" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

echo Done.
pause
