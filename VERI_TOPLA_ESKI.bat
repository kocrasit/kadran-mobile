@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kadran - 1950-1979 ve baglam veri toplama
echo.
echo  Kadran icin 1950-1979 yillari ve olaylara baglam toplaniyor.
echo  Tum adimlar sirayla calisir; 1-2 saat surebilir. Internet gerekli,
echo  pencereyi kapatma. Bir adim hata verirse digerleri yine calisir.
echo.
echo  [1/7] Vikipedi: yil yil Turkiye olaylari (1950-2025) ve diziler
node scripts\vikipedi_topla.mjs
echo.
echo  [2/7] Wikidata: olaylar, vefatlar, filmler, sarkilar (1950 sonrasi)
node scripts\wikidata_topla.mjs
echo.
echo  [3/7] Olaylara ve kisilere baglam (Vikipedi giris paragraflari)
node scripts\baglam_topla.mjs
echo.
echo  [4/7] Gun sayfalari ve depremler (1950 sonrasi)
node scripts\gundem_topla.mjs
echo.
echo  [5/7] Milliyet arsivi hangi yillari kapsiyor (sadece kontrol)
node scripts\gazete_kapsam.mjs 1950 1985
echo.
echo  [6/7] Donem fotograflari: 1950-1979 ve eksik 2022
node scripts\foto_topla.mjs 1950 1979
node scripts\foto_topla.mjs 2022 2022
echo.
echo  [7/7] Milliyet arsivinde arama nasil yapiliyor (zam haberleri icin, sadece okuma)
node scripts\arsiv_arama_kesif.mjs
echo.
echo  Bitti. Claude'a "veri toplama bitti" yazabilirsin.
pause
