@echo off
rem Double-click this file on a Windows PC to build the installer for Adult Day Care.
cd /d "%~dp0"
title Adult Day Care - installer builder
echo ==============================================
echo   Adult Day Care - installer builder
echo ==============================================
echo.
echo This takes about 5 to 10 minutes the first time.
echo Leave this window open until it says it is finished.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this PC.
  echo Your web browser will open the download page now.
  echo Download the LTS version, install it, then double-click this file again.
  start https://nodejs.org
  echo.
  pause
  exit /b 1
)

set CSC_IDENTITY_AUTO_DISCOVERY=false

echo Step 1 of 2: downloading components...
call npm install --no-audit --no-fund
if errorlevel 1 goto fail

echo Step 2 of 2: building the installer...
call npm run dist:win
if errorlevel 1 goto fail

echo.
echo Finished. Opening the folder that contains the installer.
echo Double-click "Adult Day Care Setup" to install the program.
start "" explorer "%~dp0dist"
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong. Take a screenshot of this window and send it to Claude.
echo.
pause
exit /b 1
