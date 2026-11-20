@echo off
setlocal
set "SKILL_ROOT=%~dp0..\.."
set "PROJECT_DIR=%USERPROFILE%\Documents\DashiAI-Content-Workbench-Demo"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or later first.
  pause
  exit /b 1
)
if not exist "%SKILL_ROOT%\project\node_modules\react\package.json" (
  pushd "%SKILL_ROOT%\project"
  call npm install
  if errorlevel 1 (
    popd
    pause
    exit /b 1
  )
  popd
)
if not exist "%PROJECT_DIR%\content-plan.json" (
  node "%SKILL_ROOT%\scripts\content_workbench.mjs" create --project "%PROJECT_DIR%" --plan "%~dp0content-demo.json" --source "%~dp0content-source.md"
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node "%SKILL_ROOT%\scripts\content_workbench.mjs" start --project "%PROJECT_DIR%"
if errorlevel 1 pause
endlocal
