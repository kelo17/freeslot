@echo off
setlocal
cd /d "%~dp0"
title FreeSlot

rem Reuse an already running FreeSlot server.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 2; if ($r.Content -match '<title>[^<]*FreeSlot') { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    start "" "http://127.0.0.1:5173"
    exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is missing. Please install Node.js 22.18 or newer.
    pause
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm is missing. Please reinstall Node.js.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo Installing dependencies...
    call npm.cmd ci
    if errorlevel 1 (
        echo Dependency installation failed. Check your network and retry.
        pause
        exit /b 1
    )
)

echo Starting FreeSlot. Keep this window open while using the website.
echo Close this window to stop the server.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 (
    echo Could not start FreeSlot. Check the error above.
    pause
    exit /b 1
)
