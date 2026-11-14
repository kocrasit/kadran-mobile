@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - Veri toplama
echo.
echo  Vikipedi'den yillik Turkiye olaylari ve Turk dizileri toplaniyor...
echo  (birkac dakika surebilir, internet gerekli)
echo.
node scripts\vikipedi_topla.mjs
echo.
pause
