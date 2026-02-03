@echo off
SETLOCAL EnableDelayedExpansion

echo ========================================
echo   Prompt Refiner - Build and Package
echo ========================================

:: Check if git is available
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Git not found in PATH. Using default version.
    set VERSION=v0.0.0
    goto :continue_build
)

:: Debug: Show git tags
echo [DEBUG] Checking for git tags...
git tag --list

echo.

:: Get version from latest git tag
echo [DEBUG] Getting latest tag...
for /f "delims=" %%a in ('git describe --tags --abbrev=0') do (
    set "VERSION=%%a"
    echo [DEBUG] Found tag: %%a
)

:: Alternative method if first one fails
if not defined VERSION (
    echo [DEBUG] Trying alternative method...
    for /f "delims=" %%a in ('git tag --list --sort=-version:refname') do (
        if not defined VERSION (
            set "VERSION=%%a"
            echo [DEBUG] Found tag with alternative: %%a
        )
    )
)

:: If still no tag, try to get from package.json
if not defined VERSION (
    echo [DEBUG] Trying to get version from package.json...
    for /f "tokens=2 delims=:," %%a in ('findstr "version" package.json ^| findstr /v "lockfileVersion"') do (
        set "PKG_VERSION=%%a"
        set "PKG_VERSION=!PKG_VERSION:"=!"
        set "PKG_VERSION=!PKG_VERSION: =!"
        if not defined VERSION (
            set "VERSION=!PKG_VERSION!"
            echo [DEBUG] Found version in package.json: !PKG_VERSION!
        )
    )
)

:: If no tag exists, use default version
if not defined VERSION (
    echo [WARNING] No git tag or package.json version found. Using default version v0.0.0
    set VERSION=v0.0.0
)

:: Ensure version has 'v' prefix for consistency
set "VERSION=!VERSION:v=!"
set "VERSION=v!VERSION!"

:continue_build
:: Remove 'v' prefix if present for the filename
set "FILENAME_VERSION=!VERSION:v=!"
echo [INFO] Building version: %VERSION%
echo [INFO] Filename will be: ai-prompt-refiner-%FILENAME_VERSION%.vsix

:: Step 1: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [1/4] Installing dependencies...
    call npm install
) else (
    echo [1/4] Dependencies already installed.
)

:: Step 2: Compile the project
echo [2/4] Compiling the project (TypeScript)...
call npm run compile
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error during compilation.
    pause
    exit /b %ERRORLEVEL%
)

:: Step 3: Update version in package.json
echo [3/4] Updating version in package.json to %VERSION%...
call npm version %VERSION% --no-git-tag-version --allow-same-version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Could not update package.json version. Continuing with current version.
)

:: Step 4: Package the extension
echo [4/4] Generating .vsix file with version %FILENAME_VERSION%...
call npx @vscode/vsce package --allow-missing-repository --out "ai-prompt-refiner-%FILENAME_VERSION%.vsix"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error generating the .vsix package.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo   PROCESS COMPLETED SUCCESSFULLY
echo ========================================
echo Generated file: ai-prompt-refiner-%FILENAME_VERSION%.vsix
echo Version: %VERSION%
echo.
echo You can install it in VS Code using 'Install from VSIX'.
echo.
pause
