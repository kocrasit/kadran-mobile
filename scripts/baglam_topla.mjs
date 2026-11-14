// Kadran — olaylara ve kişilere bağlam: "ne oldu / kim" sorusuna 1-2 cümle.
//
// Wikidata'dan toplanan olayların (veri-ek/wikidata/olay.json) ve vefat edenlerin (olum.json)
// Türkçe Vikipedi maddesini bulur, maddenin giriş paragrafından ilk iki cümleyi alır.
// Böylece akışta "1999 Gölcük depremi" yazan gönderinin altında ne olduğu, neden önemli olduğu görünür.
//
// Kaynak: Türkçe Vikipedi (CC BY-SA 4.0) — uygulamada "Vikipedi" diye kaynak gösterilir.
// Çıktı: veri-ek/wikidata/baglam.json → { "Q12345": { "m": "Madde adı", "o": "İlk iki cümle." } }
// Önce wikidata_topla.mjs çalışmış olmalı.  Kullanım: node scripts/baglam_topla.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WD = join(ROOT, 'veri-ek', 'wikidata');
const UA = 'KadranMobil/0.1 (https://github.com/gencyusuftalha9-oss/kadran; Turkiye nostalji uygulamasi) node';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  let son = '';
  for (let d = 0; d < 5; d++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 || r.status >= 500) { son = `HTTP ${r.status}`; await sleep(5000 * (d + 1)); continue; }
      if (r.ok) return await r.json();
      son = `HTTP ${r.status}`;
    } catch (e) { son = String(e?.message || e); }
    await sleep(2000 * (d + 1));
  }
  console.log('   atlandı:', son);
  return null;
}

/** Kişiler için ilk cümle yeter ("X, Türk şarkıcı ve oyuncu."); olaylar için iki cümle. */
function kisalt(metin, cumle) {
  const t = (metin || '').replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
  // cümle sonu: nokta + boşluk + büyük harf/rakam ("03.02'de", "17.480" bölünmez)
  const parcalar = t.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“])/);
  let out = '';
  for (const p of parcalar.slice(0, cumle)) { if ((out + ' ' + p).length > 320) break; out = out ? `${out} ${p}` : p; }
  return out.trim() || null;
}

const oku = (ad) => (existsSync(join(WD, ad)) ? JSON.parse(readFileSync(join(WD, ad), 'utf8')) : {});
const olay = oku('olay.json'), olum = oku('olum.json');
const hedef = new Map(); // Q → kaç cümle
for (const liste of Object.values(olay)) for (const x of liste) hedef.set(x.q, 2);
// vefatlar: her günün en bilinen 3 kişisi (akışta en fazla bir kişi görünür)
for (const liste of Object.values(olum)) for (const x of liste.slice(0, 3)) hedef.set(x.q, 1);
const onceki = existsSync(join(WD, 'baglam.json')) ? JSON.parse(readFileSync(join(WD, 'baglam.json'), 'utf8')) : {};
const ids = [...hedef.keys()].filter((q) => !(q in onceki));
console.log(`Bağlam: ${hedef.size} kayıt (${ids.length} yeni). Önce Türkçe madde adları bulunuyor…`);

// 1) Wikidata → trwiki madde adı (50'şer)
const madde = {};
for (let i = 0; i < ids.length; i += 50) {
  const j = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=trwiki&ids=${ids.slice(i, i + 50).join('|')}`);
  for (const [q, e] of Object.entries(j?.entities ?? {})) { const t = e.sitelinks?.trwiki?.title; if (t) madde[q] = t; }
  if ((i / 50) % 20 === 0) console.log(`   ${Math.min(i + 50, ids.length)}/${ids.length}`);
  await sleep(300);
}
console.log(`   ${Object.keys(madde).length} kaydın Türkçe maddesi var. Giriş paragrafları okunuyor…`);

// 2) trwiki → giriş paragrafı (20'şer; Vikipedi'nin giriş özeti için sınırı)
const sonuc = { ...onceki };
const ters = new Map(Object.entries(madde).map(([q, t]) => [t, q]));
const basliklar = [...ters.keys()];
for (let i = 0; i < basliklar.length; i += 20) {
  const parti = basliklar.slice(i, i + 20);
  const j = await json(`https://tr.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&titles=${encodeURIComponent(parti.join('|'))}`);
  // yönlendirmeleri geri eşle
  const yon = new Map((j?.query?.redirects ?? []).map((r) => [r.to, r.from]));
  const norm = new Map((j?.query?.normalized ?? []).map((r) => [r.to, r.from]));
  for (const p of j?.query?.pages ?? []) {
    if (p.missing || !p.extract) continue;
    let ilk = yon.get(p.title) ?? p.title; ilk = norm.get(ilk) ?? ilk;
    const q = ters.get(ilk) ?? ters.get(p.title);
    if (!q) continue;
    const o = kisalt(p.extract, hedef.get(q) ?? 2);
    if (o && o.length > 25) sonuc[q] = { m: p.title, o };
  }
  if ((i / 20) % 25 === 0) console.log(`   ${Math.min(i + 20, basliklar.length)}/${basliklar.length}`);
  await sleep(300);
}
writeFileSync(join(WD, 'baglam.json'), JSON.stringify(sonuc));
console.log(`Bitti: ${Object.keys(sonuc).length} kayda bağlam yazıldı → veri-ek/wikidata/baglam.json`);
