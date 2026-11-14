// Kadran — Milliyet gazete arşivi hangi yılları kapsıyor?
// Her yıl için birkaç tarihi (15 Ocak, 15 Nisan, 15 Temmuz, 15 Ekim) arşivin liste sayfasında dener;
// ön sayfa görseli bulunursa o yıl "var" sayılır. Sadece varlık kontrolü yapar, hiçbir görsel indirmez.
// Çıktı: veri-ek/gazete_kapsam.json → { "1950": 4, "1951": 4, … }  (o yıl bulunan tarih sayısı, 0–4)
// Kullanım: node scripts/gazete_kapsam.mjs [ilk-yıl] [son-yıl]   (varsayılan 1950 1985)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// Uygulamanın kendi gazete aracısı (metro.config.js) ile aynı tarayıcı kimliği: sonuç uygulamada göreceğimizle aynı olsun
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const REF = 'https://gazetearsivi.milliyet.com.tr/';
const Y1 = Number(process.argv[2]) || 1950, Y2 = Number(process.argv[3]) || 1985;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function onSayfaVarMi(iso) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://gazetearsivi.milliyet.com.tr/liste?tarih=${iso.replace(/-/g, '.')}`, { headers: { 'User-Agent': UA, Referer: REF }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return /NewspaperImage(%2F|\/)Image/.test(html);
    } catch { await sleep(1500 * (a + 1)); }
  }
  return null; // ulaşılamadı
}

const sonuc = {};
console.log(`Milliyet arşivi kapsamı: ${Y1}–${Y2}`);
for (let y = Y1; y <= Y2; y++) {
  let n = 0, hata = 0;
  for (const md of ['01-15', '04-15', '07-15', '10-15']) {
    const v = await onSayfaVarMi(`${y}-${md}`);
    if (v === null) hata++; else if (v) n++;
    await sleep(500);
  }
  sonuc[y] = hata === 4 ? null : n;
  console.log(`  ${y}: ${hata === 4 ? 'ulaşılamadı' : `${n}/4 tarihte ön sayfa var`}`);
}
mkdirSync(join(ROOT, 'veri-ek'), { recursive: true });
writeFileSync(join(ROOT, 'veri-ek', 'gazete_kapsam.json'), JSON.stringify({ kaynak: 'gazetearsivi.milliyet.com.tr (sadece varlık kontrolü)', yillar: sonuc }));
console.log('Bitti → veri-ek/gazete_kapsam.json');
