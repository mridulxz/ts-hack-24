@echo off
setlocal

rem Check if .flag file exists
if exist .flag (
    goto :launch_app
)

rem Check if pip is in path
where pip >nul 2>&1
if %errorlevel% neq 0 (
    echo pip is not installed. Please install it using:
    echo winget install Python.Python.3.12
    exit /b 1
)

rem Check if npm is in path
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo npm is not installed. Please install it using:
    echo winget install OpenJS.NodeJS
    exit /b 1
)

rem Check if Python is in path
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed. Please install it using:
    echo winget install Python.Python.3.12
    exit /b 1
)

rem Ask if user wants to install dependencies
set /p install_deps=Would you like to install dependencies? (yes/no):

if /i "%install_deps%"=="yes" (
    rem Install Python dependencies
    pip install -r requirements.txt

    rem Install Node.js dependencies
    npm install -D tailwindcss
)

rem Create .flag file to indicate first launch
echo First launch flag > .flag

:launch_app
rem Launch app.py and npm run dev
start cmd /k python app.py
start cmd /k npm run dev

endlocal