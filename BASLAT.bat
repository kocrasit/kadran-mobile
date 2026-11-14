@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran Mobil

if not exist token.txt (
  echo.
  echo  [!] token.txt bulunamadi.
  echo      expo.dev ^> Account Settings ^> Access Tokens ^> Create Token
  echo      Olusan token'i bu klasorde token.txt adli dosyaya yapistirip kaydet.
  echo.
  pause
  exit /b 1
)
set /p EXPO_TOKEN=<token.txt

echo  [1/2] Paketler kontrol ediliyor...
call npm install --no-audit --no-fund

echo  [2/2] Expo baslatiliyor. QR kodu iPhone kamerasiyla okut.
call npx expo start
pause
