@echo off
cd /d "%~dp0"
echo Starting Facility Maintenance UI...
echo.
"C:\Program Files\nodejs\node.exe" tools\static-server.cjs
pause
