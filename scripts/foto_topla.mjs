// Kadran — Wikimedia Commons'tan dönem fotoğrafları
//
// Her yıl için "Category:YYYY in Turkey" ağacını (2 seviye alt kategori) gezer, serbest lisanslı
// fotoğrafları toplar, konuya göre etiketler (spor, siyaset, sokak, ulaşım, eşya…).
// Çekim tarihi tam belli olanlar ayrıca "o günün fotoğrafı" olarak gün gün indekslenir.
//
// Sadece: JPEG/PNG fotoğraflar, CC0 / CC BY / CC BY-SA / kamu malı. Harita, logo, bayrak, arma, çizim elenir.
// Her fotoğrafın yazarı, lisansı ve sayfası kaydedilir (yayında kaynak gösterilecek).
//
// Çıktı: veri-ek/foto/YYYY.json + veri-ek/foto/gunluk.json + veri-ek/FOTO_RAPOR.txt
// Kullanım: node scripts/foto_topla.mjs [başlangıç-yılı] [bitiş-yılı]

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'veri-ek', 'foto');
mkdirSync(OUT, { recursive: true });
const API = 'https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&';
const UA = 'KadranMobil/0.1 (https://github.com/gencyusuftalha9-oss/kadran; Turkiye nostalji uygulamasi) node';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Y1 = Number(process.argv[2]) || 1950, Y2 = Number(process.argv[3]) || 2025;

async function api(params) {
  let son = '';
  for (let d = 0; d < 5; d++) {
    try {
      const r = await fetch(API + params, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      son = `HTTP ${r.status}`;
      if (r.status === 429) await sleep(15000);
    } catch (e) { son = String(e?.cause?.code || e?.message || e); }
    await sleep(1500 * (d + 1));
  }
  throw new Error(son);
}

async function uyeler(kategori, tip) {
  const out = [];
  let cont = '';
  for (let s = 0; s < 20; s++) {
    const j = await api(`action=query&list=categorymembers&cmtitle=${encodeURIComponent(kategori)}&cmtype=${tip}&cmlimit=500${cont}`);
    out.push(...(j.query?.categorymembers ?? []).map((m) => m.title));
    if (!j.continue?.cmcontinue) break;
    cont = `&cmcontinue=${encodeURIComponent(j.continue.cmcontinue)}`;
  }
  return out;
}

/* Konu etiketleri: kategori ve dosya adlarına göre */
const KONU = [
  ['spor', /football|soccer|futbol|stadium|stadyum|fans|taraftar|basketball|basketbol|volleyball|voleybol|wrestling|güreş|sport|Galatasaray|Fenerbah|Beşiktaş|Besiktas|Trabzonspor|olympic|match|maç/i],
  ['siyaset', /parliament|TBMM|Grand National Assembly|meclis|politic|siyaset|election|seçim|protest|miting|rally|demonstration|president|cumhurbaşkan|prime minister|başbakan|party|parti/i],
  ['ulasim', /tram|tramvay|bus|otobüs|ferry|vapur|train|tren|railway|metro|airport|havaliman|car|otomobil|taxi|taksi|dolmuş|road|bridge|köprü|ship|gemi/i],
  ['sokak', /street|sokak|cadde|market|pazar|bazaar|çarşı|people|insanlar|daily life|gündelik|shop|dükkan|square|meydan|neighborhood|mahalle|children|çocuk|wedding|düğün/i],
  ['saglik_egitim', /hospital|hastane|school|okul|university|üniversite|student|öğrenci|clinic/i],
  ['kultur', /concert|konser|music|müzik|cinema|sinema|theatre|tiyatro|festival|television|TV|radio|singer|şarkıcı|actor|oyuncu|film/i],
  ['esya', /fashion|moda|shoes|ayakkabı|clothing|giyim|product|ürün|toy|oyuncak|telephone|telefon|computer|bilgisayar|cassette|kaset|camera|advert|reklam|packaging|ambalaj|coin|banknote|para/i],
  ['afet', /earthquake|deprem|flood|sel|fire|yangın|disaster|afet/i],
  ['mimari', /building|bina|mosque|cami|architecture|mimari|tower|kule|construction|inşaat|skyline/i],
];
const ELE = /\b(map|harita|locator|location|logo|flag|bayrak|coat of arms|arma|emblem|seal|diagram|chart|graph|signature|imza|icon|svg|plan|stamp of|pul)\b/i;
const SERBEST = /^(CC0|CC BY(-SA)? ?\d?(\.\d)?|CC-BY(-SA)?-\d(\.\d)?|Public domain|PD|No restrictions)/i;

function konuBul(metin) {
  const k = KONU.filter(([, re]) => re.test(metin)).map(([ad]) => ad);
  return k.length ? k : ['genel'];
}
const temiz = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function yilTopla(yil) {
  // kök kategori + 2 seviye alt kategori
  const kok = `Category:${yil} in Turkey`;
  const kategoriler = new Map([[kok, '']]);
  let seviye = [kok];
  for (let d = 0; d < 2; d++) {
    const sonraki = [];
    for (const k of seviye) {
      for (const alt of await uyeler(k, 'subcat')) {
        if (kategoriler.has(alt)) continue;
        if (/maps|flags|logos|coats of arms|people by name|deaths|births/i.test(alt)) continue;
        kategoriler.set(alt, k); sonraki.push(alt);
      }
      await sleep(150);
    }
    seviye = sonraki.slice(0, 120);
  }
  // dosyalar
  const dosyalar = new Map(); // başlık → kategori
  for (const k of kategoriler.keys()) {
    for (const f of await uyeler(k, 'file')) if (!dosyalar.has(f) && /\.(jpe?g|png)$/i.test(f) && !ELE.test(f)) dosyalar.set(f, k);
    await sleep(120);
    if (dosyalar.size > 1500) break;
  }
  // bilgiler: lisans, yazar, tarih, küçük görsel
  const fotolar = [];
  const basliklar = [...dosyalar.keys()];
  for (let i = 0; i < basliklar.length; i += 40) {
    const parti = basliklar.slice(i, i + 40);
    const j = await api(`action=query&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=800&titles=${encodeURIComponent(parti.join('|'))}`);
    for (const p of j.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const md = ii.extmetadata ?? {};
      const lisans = temiz(md.LicenseShortName?.value);
      if (!SERBEST.test(lisans)) continue;
      if (ii.width < 500 || ii.height < 350) continue;
      const tarih = temiz(md.DateTimeOriginal?.value);
      const tam = tarih.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (tarih && !tarih.includes(String(yil)) && !(tam && tam[1] === String(yil))) continue; // başka yılda çekilmiş
      const kat = dosyalar.get(p.title) ?? '';
      const aciklama = temiz(md.ImageDescription?.value).slice(0, 200);
      fotolar.push({
        f: p.title.replace(/^File:/, ''),
        u: ii.thumburl ?? ii.url,
        w: ii.thumbwidth, h: ii.thumbheight,
        g: tam && tam[1] === String(yil) ? `${tam[1]}-${tam[2]}-${tam[3]}` : undefined, // çekim günü
        a: aciklama || undefined,
        k: konuBul(`${kat} ${p.title} ${aciklama}`),
        kat: kat.replace(/^Category:/, ''),
        l: lisans,
        y: temiz(md.Artist?.value).slice(0, 80),
        s: ii.descriptionurl,
      });
    }
    await sleep(300);
  }
  return { kategori: kategoriler.size, fotolar };
}

const rapor = [];
const gunluk = existsSync(join(OUT, 'gunluk.json')) ? JSON.parse(readFileSync(join(OUT, 'gunluk.json'), 'utf8')) : {};
const basla = Date.now();
console.log(`Kadran foto toplayıcı: ${Y1}–${Y2} (yıl başına 1-3 dakika)`);
for (let y = Y2; y >= Y1; y--) {
  try {
    const { kategori, fotolar } = await yilTopla(y);
    writeFileSync(join(OUT, `${y}.json`), JSON.stringify(fotolar));
    for (const f of fotolar) if (f.g) (gunluk[f.g] ??= []).some((x) => x.f === f.f) || gunluk[f.g].push(f);
    writeFileSync(join(OUT, 'gunluk.json'), JSON.stringify(gunluk));
    const say = {};
    for (const f of fotolar) for (const k of f.k) say[k] = (say[k] ?? 0) + 1;
    const r = `${y}: ${fotolar.length} foto (${kategori} kategori), çekim günü belli: ${fotolar.filter((f) => f.g).length} · ${Object.entries(say).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`;
    console.log('  ' + r); rapor.push(r);
  } catch (e) {
    const r = `${y}: HATA ${e.message}`; console.log('  ' + r); rapor.push(r);
  }
}
const toplam = rapor.reduce((t, r) => t + (Number(r.match(/: (\d+) foto/)?.[1]) || 0), 0);
const metin = [`Kadran foto raporu — ${new Date().toISOString()}`, `Süre: ${Math.round((Date.now() - basla) / 60000)} dk`, `Toplam: ${toplam} foto, ${Object.keys(gunluk).length} günün kendi fotoğrafı var`, '', ...rapor, '',
  'Lisans: Wikimedia Commons; her fotoğrafın kendi lisansı (CC0/CC BY/CC BY-SA/kamu malı) ve yazarı kayıtlıdır — uygulamada gösterilecek.'].join('\n');
writeFileSync(join(ROOT, 'veri-ek', 'FOTO_RAPOR.txt'), metin);
console.log('\n' + metin + '\n\nBitti. Bu pencereyi kapatabilirsin.');
