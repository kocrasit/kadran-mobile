@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - Gundem, deprem ve muzik toplama
echo.
echo  Vikipedi gun sayfalari, USGS depremleri ve YouTube calinabilirlik kontrolu...
echo  (20-40 dakika surebilir, internet gerekli, pencereyi kapatma)
echo.
node scripts\gundem_topla.mjs
echo.
pause
