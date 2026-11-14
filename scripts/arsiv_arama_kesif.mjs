// Kadran — Milliyet arşivinde arama nasıl yapılıyor? (keşif)
//
// Amaç: "ekmeğe zam", "benzine zam", "sinema bileti" gibi haberleri yıl yıl bulup eski fiyatları
// kaynağıyla toplamak. Arşivin arama uç noktası belgelenmiş değil; bu betik sadece arşivin kendi
// sayfasını ve betik dosyalarını okuyup içlerinde geçen arama adreslerini listeler.
// Hiçbir şeye giriş yapmaz, form göndermez; sonucu veri-ek/arsiv_arama_kesif.txt dosyasına yazar.
// Kullanım: node scripts/arsiv_arama_kesif.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REF = 'https://gazetearsivi.milliyet.com.tr/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const satirlar = [];
const yaz = (s) => { console.log(s); satirlar.push(s); };

async function metin(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: REF }, signal: AbortSignal.timeout(20000) });
    return { durum: r.status, govde: await r.text() };
  } catch (e) { return { durum: 0, govde: String(e?.message ?? e) }; }
}

const ana = await metin(REF);
yaz(`Ana sayfa: HTTP ${ana.durum}, ${ana.govde.length} karakter`);
const betikler = [...ana.govde.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], REF).href);
const formlar = [...ana.govde.matchAll(/<form[^>]*action="([^"]*)"[^>]*>/g)].map((m) => m[1]);
yaz(`Formlar: ${formlar.join(', ') || 'yok'}`);
yaz(`Betik dosyaları: ${betikler.length}`);

const ADRES = /["'`]((?:https?:)?\/\/[^"'`\s]*?(?:search|arama|ara|Search|Arama|Ara)[^"'`\s]*|\/(?:api\/v\d\/)?[A-Za-z]*(?:Search|search|Arama|arama)[^"'`\s]*)["'`]/g;
const bulunan = new Set();
for (const u of [REF, ...betikler]) {
  const { durum, govde } = u === REF ? ana : await metin(u);
  for (const m of govde.matchAll(ADRES)) bulunan.add(m[1]);
  if (u !== REF) yaz(`  ${durum} ${u} (${govde.length})`);
}
yaz(`\nArama ile ilgili adresler (${bulunan.size}):`);
for (const a of bulunan) yaz(`  ${a}`);

// Sık görülen biçimler: hangisi cevap veriyor? (sadece okuma)
const DENE = [
  `${REF}arama?q=ekmek%20zam`,
  `${REF}Arama?kelime=ekmek%20zam`,
  `${REF}ara?kelime=ekmek%20zam`,
  'https://gazetearsivi-api.milliyet.com.tr/api/v1/Search?keyword=ekmek%20zam',
  'https://gazetearsivi-api.milliyet.com.tr/api/v1/Newspaper/Search?keyword=ekmek%20zam',
];
yaz('\nDenemeler:');
for (const u of DENE) {
  const { durum, govde } = await metin(u);
  yaz(`  ${durum} ${u} → ${govde.slice(0, 160).replace(/\s+/g, ' ')}`);
}
writeFileSync(join(ROOT, 'veri-ek', 'arsiv_arama_kesif.txt'), satirlar.join('\n'));
console.log('\nBitti: veri-ek/arsiv_arama_kesif.txt');
