// Kadran — Wikidata toplayıcı
// Wikidata (CC0 lisans) üzerinden Türkiye'ye dair günlük veriyi toplar:
//   doğanlar, vefat edenler, olaylar, diziler, filmler, albüm ve şarkılar.
// Çıktı: veri-ek/wikidata/*.json  +  veri-ek/wikidata/RAPOR.txt
// Çalıştırma: node scripts/wikidata_topla.mjs   (VERI_TOPLA_WIKIDATA.bat bunu yapar)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'veri-ek', 'wikidata');
mkdirSync(OUT, { recursive: true });

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'KadranBot/0.1 (Turkiye nostalji uygulamasi; https://github.com/gencyusuftalha9-oss/kadran)';
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const hatalar = [];

async function sorgu(ad, sparql) {
  for (let deneme = 1; deneme <= 4; deneme++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'query=' + encodeURIComponent(sparql),
      });
      if (res.status === 429 || res.status >= 500) {
        const sn = Number(res.headers.get('retry-after')) || deneme * 15;
        console.log(`   ${ad}: sunucu meşgul (${res.status}), ${sn} sn bekleniyor...`);
        await bekle(sn * 1000);
        continue;
      }
      if (!res.ok) {
        const metin = (await res.text()).slice(0, 300).replace(/\s+/g, ' ');
        throw new Error(`HTTP ${res.status}: ${metin}`);
      }
      const j = await res.json();
      await bekle(1200); // nazik olalım
      return j.results.bindings;
    } catch (e) {
      console.log(`   ${ad}: hata (${deneme}/4) ${e.message}`);
      if (deneme === 4) { hatalar.push(`${ad}: ${e.message}`); return []; }
      await bekle(deneme * 8000);
    }
  }
  return [];
}

const v = (b, k) => b[k]?.value;
const qid = (u) => u?.split('/').pop();
const gun = (t) => t?.slice(0, 10); // 1996-10-27
const yil = (t) => (t ? Number(t.slice(0, 4)) : null);
const resim = (u) => (u ? u.replace(/^http:/, 'https:') + '?width=400' : undefined);
const ETIKET = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }';

/* ---------------- 1. Doğanlar (Türk vatandaşları, gün hassasiyetli doğum tarihi) ---------------- */
async function doganlar() {
  console.log('\n[1/6] Türkiye doğumlu ünlüler (doğum günleri)');
  const kisiler = new Map();
  const araliklar = [[1850, 1900], [1900, 1925], [1925, 1940], [1940, 1950], [1950, 1960], [1960, 1970], [1970, 1980], [1980, 1990], [1990, 2000], [2000, 2026]];
  for (const [a, b] of araliklar) {
    const rows = await sorgu(`dogum ${a}-${b}`, `
      SELECT ?p ?pLabel ?b ?d ?img ?sl ?occLabel WHERE {
        ?p wdt:P31 wd:Q5; wdt:P27 wd:Q43;
           p:P569/psv:P569 [ wikibase:timeValue ?b; wikibase:timePrecision 11 ].
        FILTER(?b >= "${a}-01-01T00:00:00Z"^^xsd:dateTime && ?b < "${b}-01-01T00:00:00Z"^^xsd:dateTime)
        ?p wikibase:sitelinks ?sl. FILTER(?sl >= 2)
        OPTIONAL { ?p wdt:P570 ?d }
        OPTIONAL { ?p wdt:P18 ?img }
        OPTIONAL { ?p wdt:P106 ?occ }
        ${ETIKET}
      }`);
    for (const r of rows) {
      const id = qid(v(r, 'p'));
      if (kisiler.has(id)) continue;
      const ad = v(r, 'pLabel');
      if (!ad || /^Q\d+$/.test(ad)) continue;
      kisiler.set(id, { q: id, n: ad, t: gun(v(r, 'b')), o: yil(v(r, 'd')), j: v(r, 'occLabel'), img: resim(v(r, 'img')), s: Number(v(r, 'sl')) });
    }
    console.log(`   ${a}-${b}: ${rows.length} satır (toplam kişi ${kisiler.size})`);
  }
  // ay-gün anahtarına göre, en tanınmışlar önce
  const gunluk = {};
  for (const k of kisiler.values()) {
    const md = k.t.slice(5);
    (gunluk[md] ??= []).push(k);
  }
  for (const md in gunluk) gunluk[md] = gunluk[md].sort((x, y) => y.s - x.s).slice(0, 40);
  writeFileSync(join(OUT, 'dogum.json'), JSON.stringify(gunluk));
  return { kisi: kisiler.size, gun: Object.keys(gunluk).length };
}

/* ---------------- 2. Vefat edenler (1950 ve sonrası) ---------------- */
async function vefatlar() {
  console.log('\n[2/6] Vefat edenler (1950-2026)');
  const kisiler = new Map();
  for (let a = 1950; a < 2027; a += 5) {
    const b = Math.min(a + 5, 2027);
    const rows = await sorgu(`vefat ${a}-${b}`, `
      SELECT ?p ?pLabel ?d ?b ?img ?sl ?occLabel WHERE {
        ?p wdt:P31 wd:Q5; wdt:P27 wd:Q43;
           p:P570/psv:P570 [ wikibase:timeValue ?d; wikibase:timePrecision 11 ].
        FILTER(?d >= "${a}-01-01T00:00:00Z"^^xsd:dateTime && ?d < "${b}-01-01T00:00:00Z"^^xsd:dateTime)
        ?p wikibase:sitelinks ?sl. FILTER(?sl >= 2)
        OPTIONAL { ?p wdt:P569 ?b }
        OPTIONAL { ?p wdt:P18 ?img }
        OPTIONAL { ?p wdt:P106 ?occ }
        ${ETIKET}
      }`);
    for (const r of rows) {
      const id = qid(v(r, 'p'));
      if (kisiler.has(id)) continue;
      const ad = v(r, 'pLabel');
      if (!ad || /^Q\d+$/.test(ad)) continue;
      kisiler.set(id, { q: id, n: ad, t: gun(v(r, 'd')), d: yil(v(r, 'b')), j: v(r, 'occLabel'), img: resim(v(r, 'img')), s: Number(v(r, 'sl')) });
    }
    console.log(`   ${a}-${b}: ${rows.length} satır (toplam ${kisiler.size})`);
  }
  const gunluk = {};
  for (const k of kisiler.values()) (gunluk[k.t] ??= []).push(k);
  for (const t in gunluk) gunluk[t].sort((x, y) => y.s - x.s);
  writeFileSync(join(OUT, 'olum.json'), JSON.stringify(gunluk));
  return { kisi: kisiler.size, gun: Object.keys(gunluk).length };
}

/* ---------------- 3. Türkiye'de olaylar (gün hassasiyetli) ---------------- */
async function olaylar() {
  console.log('\n[3/6] Türkiye\'de yaşanan olaylar');
  const hepsi = new Map();
  for (let a = 1950; a < 2027; a += 8) {
    const b = Math.min(a + 8, 2027);
    for (const prop of ['P585', 'P580']) {
      const rows = await sorgu(`olay ${prop} ${a}-${b}`, `
        SELECT ?e ?eLabel ?t ?typeLabel ?sl ?img WHERE {
          { ?e wdt:P17 wd:Q43 } UNION { ?e wdt:P276/wdt:P17 wd:Q43 }
          ?e p:${prop}/psv:${prop} [ wikibase:timeValue ?t; wikibase:timePrecision 11 ].
          FILTER(?t >= "${a}-01-01T00:00:00Z"^^xsd:dateTime && ?t < "${b}-01-01T00:00:00Z"^^xsd:dateTime)
          FILTER NOT EXISTS { ?e wdt:P31 wd:Q5 }
          ?e wikibase:sitelinks ?sl. FILTER(?sl >= 1)
          OPTIONAL { ?e wdt:P31 ?type }
          OPTIONAL { ?e wdt:P18 ?img }
          ${ETIKET}
        }`);
      for (const r of rows) {
        const id = qid(v(r, 'e'));
        if (hepsi.has(id)) continue;
        const ad = v(r, 'eLabel');
        if (!ad || /^Q\d+$/.test(ad)) continue;
        hepsi.set(id, { q: id, n: ad, t: gun(v(r, 't')), tur: v(r, 'typeLabel'), img: resim(v(r, 'img')), s: Number(v(r, 'sl')) });
      }
      console.log(`   ${prop} ${a}-${b}: ${rows.length} satır (toplam ${hepsi.size})`);
    }
  }
  const gunluk = {};
  for (const k of hepsi.values()) (gunluk[k.t] ??= []).push(k);
  for (const t in gunluk) gunluk[t].sort((x, y) => y.s - x.s);
  writeFileSync(join(OUT, 'olay.json'), JSON.stringify(gunluk));
  return { olay: hepsi.size, gun: Object.keys(gunluk).length };
}

/* ---------------- 4. Türk dizileri ---------------- */
async function diziler() {
  console.log('\n[4/6] Türk dizileri');
  const rows = await sorgu('diziler', `
    SELECT ?s ?sLabel ?start ?end ?netLabel ?img ?sl ?eps WHERE {
      VALUES ?tip { wd:Q5398426 wd:Q1259759 wd:Q526877 wd:Q15416 }
      ?s wdt:P31 ?tip; wdt:P495 wd:Q43.
      ?s wikibase:sitelinks ?sl.
      OPTIONAL { ?s wdt:P580 ?start }
      OPTIONAL { ?s wdt:P582 ?end }
      OPTIONAL { ?s wdt:P449 ?net }
      OPTIONAL { ?s wdt:P18 ?img }
      OPTIONAL { ?s wdt:P1113 ?eps }
      ${ETIKET}
    }`);
  const m = new Map();
  for (const r of rows) {
    const id = qid(v(r, 's'));
    const ad = v(r, 'sLabel');
    if (!ad || /^Q\d+$/.test(ad)) continue;
    const e = m.get(id) ?? { q: id, n: ad, bas: null, bit: null, kanal: [], img: resim(v(r, 'img')), bolum: v(r, 'eps') ? Number(v(r, 'eps')) : undefined, s: Number(v(r, 'sl')) };
    const bs = gun(v(r, 'start')), bt = gun(v(r, 'end')), k = v(r, 'netLabel');
    if (bs && (!e.bas || bs < e.bas)) e.bas = bs;
    if (bt && (!e.bit || bt > e.bit)) e.bit = bt;
    if (k && !e.kanal.includes(k)) e.kanal.push(k);
    m.set(id, e);
  }
  const liste = [...m.values()].sort((a, b) => (a.bas ?? '9') < (b.bas ?? '9') ? -1 : 1);
  writeFileSync(join(OUT, 'diziler.json'), JSON.stringify(liste));
  return { dizi: liste.length, tarihli: liste.filter((x) => x.bas).length };
}

/* ---------------- 5. Türk filmleri ---------------- */
async function filmler() {
  console.log('\n[5/6] Türk filmleri');
  const m = new Map();
  for (const [a, b] of [[1950, 1965], [1965, 1975], [1975, 1985], [1985, 1995], [1995, 2010], [2010, 2027]]) {
    const rows = await sorgu(`film ${a}-${b}`, `
      SELECT ?f ?fLabel ?date ?dirLabel ?img ?sl WHERE {
        ?f wdt:P31 wd:Q11424; wdt:P495 wd:Q43; wdt:P577 ?date.
        FILTER(?date >= "${a}-01-01T00:00:00Z"^^xsd:dateTime && ?date < "${b}-01-01T00:00:00Z"^^xsd:dateTime)
        # ortak yapımlardaki yabancı filmler karışmasın: dili Türkçe ya da Türkçe Vikipedi maddesi olanlar
        FILTER(EXISTS { ?f wdt:P364 wd:Q256 } || EXISTS { ?trm schema:about ?f; schema:isPartOf <https://tr.wikipedia.org/> })
        ?f wikibase:sitelinks ?sl.
        OPTIONAL { ?f wdt:P57 ?dir }
        OPTIONAL { ?f wdt:P18 ?img }
        ${ETIKET}
      }`);
    for (const r of rows) {
      const id = qid(v(r, 'f'));
      const ad = v(r, 'fLabel');
      if (!ad || /^Q\d+$/.test(ad)) continue;
      const t = gun(v(r, 'date'));
      const e = m.get(id) ?? { q: id, n: ad, t, yon: v(r, 'dirLabel'), img: resim(v(r, 'img')), s: Number(v(r, 'sl')) };
      if (t < e.t) e.t = t;
      m.set(id, e);
    }
    console.log(`   ${a}-${b}: ${rows.length} satır (toplam ${m.size})`);
  }
  const yillik = {};
  for (const f of m.values()) (yillik[f.t.slice(0, 4)] ??= []).push(f);
  for (const y in yillik) yillik[y].sort((a, b) => (a.t < b.t ? -1 : 1));
  writeFileSync(join(OUT, 'filmler.json'), JSON.stringify(yillik));
  return { film: m.size, gunHassas: [...m.values()].filter((f) => !f.t.endsWith('-01-01')).length };
}

/* ---------------- 6. Türk sanatçıların albüm ve şarkıları ---------------- */
async function muzik() {
  console.log('\n[6/6] Türk sanatçıların albüm ve şarkıları');
  const m = new Map();
  for (const [a, b] of [[1950, 1975], [1975, 1990], [1990, 2005], [2005, 2015], [2015, 2027]]) {
    const rows = await sorgu(`muzik ${a}-${b}`, `
      SELECT ?w ?wLabel ?tip ?date ?perfLabel ?img ?sl WHERE {
        VALUES ?tip { wd:Q482994 wd:Q134556 wd:Q7366 wd:Q208569 wd:Q169930 }
        ?w wdt:P31 ?tip; wdt:P175 ?perf; wdt:P577 ?date.
        { ?perf wdt:P27 wd:Q43 } UNION { ?perf wdt:P495 wd:Q43 } UNION { ?w wdt:P495 wd:Q43 }
        FILTER(?date >= "${a}-01-01T00:00:00Z"^^xsd:dateTime && ?date < "${b}-01-01T00:00:00Z"^^xsd:dateTime)
        ?w wikibase:sitelinks ?sl.
        OPTIONAL { ?w wdt:P18 ?img }
        ${ETIKET}
      }`);
    for (const r of rows) {
      const id = qid(v(r, 'w'));
      const ad = v(r, 'wLabel');
      if (!ad || /^Q\d+$/.test(ad)) continue;
      const tipQ = qid(v(r, 'tip'));
      const tur = tipQ === 'Q482994' || tipQ === 'Q208569' || tipQ === 'Q169930' ? 'albüm' : tipQ === 'Q134556' ? 'single' : 'şarkı';
      const t = gun(v(r, 'date'));
      const e = m.get(id) ?? { q: id, n: ad, sanatci: v(r, 'perfLabel'), tur, t, img: resim(v(r, 'img')), s: Number(v(r, 'sl')) };
      if (t < e.t) e.t = t;
      m.set(id, e);
    }
    console.log(`   ${a}-${b}: ${rows.length} satır (toplam ${m.size})`);
  }
  const yillik = {};
  for (const x of m.values()) (yillik[x.t.slice(0, 4)] ??= []).push(x);
  for (const y in yillik) yillik[y].sort((a, b) => (a.t < b.t ? -1 : 1));
  writeFileSync(join(OUT, 'muzik.json'), JSON.stringify(yillik));
  const say = (tr) => [...m.values()].filter((x) => x.tur === tr).length;
  return { eser: m.size, album: say('albüm'), single: say('single'), sarki: say('şarkı') };
}

/* ---------------- çalıştır ---------------- */
const basla = Date.now();
console.log('Kadran Wikidata toplayıcı başladı. İnternet hızına göre 5-20 dakika sürebilir.');
const rapor = {};
for (const [ad, fn] of [['doganlar', doganlar], ['vefatlar', vefatlar], ['olaylar', olaylar], ['diziler', diziler], ['filmler', filmler], ['muzik', muzik]]) {
  try { rapor[ad] = await fn(); } catch (e) { hatalar.push(`${ad}: ${e.message}`); console.log(`!! ${ad} başarısız: ${e.message}`); }
}
const sure = Math.round((Date.now() - basla) / 1000);
const metin = [
  `Kadran Wikidata raporu — ${new Date().toISOString()}`,
  `Süre: ${sure} sn`,
  '',
  ...Object.entries(rapor).map(([k, val]) => `${k}: ${JSON.stringify(val)}`),
  '',
  hatalar.length ? `HATALAR (${hatalar.length}):\n` + hatalar.join('\n') : 'Hata yok.',
  '',
  'Lisans: Wikidata verisi CC0. Görseller Wikimedia Commons; her görselin kendi lisansı vardır, yayına çıkmadan kontrol edilecek.',
].join('\n');
writeFileSync(join(OUT, 'RAPOR.txt'), metin);
console.log('\n' + metin);
console.log('\nBitti. Bu pencereyi kapatabilirsin.');
