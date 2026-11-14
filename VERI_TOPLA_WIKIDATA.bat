@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - Wikidata veri toplama
echo.
echo  Wikidata (acik veri) uzerinden dogan/olen unluler, olaylar,
echo  diziler, filmler ve albumler toplaniyor...
echo  (5-20 dakika surebilir, internet gerekli, pencereyi kapatma)
echo.
node scripts\wikidata_topla.mjs
echo.
pause
