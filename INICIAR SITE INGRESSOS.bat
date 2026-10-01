@echo off
chcp 65001 >nul
title INGRESSOS WEB - Iniciador
cd /d "%~dp0"

echo ==============================================
echo          INGRESSOS WEB - INICIANDO
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado neste computador.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primeira execucao: instalando dependencias...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Abrindo servidor local...
start "Servidor Ingressos" cmd /k "cd /d \"%~dp0\" && npm.cmd run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"

exit
