@echo off
title RailSync - Stopping...
color 0E

echo.
echo  Stopping all RailSync services...
echo.

cd /d "%~dp0.."

docker compose down 2>&1

echo.
echo  All services stopped.
echo.
pause
