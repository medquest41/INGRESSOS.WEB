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

echo Abrindo Ingressos em http://127.0.0.1:5188/
node scripts/start-site.mjs
if errorlevel 1 pause
