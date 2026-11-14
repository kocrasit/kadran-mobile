// Kadran — gazete arşivi başlıklarına açıklama: haberin kendi sayfasından giriş paragrafı.
//
// Arşivden gelen başlıkların (Hürriyet, Sabah, NTV, Milliyet, Radikal, CNN Türk, BBC Türkçe…) yanında
// sadece o günün arşivlenmiş ana sayfası var. Bu betik:
//   1) o ana sayfayı (web.archive.org) açar, başlığın bağlantısını bulur,
//   2) haberin kendi arşiv sayfasını açar,
//   3) gazetenin kendi yazdığı özeti (description / og:description) ya da ilk paragrafları alır.
// Doğruluk için: başlık bağlantısı ancak metin neredeyse aynıysa eşleşir; haber sayfası o günden ±3 gün
// içinde arşivlenmiş olmalı; sitenin her sayfada tekrarlanan genel tanıtım yazısı atılır.
// Hiçbir şey uydurulmaz: bulunamayan başlık açıklamasız kalır.
// Alıntı kısa tutulur (en fazla 4 cümle / 420 harf) ve uygulamada kaynağıyla gösterilir.
//
// Çıktı: veri-ek/aciklama.json → { "2020-10-27": { "<başlık anahtarı>": { "o": "açıklama", "u": "arşiv adresi" } } }
// Kaldığı yerden devam eder (.aciklama-onbellek/). Kullanım: node scripts/aciklama_topla.mjs [başlangıç-yılı] [bitiş-yılı]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = resolve(process.env.KADRAN_DATA || join(ROOT, '..', '..', 'kadran', 'public', 'data'));
const CIKTI = join(ROOT, 'veri-ek', 'aciklama.json');
const ONBELLEK = join(ROOT, '.aciklama-onbellek');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const Y1 = Number(process.argv[2] || 1990), Y2 = Number(process.argv[3] || 2026);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(ONBELLEK, { recursive: true });

/** Başlık anahtarı: uygulamadaki ile aynı (küçük harf, harf ve rakamlar) */
export const anahtar = (t) => t.toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();
const kelimeler = (t) => new Set(anahtar(t).split(' ').filter((w) => w.length > 1));
function benzerlik(a, b) {
  const A = kelimeler(a), B = kelimeler(b);
  if (!A.size || !B.size) return 0;
  let ortak = 0; for (const w of A) if (B.has(w)) ortak++;
  return ortak / Math.max(A.size, B.size);
}

const VARLIK = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—',
  ccedil: 'ç', Ccedil: 'Ç', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü' };
const coz = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => VARLIK[n] ?? m);
const duz = (html) => coz(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Arşivden sayfa: önbellekli, saygılı hızda; eski sayfalarda Türkçe kodlama (windows-1254).
 * Döner: { html, son } — son: yönlendirmelerden sonraki gerçek arşiv adresi (hangi gün kaydedildiği belli olsun) */
async function sayfa(url) {
  const dosya = join(ONBELLEK, createHash('md5').update(url).digest('hex') + '.json');
  if (existsSync(dosya)) { const t = JSON.parse(readFileSync(dosya, 'utf8')); return t.yok ? null : t; }
  for (let d = 0; d < 4; d++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(40000) });
      if (r.status === 404) break;
      if (r.status === 429 || r.status >= 500) { await sleep(8000 * (d + 1)); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      let t = buf.toString('utf8');
      if (/charset=["']?(windows-1254|iso-8859-9)/i.test(t.slice(0, 3000)) || (t.match(/�/g)?.length ?? 0) > 20) t = new TextDecoder('windows-1254').decode(buf);
      const v = { html: t, son: r.url || url };
      writeFileSync(dosya, JSON.stringify(v)); await sleep(900);
      return v;
    } catch { await sleep(4000 * (d + 1)); }
  }
  writeFileSync(dosya, JSON.stringify({ yok: true }));
  return null;
}

/** Ana sayfadaki bağlantılar: [metin, adres] */
function baglantilar(html, taban) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
    const baslik = m[1].match(/title\s*=\s*["']([^"']+)["']/i)?.[1];
    const metin = duz(m[2]);
    let adres; try { adres = new URL(coz(href), taban).href; } catch { continue; }
    for (const t of [metin, baslik && coz(baslik)]) if (t && t.length >= 12) out.push([t, adres]);
  }
  return out;
}

const tarihi = (u) => u.match(/web\.archive\.org\/web\/(\d{8})/)?.[1];
const gunFarki = (a, b) => Math.abs(Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8)) - Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8))) / 864e5;

/** Haber sayfasından özet: gazetenin kendi açıklaması ya da ilk paragraflar */
function ozet(html) {
  const meta = (ad) => html.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${ad}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:name|property)\\s*=\\s*["']${ad}["']`, 'i'))?.[1];
  const adaylar = [meta('og:description'), meta('description'), meta('twitter:description')].filter(Boolean).map((x) => coz(x).replace(/\s+/g, ' ').trim());
  const govde = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const paragraflar = [...govde.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => duz(m[1])).filter((p) => p.length >= 80 && !/©|tüm hakları|copyright|çerez|cookie|abone ol/i.test(p));
  if (paragraflar.length) adaylar.push(paragraflar.slice(0, 2).join(' '));
  return adaylar.find((x) => x.length >= 60);
}

/** En fazla 4 cümle / 420 harf */
function kisalt(t) {
  const c = t.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“'])/);
  let out = '';
  for (const p of c.slice(0, 4)) { if ((out + ' ' + p).length > 420) break; out = out ? `${out} ${p}` : p; }
  return (out || t.slice(0, 417).replace(/\s+\S*$/, '') + '…').trim();
}

// --- hangi başlıklar: arşivden gelip açıklaması olmayanlar
const isler = []; // { iso, baslik, anaSayfa }
for (const klasor of readdirSync(DATA_DIR).filter((k) => /^\d{4}s$/.test(k))) {
  for (const f of readdirSync(join(DATA_DIR, klasor)).filter((f) => f.endsWith('.json'))) {
    const iso = f.slice(0, 10), y = Number(iso.slice(0, 4));
    if (y < Y1 || y > Y2) continue;
    let d; try { d = JSON.parse(readFileSync(join(DATA_DIR, klasor, f), 'utf8')); } catch { continue; }
    const hepsi = [...(d.events ?? []).map((e) => ({ t: e.title, b: e.body, s: e.sources?.[0] })),
      d.headline && { t: d.headline.value, s: d.headline.sources?.[0] }].filter(Boolean);
    for (const e of hepsi) if (e.t && !e.b && /web\.archive\.org\/web\/\d+/.test(e.s?.url ?? '')) isler.push({ iso, baslik: e.t, anaSayfa: e.s.url });
  }
}
console.log(`Açıklama aranacak başlık: ${isler.length} (${Y1}-${Y2})`);

const sonuc = existsSync(CIKTI) ? JSON.parse(readFileSync(CIKTI, 'utf8')) : {};
const ozetSayisi = new Map(); // sitenin genel tanıtım yazısını yakalamak için
const bulunan = [];
let n = 0, eslesen = 0, yazilan = 0;
for (const is of isler) {
  n++;
  if (sonuc[is.iso]?.[anahtar(is.baslik)]) continue;
  const anaS = await sayfa(is.anaSayfa);
  if (!anaS) continue;
  const ana = anaS.html;
  // başlık: "KİCKER: asıl başlık" biçiminde de olabilir
  const denenecek = [is.baslik, is.baslik.replace(/^[^:]{2,40}:\s*/, '')];
  let enIyi = null, puan = 0;
  for (const [metin, adres] of baglantilar(ana, is.anaSayfa)) {
    for (const b of denenecek) {
      const p = anahtar(metin) === anahtar(b) ? 1 : benzerlik(metin, b);
      if (p > puan) { puan = p; enIyi = adres; }
    }
  }
  if (!enIyi || puan < 0.8 || enIyi === is.anaSayfa) continue;
  const t0 = tarihi(is.anaSayfa);
  eslesen++;
  const haberS = await sayfa(enIyi);
  if (!haberS) continue;
  // arşiv başka bir güne yönlendirdiyse (haber sayfası çok sonra kaydedilmiş) güvenme
  const sonTarih = tarihi(haberS.son) ?? tarihi(enIyi);
  if (!t0 || !sonTarih || gunFarki(t0, sonTarih) > 3) continue;
  const o = ozet(haberS.html);
  if (!o || !/[çğıöşüÇĞİÖŞÜ]/.test(o)) continue;
  if (anahtar(o).startsWith(anahtar(is.baslik)) && o.length < is.baslik.length + 25) continue; // açıklama başlığın tekrarı
  ozetSayisi.set(o, (ozetSayisi.get(o) ?? 0) + 1);
  bulunan.push({ iso: is.iso, k: anahtar(is.baslik), o: kisalt(o), u: haberS.son, ham: o });
  if (n % 25 === 0) process.stdout.write(`   ${n}/${isler.length} · eşleşen ${eslesen} · açıklama ${bulunan.length}\r`);
}
// aynı yazı birden çok haberde çıktıysa sitenin genel tanıtımıdır: at
for (const b of bulunan) {
  if ((ozetSayisi.get(b.ham) ?? 0) > 1) continue;
  (sonuc[b.iso] ??= {})[b.k] = { o: b.o, u: b.u };
  yazilan++;
}
writeFileSync(CIKTI, JSON.stringify(sonuc));
const rapor = `Açıklama: ${isler.length} başlık tarandı, ${eslesen} başlığın haber sayfası bulundu, ${yazilan} yeni açıklama yazıldı. Toplam: ${Object.values(sonuc).reduce((a, x) => a + Object.keys(x).length, 0)}`;
console.log('\n' + rapor);
writeFileSync(join(ROOT, 'veri-ek', 'ACIKLAMA_RAPOR.txt'), rapor + '\n');
