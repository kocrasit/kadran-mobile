# Kadran Mobil

Expo (React Native + TypeScript). Web projesinden (`kadran`) ayrı durur, onun dosyalarına dokunmaz.

## Çalıştırma

1. **Veri:** Ayrı sunucu gerekmez; Expo, `kadran/public/data` klasörünü kendisi servis eder (metro.config.js).
2. **Mobil (2. terminal):** bu klasörde
   ```
   $env:EXPO_TOKEN="token"   # expo.dev → Account Settings → Access Tokens
   npm install               # ilk seferde
   npx expo start
   ```
3. iPhone kamerasıyla QR kodu okut (Expo Go'da emrersd34 ile giriş yapılmış olmalı).

Telefon ve bilgisayar aynı ağda olmalı (hotspot da olur). Veri gelmezse `src/data.ts` içindeki
`MANUEL_ADRES` satırına bilgisayarın IP'sini yaz (PowerShell'de `ipconfig` → IPv4).

## Yapı

- `App.tsx` — Ekranlar: Ana sayfa (Bugün, geçmişte) → Kadran (tarih seç) → Işınlanma → O günün gazetesi
- `src/components/DayPaper.tsx` — Bir günün gazetesi
- `src/components/DatePicker.tsx` — Yıl / ay / gün seçici (1 Oca 1950 – 25 Haz 2026)
- `src/components/TravelOverlay.tsx` — Işınlanma efekti (akan yıl sayacı, titreşim, parazit)
- `src/data.ts` — Veri okuma, tipler, biçimlendirme
- `src/theme.ts` — Her on yılın gazete renkleri
