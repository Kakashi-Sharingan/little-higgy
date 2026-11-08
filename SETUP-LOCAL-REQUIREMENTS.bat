@echo off
setlocal
cd /d "%~dp0"
title Little Higgy - Set up local requirements
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Setup-Local.ps1"
if errorlevel 1 (
 echo.
 echo Setup needs attention. Read the message above.
 pause
 exit /b 1
)
echo.
echo Setup complete. Use START-LITTLE-HIGGY.bat next time.
pause
