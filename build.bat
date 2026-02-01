@echo off
SETLOCAL EnableDelayedExpansion

echo ========================================
echo   Prompt Refiner - Build and Package
echo ========================================

:: Step 1: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [1/3] Instalando dependencias...
    call npm install
) else (
    echo [1/3] Dependencias ya instaladas.
)

:: Step 2: Compile the project
echo [2/3] Compilando el proyecto (TypeScript)...
call npm run compile
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error durante la compilacion.
    pause
    exit /b %ERRORLEVEL%
)

:: Step 3: Package the extension
echo [3/3] Generando archivo .vsix...
:: Usamos npx para asegurar que vsce este disponible sin instalacion global previa
call npx @vscode/vsce package --allow-missing-repository
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error al generar el paquete .vsix.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo   PROCESO COMPLETADO CON EXITO
echo ========================================
echo Se ha generado el archivo .vsix en la raiz.
echo Puedes instalarlo en VS Code usando 'Install from VSIX'.
echo.
pause
