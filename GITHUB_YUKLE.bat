@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist package.json (
  echo Bu dosyayi kadran-mobile klasorune koyup oradan calistir.
  pause
  exit /b
)
where git >nul 2>nul
if errorlevel 1 (
  echo Git kurulu degil. Kuruluyor...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  echo.
  echo Kurulum bitti. Bu pencereyi kapatip GITHUB_YUKLE.bat'i tekrar calistir.
  pause
  exit /b
)
findstr /c:".aciklama-onbellek" .gitignore >nul || (echo .aciklama-onbellek/>>.gitignore& echo .gecici/>>.gitignore& echo *.log>>.gitignore)
if not exist .git (
  git init -b main
  git remote add origin https://github.com/kocrasit/kadran-mobile.git
)
git config user.name "kocrasit"
git config user.email "kocrasit33@gmail.com"
git add -A
git rm --cached token.txt >nul 2>nul
git commit -m "Kadran mobil: guncel durum"
git push -u origin main
if errorlevel 1 (
  echo.
  echo HATA: yukleme olmadi, ekrandaki mesaji Claude'a gonder.
) else (
  echo.
  echo TAMAM: https://github.com/kocrasit/kadran-mobile
)
pause
