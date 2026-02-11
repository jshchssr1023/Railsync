@echo off
title RailSync - Starting...
color 0A

echo.
echo  ====================================================
echo   RailSync - Railcar Fleet Management System
echo  ====================================================
echo.
echo  Starting all services (Database, API, Frontend, Proxy)...
echo.

cd /d "%~dp0.."

:: Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  ERROR: Docker is not running.
    echo  Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

:: Check .env file exists
if not exist ".env" (
    color 0C
    echo  ERROR: .env file not found.
    echo  Copy .env.example to .env and set your secrets first.
    echo.
    pause
    exit /b 1
)

:: Generate TLS certs if missing
if not exist "nginx\certs\server.crt" (
    echo  Generating self-signed TLS certificates...
    mkdir nginx\certs 2>nul
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx\certs\server.key -out nginx\certs\server.crt -subj "//C=US/ST=Local/L=Dev/O=RailSync/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>nul
    if errorlevel 1 (
        echo  WARNING: Could not generate certs. Install OpenSSL or run nginx/generate-dev-certs.sh
    ) else (
        echo  Certificates generated.
    )
    echo.
)

:: Start all services with dev overrides (ports exposed for local access)
echo  Building and starting containers...
echo.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build 2>&1

if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Failed to start services.
    echo  Check Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo  Waiting for services to be ready...

:: Wait for API to respond
set RETRIES=0
:WAIT_LOOP
set /a RETRIES+=1
if %RETRIES% gtr 30 (
    color 0E
    echo.
    echo  WARNING: API did not respond within 60 seconds.
    echo  Services may still be starting. Check Docker Desktop.
    goto :SHOW_INFO
)
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3001/api/health 2>nul | findstr "200" >nul
if errorlevel 1 goto :WAIT_LOOP

:SHOW_INFO
echo.
echo  ====================================================
echo.
echo   RailSync is running!
echo.
echo   App:       http://localhost
echo   HTTPS:     https://localhost  (self-signed cert)
echo   API:       http://localhost/api  (via proxy)
echo.
echo   Direct ports (dev only, no proxy):
echo     Frontend:  http://localhost:3000
echo     API:       http://localhost:3001/api
echo.
echo   Login:     admin@railsync.com / admin123
echo.
echo   To stop:   docker compose down
echo.
echo  ====================================================
echo.

:: Open browser via nginx proxy (required for API routing)
start "" "http://localhost"

echo  Press any key to close this window (services keep running)...
pause >nul
