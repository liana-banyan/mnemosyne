@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mnemosyne — one-click launcher for non-technical members (early-tester mode)
REM
REM This batch file is for testers running from the cloned repo BEFORE the
REM Mnemosyne installer ships. Real members download the .exe installer from
REM lianabanyan.com — no batch file needed.
REM
REM What this does:
REM   1. Switches to the directory this .bat lives in (so it works anywhere)
REM   2. Checks Node.js is installed (with a friendly message if not)
REM   3. Installs dependencies on first run (creates node_modules/ if missing)
REM   4. Launches Mnemosyne via npm run dev
REM
REM Double-click this file from File Explorer. No terminal knowledge needed.
REM ─────────────────────────────────────────────────────────────────────────────

setlocal
title Mnemosyne — Memory, powered by CAI
color 0F

REM Step 1: switch to this file's directory
cd /d "%~dp0"

echo.
echo  ===============================================================
echo    Mnemosyne. Memory, powered by CAI.
echo    SSPL - Pledge #2260. No Ads. No Strings.
echo  ===============================================================
echo.

REM Step 2: check Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo  [!] Node.js is not installed.
    echo.
    echo  Mnemosyne needs Node.js to run in tester mode. Please:
    echo    1. Download Node.js LTS from https://nodejs.org/
    echo    2. Run the installer ^(default settings are fine^)
    echo    3. Close this window and double-click Mnemosyne.bat again
    echo.
    echo  Or wait for the Mnemosyne installer release ^(coming soon^) which
    echo  bundles everything — no Node.js install needed.
    echo.
    pause
    exit /b 1
)

REM Step 3: first-run dependency install
if not exist "node_modules\" (
    echo  First-time setup: installing dependencies. This takes 1-3 minutes.
    echo  ^(You only see this on first run — future launches skip straight to Mnemosyne.^)
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [!] npm install failed. Common fixes:
        echo    - Check your internet connection
        echo    - Try running this batch file as Administrator
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  Dependencies installed. Launching Mnemosyne now.
    echo.
)

REM Step 4: launch Mnemosyne (npm run dev = Vite renderer + Electron main)
REM DevTools auto-open is disabled per Founder direct BP041; set MNEMOSYNE_DEVTOOLS=1
REM if you want it back for debugging.
echo  Starting Mnemosyne. Watch for the AMPLIFY Computer window to open.
echo  ^(First launch can take 10-30 seconds while Vite warms up.^)
echo.
echo  To stop Mnemosyne: close this window or press Ctrl+C here.
echo  ===============================================================
echo.

call npm run dev

REM Step 5: if npm run dev exits, hold the window so member can read the error
echo.
echo  Mnemosyne stopped. Press any key to close this window.
pause >nul
endlocal
