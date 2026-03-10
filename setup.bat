@echo off
echo Installing dependencies and building Hype Control...
npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: npm install failed. Make sure Node.js is installed.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo Done! Load the extension in Chrome:
echo   1. Open chrome://extensions/
echo   2. Enable Developer mode
echo   3. Click "Load unpacked" and select this folder
pause
