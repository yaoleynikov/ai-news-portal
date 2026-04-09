@echo off
setlocal
cd /d "%~dp0backend"

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker not found. Install Docker Desktop and ensure "docker" is in PATH.
  pause
  exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
  echo "docker compose" not found. Enable Compose V2 in Docker Desktop ^(Settings -^> General^).
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo Missing file: backend\.env
  echo Copy backend\.env.example to backend\.env, fill API keys ^(Supabase, OpenRouter, R2, Logo.dev, etc.^), then run this script again.
  echo.
  pause
  exit /b 1
)

echo.
echo Building and starting SiliconFeed worker ^(Docker service: worker, container: siliconfeed-worker^)...
echo.

docker compose up -d --build
if errorlevel 1 (
  echo.
  echo docker compose failed.
  pause
  exit /b 1
)

echo.
echo OK. Open a terminal in the backend folder, then:
echo   docker compose logs -f worker
echo To stop:
echo   docker compose down
echo.
pause
