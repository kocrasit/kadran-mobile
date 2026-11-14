@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - Donem fotograflari
echo.
echo  Wikimedia Commons uzerinden 1980-2025 Turkiye fotograflari toplaniyor...
echo  (45-90 dakika surebilir; kapatirsan sonra kaldigi yildan devam ettirebilirsin)
echo.
node scripts\foto_topla.mjs %*
echo.
pause
