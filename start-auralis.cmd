@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "AURALIS_NODE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined AURALIS_NODE set "AURALIS_NODE=%%N"
if not defined AURALIS_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "AURALIS_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined AURALIS_NODE (
  for /d %%D in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do if exist "%%~fD\bin\node.exe" set "AURALIS_NODE=%%~fD\bin\node.exe"
)
if not defined AURALIS_NODE (
  echo SPMusic needs Node.js 22.12 or newer.
  echo Install Node.js from https://nodejs.org/en/download then reopen this file.
  pause
  exit /b 1
)
"%AURALIS_NODE%" "%~dp0tools\start-local.mjs"
set "AURALIS_EXIT=%ERRORLEVEL%"
if not "%AURALIS_EXIT%"=="0" pause
exit /b %AURALIS_EXIT%
