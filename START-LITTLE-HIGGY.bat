@echo off
setlocal
cd /d "%~dp0"
title Little Higgy - Your Personal Creative Studio
set NEXT_TELEMETRY_DISABLED=1
set ELECTRON_SKIP_BINARY_DOWNLOAD=1
set COMFYUI_URL=http://127.0.0.1:8188
echo.
echo  LITTLE HIGGY - LOCAL EDITION
echo  No API key. No provider credits.
echo.
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS from https://nodejs.org/ then run this file again.
 pause
 exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 (
 echo Please install Node.js LTS version 22 or newer from https://nodejs.org/.
 pause
 exit /b 1
)
if not exist node_modules (
 echo Installing Little Higgy dependencies. First run requires internet.
 call npm ci --no-audit --no-fund
 if errorlevel 1 goto failed
)
echo Building Little Higgy...
call npm run build
if errorlevel 1 goto failed
echo.
echo Open http://localhost:3000/studio in your browser.
echo Start ComfyUI on this same computer to enable generation.
echo Keep this window open. Press Ctrl+C to stop Little Higgy.
echo.
call npm run start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Setup could not finish. Read the error above and LITTLE-HIGGY-WINDOWS.md.
pause
exit /b 1
