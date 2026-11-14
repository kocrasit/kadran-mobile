// Kadran — gündem, deprem ve müzik toplayıcı
//
// 1) Türkçe Vikipedi gün sayfaları ("27 Ekim" …): o tarihte yıl yıl dünyada ve Türkiye'de olanlar (CC BY-SA 4.0)
// 2) USGS deprem kataloğu: 1950'den bugüne Türkiye'deki 4.0 ve üzeri depremler (kamu malı)
// 3) YouTube: verideki şarkıların uygulama içinde çalınabilir olup olmadığı (oEmbed kontrolü)
//
// Çıktılar: veri-ek/gunler.json, veri-ek/deprem.json, veri-ek/youtube.json, veri-ek/GUNDEM_RAPOR.txt
// Kullanım: node scripts/gundem_topla.mjs            (hepsi)
//           node scripts/gundem_topla.mjs --muziksiz (YouTube kontrolünü atla)

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { temizle } from './vikipedi_topla.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'veri-ek');
const CACHE = join(OUT, '.cache');
mkdirSync(CACHE, { recursive: true });
const DATA_DIR = process.env.KADRAN_DATA || join(ROOT, '..', '..', 'kadran', 'public', 'data');
const UA = 'KadranMobil/0.1 (https://github.com/gencyusuftalha9-oss/kadran; nostalji uygulamasi veri toplama)';
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rapor = [];

async function getJson(url, tries = 5) {
  let son = '';
  for (let d = 0; d < tries; d++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      son = `HTTP ${r.status}`;
      if (r.status === 400 || r.status === 404) break;
    } catch (e) { son = String(e?.cause?.code || e?.message || e); }
    await sleep(2000 * (d + 1));
  }
  throw new Error(`${son} — ${url.slice(0, 140)}`);
}

/* ---------------- 1) Vikipedi gün sayfaları ---------------- */
const TR_RE = /Türkiye|Türk|TBMM|Ankara|İstanbul|İzmir|Anadolu|Atatürk|Kıbrıs|Galatasaray|Fenerbahçe|Beşiktaş|Trabzon|Bursa|Antalya|Adana|Konya|Diyarbakır|PKK|THY|TRT/;

function gunSayfasi(metin) {
  const olay = {};
  let bolum = false, curYil = null;
  for (const satir of metin.split('\n')) {
    const h = satir.match(/^(=+)\s*([^=]+?)\s*=+\s*$/);
    if (h) {
      const ad = h[2].toLocaleLowerCase('tr-TR');
      if (h[1].length === 2) { bolum = ad.startsWith('olay'); curYil = null; }
      continue;
    }
    if (!bolum || !satir.startsWith('*')) continue;
    const derin = satir.match(/^\*+/)[0].length;
    const govde = satir.replace(/^\*+\s*/, '');
    const m = govde.match(/^\[?\[?(\d{3,4})\]?\]?\s*(?:[-–—:]\s*(.*))?$/);
    let yil = null, metin2 = null;
    if (m && Number(m[1]) > 1000) { yil = Number(m[1]); metin2 = m[2] ?? null; if (derin === 1) curYil = yil; }
    else if (derin > 1 && curYil) { yil = curYil; metin2 = govde; }
    if (!yil || !metin2) continue;
    const t = temizle(metin2);
    if (t.length < 8) continue;
    (olay[yil] ??= []).push(t);
  }
  return olay;
}

async function gunler() {
  console.log('\n[1/3] Vikipedi gün sayfaları (366 gün)');
  const basliklar = [];
  for (let m = 0; m < 12; m++) for (let g = 1; g <= new Date(Date.UTC(2024, m + 1, 0)).getUTCDate(); g++) basliklar.push({ t: `${g} ${AY[m]}`, k: `${String(m + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}` });
  const sonuc = {};
  let toplam = 0, tr = 0;
  for (let i = 0; i < basliklar.length; i += 40) {
    const parti = basliklar.slice(i, i + 40);
    const url = 'https://tr.wikipedia.org/w/api.php?format=json&formatversion=2&action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=' + encodeURIComponent(parti.map((p) => p.t).join('|'));
    const j = await getJson(url);
    const icerik = {};
    for (const p of j.query?.pages ?? []) icerik[p.title] = p.revisions?.[0]?.slots?.main?.content ?? '';
    for (const p of parti) {
      const olay = gunSayfasi(icerik[p.t] ?? '');
      const sec = {};
      for (const [y, list] of Object.entries(olay)) {
        if (Number(y) < 1950) continue;
        sec[y] = list.map((x) => ({ t: x, tr: TR_RE.test(x) ? 1 : 0 }));
        toplam += list.length; tr += sec[y].filter((x) => x.tr).length;
      }
      sonuc[p.k] = sec;
    }
    process.stdout.write(`   ${Math.min(i + 40, basliklar.length)}/${basliklar.length}\r`);
    await sleep(800);
  }
  writeFileSync(join(OUT, 'gunler.json'), JSON.stringify(sonuc));
  const kapsam = {};
  for (const d of ['198', '199', '200', '201', '202']) {
    let n = 0; for (const k in sonuc) for (const y in sonuc[k]) if (y.startsWith(d)) n++;
    kapsam[d + "0'lar"] = n;
  }
  const r = `gunler: ${toplam} olay (${tr} Türkiye ile ilgili), 1950 sonrası. Olay bulunan gün-yıl sayısı: ${JSON.stringify(kapsam)}`;
  console.log('\n   ' + r); rapor.push(r);
}

/* ---------------- 2) USGS depremler ---------------- */
const YON = { N: 'kuzeyi', NNE: 'kuzeyi', NE: 'kuzeydoğusu', ENE: 'doğusu', E: 'doğusu', ESE: 'doğusu', SE: 'güneydoğusu', SSE: 'güneyi', S: 'güneyi', SSW: 'güneyi', SW: 'güneybatısı', WSW: 'batısı', W: 'batısı', WNW: 'batısı', NW: 'kuzeybatısı', NNW: 'kuzeyi' };
const BOLGE = { 'western Turkey': 'Batı Türkiye', 'eastern Turkey': 'Doğu Türkiye', 'central Turkey': 'Orta Anadolu', 'Turkey': 'Türkiye', 'Aegean Sea': 'Ege Denizi', 'Sea of Marmara': 'Marmara Denizi', 'Black Sea': 'Karadeniz', 'Turkey-Syria border region': 'Türkiye-Suriye sınırı', 'Turkey-Iran border region': 'Türkiye-İran sınırı', 'Dodecanese Islands, Greece': 'Onikiadalar açıkları', 'eastern Mediterranean Sea': 'Doğu Akdeniz' };
function yerTr(place) {
  const p = (place || '').replace(/,\s*(Turkey|Türkiye)$/, '');
  const m = p.match(/^(\d+)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/);
  if (m) return `${m[3]} · ${m[1]} km ${YON[m[2]] ?? ''}`.trim();
  return BOLGE[p] ?? BOLGE[place] ?? p;
}
function yerelSaat(ms) {
  // 2016'dan beri UTC+3; öncesinde yaz saati (Mart son pazar – Ekim son pazar) UTC+3, kış UTC+2
  const d = new Date(ms); const y = d.getUTCFullYear();
  let off = 3;
  if (y < 2016) {
    const sonPazar = (ay) => { const t = new Date(Date.UTC(y, ay + 1, 0)); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); t.setUTCHours(1); return t.getTime(); };
    off = ms >= sonPazar(2) && ms < sonPazar(9) ? 3 : 2;
  }
  const l = new Date(ms + off * 3600000);
  return { gun: l.toISOString().slice(0, 10), saat: l.toISOString().slice(11, 16) };
}
const KOMSU = /Greece|Syria|Iran|Iraq|Georgia|Armenia|Azerbaijan|Bulgaria|Cyprus|Lebanon|Romania|Russia/;
function ekle(hepsi, gun, kayit) { (hepsi[gun] ??= []).push(kayit); }

/** Önce AFAD (Türkçe yer adları); olmazsa USGS.
 * AFAD bir sorguda sınırlı sayıda kayıt döndürüyor: eski sürüm yıllık sorguyla 6 Şubat 2023'ün 7.7'lik
 * ana şokunu kaçırmıştı (artçılar sınırı doldurmuştu). Artık aylık sorgu; kalabalık aralık ikiye bölünür. */
const AFAD_SINIR_SUPHESI = 400;
async function afadAralik(a, b) {
  const iso = (t) => new Date(t).toISOString().slice(0, 19);
  const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${iso(a)}&end=${iso(b)}&minmag=4&format=json&orderby=timedesc`;
  const j = await getJson(url, 3);
  const liste = Array.isArray(j) ? j : j?.result ?? j?.data ?? [];
  if (liste.length >= AFAD_SINIR_SUPHESI && b - a > 6 * 3600e3) {
    const orta = a + Math.floor((b - a) / 2);
    await sleep(300);
    return [...(await afadAralik(a, orta)), ...(await afadAralik(orta, b))];
  }
  return liste;
}
async function depremAfad(hepsi) {
  let n = 0;
  const gor = new Set();
  for (let y = 1950; y <= 2026; y++) {
    for (let ay = 0; ay < 12; ay++) {
      const liste = await afadAralik(Date.UTC(y, ay, 1), Date.UTC(y, ay + 1, 1));
      for (const e of liste) {
        const id = e.eventID ?? e.eventId ?? `${e.date}|${e.magnitude}`;
        if (gor.has(id)) continue; gor.add(id);
        const m = Number(e.magnitude ?? e.mag); if (!(m >= 4)) continue;
        const turkiye = !e.country || /Türkiye|Turkey/i.test(e.country);
        if (!turkiye && m < 6.5) continue; // komşu ülkedeki çok büyük depremler (Sisam gibi) kalsın
        // AFAD tarihi UTC verir → Türkiye saatine çevir
        const t = Date.parse(String(e.date ?? e.eventDate).replace(' ', 'T') + (/(Z|[+-]\d\d:?\d\d)$/.test(String(e.date)) ? '' : 'Z'));
        if (isNaN(t)) continue;
        const { gun, saat } = yerelSaat(t);
        const yer = e.location || [e.district, e.province].filter(Boolean).join(', ') || e.country;
        ekle(hepsi, gun, { m: Math.round(m * 10) / 10, yer: turkiye ? yer : `${yer} (${e.country})`, saat, dr: Math.round(Number(e.depth) || 0) });
        n++;
      }
      await sleep(250);
    }
    process.stdout.write(`   AFAD ${y}: toplam ${n}\r`);
  }
  return n;
}

/** Bilinen büyük depremler: biri eksikse veri kaynağında sorun var demektir */
const BILINEN = [['1999-08-17', 7.4], ['1999-11-12', 7.0], ['2011-10-23', 7.0], ['2020-01-24', 6.5], ['2020-10-30', 6.6], ['2023-02-06', 7.5]];

async function depremUsgs(hepsi) {
  let n = 0;
  for (let a = 1950; a <= 2026; a += 4) {
    const b = Math.min(a + 4, 2027);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${a}-01-01&endtime=${b}-01-01&minlatitude=35.7&maxlatitude=42.3&minlongitude=25.5&maxlongitude=45.0&minmagnitude=4&orderby=time-asc`;
    const j = await getJson(url);
    for (const f of j.features ?? []) {
      const pr = f.properties, place = pr.place || '';
      const turkiye = /Turkey|Türkiye|Kahramanmara|Turkiye/.test(place) || !KOMSU.test(place);
      if (!turkiye && pr.mag < 6.5) continue;
      const { gun, saat } = yerelSaat(pr.time);
      ekle(hepsi, gun, { m: Math.round(pr.mag * 10) / 10, yer: yerTr(place), saat, dr: Math.round(f.geometry?.coordinates?.[2] ?? 0) });
      n++;
    }
    console.log(`   USGS ${a}-${b - 1}: toplam ${n}`);
    await sleep(600);
  }
  return n;
}

async function depremler() {
  console.log('\n[2/3] Deprem kataloğu (Türkiye, M4+)');
  let hepsi = {}, kaynak = 'AFAD', n = 0;
  try { n = await depremAfad(hepsi); if (n < 500) throw new Error(`AFAD az kayıt döndü (${n})`); }
  catch (e) { console.log(`\n   AFAD kullanılamadı (${e.message}); USGS'e geçiliyor`); hepsi = {}; kaynak = 'USGS'; n = await depremUsgs(hepsi); }
  const eksik = () => BILINEN.filter(([g, m]) => !((hepsi[g]?.[0]?.m ?? 0) >= m));
  for (const g in hepsi) hepsi[g].sort((x, y) => y.m - x.m);
  if (kaynak === 'AFAD' && eksik().length) {
    // AFAD'da eksik kalan büyük depremleri USGS'ten tamamla
    console.log(`\n   AFAD'da eksik büyük deprem: ${eksik().map(([g]) => g).join(', ')}; USGS ile tamamlanıyor`);
    const usgs = {}; await depremUsgs(usgs);
    for (const [g] of eksik()) for (const x of usgs[g] ?? []) if (x.m >= 6) ekle(hepsi, g, x);
    for (const g in hepsi) hepsi[g].sort((x, y) => y.m - x.m);
    kaynak = 'AFAD, USGS';
  }
  if (eksik().length) rapor.push(`UYARI: deprem verisinde eksik büyük deprem: ${eksik().map(([g]) => g).join(', ')}`);
  writeFileSync(join(OUT, 'deprem.json'), JSON.stringify({ kaynak, gunler: hepsi }));
  const buyuk = Object.values(hepsi).flat().filter((x) => x.m >= 6).length;
  const r = `deprem (${kaynak}): ${n} deprem (M4+), ${Object.keys(hepsi).length} farklı gün, ${buyuk} tanesi M6+. 2023-02-06 en büyük: ${hepsi['2023-02-06']?.[0]?.m ?? 'yok'} (${hepsi['2023-02-06']?.[0]?.yer ?? ''})`;
  console.log('\n   ' + r); rapor.push(r);
}

/* ---------------- 3) YouTube çalınabilirlik ---------------- */
async function youtube() {
  console.log('\n[3/3] YouTube: şarkılar uygulama içinde çalınabiliyor mu?');
  if (!existsSync(DATA_DIR)) { const r = `youtube: veri klasörü bulunamadı (${DATA_DIR})`; console.log('   ' + r); rapor.push(r); return; }
  const ids = new Set();
  for (const dec of readdirSync(DATA_DIR)) {
    const dir = join(DATA_DIR, dec);
    if (!/^\d{4}s$/.test(dec)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        for (const m of (d.music ?? []).slice(0, 8)) if (m.youtubeId) ids.add(m.youtubeId);
      } catch { /* bozuk dosya */ }
    }
  }
  const cacheFile = join(CACHE, 'youtube.json');
  const durum = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const kalan = [...ids].filter((id) => !(id in durum));
  console.log(`   ${ids.size} farklı şarkı; ${kalan.length} tanesi kontrol edilecek (öncekiler hatırlanıyor)`);
  let i = 0;
  const isci = async () => {
    while (kalan.length) {
      const id = kalan.shift();
      try {
        const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
        durum[id] = r.status === 200 ? 'ok' : r.status === 401 ? 'kapali' : r.status === 429 ? undefined : 'yok';
        if (r.status === 429) { kalan.push(id); await sleep(10000); }
      } catch { kalan.push(id); await sleep(3000); }
      if (++i % 200 === 0) { writeFileSync(cacheFile, JSON.stringify(durum)); console.log(`   ${i} kontrol edildi…`); }
      await sleep(120);
    }
  };
  await Promise.all(Array.from({ length: 6 }, isci));
  writeFileSync(cacheFile, JSON.stringify(durum));
  const ok = [], kapali = [], yok = [];
  for (const [id, s] of Object.entries(durum)) (s === 'ok' ? ok : s === 'kapali' ? kapali : yok).push(id);
  writeFileSync(join(OUT, 'youtube.json'), JSON.stringify({ ok, kapali, yok }));
  const r = `youtube: ${ok.length} çalınabilir, ${kapali.length} sahibi kapatmış, ${yok.length} kaldırılmış/gizli`;
  console.log('   ' + r); rapor.push(r);
}

/* ---------------- çalıştır ---------------- */
const basla = Date.now();
console.log('Kadran gündem/deprem/müzik toplayıcı başladı.');
for (const [ad, fn] of [['gunler', gunler], ['depremler', depremler], ['youtube', youtube]]) {
  if (ad === 'youtube' && process.argv.includes('--muziksiz')) continue;
  if (process.argv.includes('--sadece-deprem') && ad !== 'depremler') continue;
  try { await fn(); } catch (e) { const r = `${ad} HATA: ${e.message}`; console.log('!! ' + r); rapor.push(r); }
}
const metin = [`Kadran gündem raporu — ${new Date().toISOString()}`, `Süre: ${Math.round((Date.now() - basla) / 1000)} sn`, '', ...rapor, '',
  'Lisans: Vikipedi metinleri CC BY-SA 4.0 (kaynak gösterilecek); USGS kataloğu kamu malı; YouTube sadece resmi oynatıcıyla çalınır.'].join('\n');
writeFileSync(join(OUT, 'GUNDEM_RAPOR.txt'), metin);
console.log('\n' + metin + '\n\nBitti. Bu pencereyi kapatabilirsin.');
