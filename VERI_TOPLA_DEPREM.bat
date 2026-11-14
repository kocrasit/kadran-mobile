@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - Deprem verisi
echo.
echo  Depremler AFAD katalogundan yeniden toplaniyor...
echo.
node scripts\gundem_topla.mjs --sadece-deprem
echo.
pause
