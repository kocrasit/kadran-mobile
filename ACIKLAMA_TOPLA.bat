@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  Kadran - gazete basliklarina aciklama topluyor (haberin kendi arsiv sayfasindan)
echo  Internet gerekir, birkac saat surebilir. Kapatirsan kaldigi yerden devam eder.
echo.
node scripts\aciklama_topla.mjs 1996 2026
echo.
echo  Bitti. Claude'a "aciklama bitti" yazabilirsin.
pause
