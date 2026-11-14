// Kadran — Türkçe Vikipedi'den ek veri toplama.
//
// 1) "1985'te Türkiye" gibi yıllık sayfalardan tarihli olaylar, doğumlar, vefatlar
// 2) "YYYY'de başlayan Türk televizyon dizileri" kategorilerinden diziler
//    (kanal, ilk yayın, son yayın — bilgi kutusundan)
//
// Çıktılar kadran-mobile/veri-ek/ altına yazılır; arkadaşların web verisine dokunulmaz.
// İçerik Vikipedi'den alınmıştır (CC BY-SA 4.0) — uygulamada kaynak gösterilir.
//
// Kullanım:  node scripts/vikipedi_topla.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'veri-ek');
const API = 'https://tr.wikipedia.org/w/api.php?format=json&formatversion=2&';
const HEADERS = {
  'User-Agent': 'KadranMobil/0.1 (https://github.com/gencyusuftalha9-oss/kadran; nostalji uygulamasi veri toplama) node-fetch',
  'Accept': 'application/json',
};
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Yıl + bulunma eki: 1985'te, 1990'da, 2000'de, 2014'te … */
export function yilEki(y, cogul = false) {
  if (cogul) { // 1980'lerde / 1990'larda
    const t = { 0: "'lerde", 10: "'larda", 20: "'lerde", 30: "'larda", 40: "'larda", 50: "'lerde", 60: "'larda", 70: "'lerde", 80: "'lerde", 90: "'larda" };
    return `${y}${t[y % 100]}`;
  }
  const l2 = y % 100;
  if (l2 === 0) return `${y}'de`;
  if (l2 % 10 === 0) return `${y}${{ 10: "'da", 20: "'de", 30: "'da", 40: "'ta", 50: "'de", 60: "'ta", 70: "'te", 80: "'de", 90: "'da" }[l2]}`;
  return `${y}${{ 1: "'de", 2: "'de", 3: "'te", 4: "'te", 5: "'te", 6: "'da", 7: "'de", 8: "'de", 9: "'da" }[y % 10]}`;
}

export function temizle(s) {
  return s
    .replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '').replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:Dosya|File|Resim|Kategori):[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '')
    .replace(/'''?/g, '').replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').replace(/^[\s,;:–-]+/, '').trim();
}

/** "25 Ekim 2014" → "2014-10-25", "1993" → "1993", tanınmazsa null */
export function tarih(s) {
  const tpl = (s || '').match(/\{\{[^}]*?\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/);
  if (tpl) return `${tpl[1]}-${tpl[2].padStart(2, '0')}-${tpl[3].padStart(2, '0')}`;
  const t = temizle(s || '');
  const m = t.match(new RegExp(`(\\d{1,2})\\s+(${AY.join('|')})\\s+(\\d{4})`));
  if (m) return `${m[3]}-${String(AY.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const ay = t.match(new RegExp(`(${AY.join('|')})\\s+(\\d{4})`));
  if (ay) return `${ay[2]}-${String(AY.indexOf(ay[1]) + 1).padStart(2, '0')}`;
  const y = t.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  return y ? y[1] : null;
}

/** Yıllık sayfadan olay / doğum / vefat satırlarını çıkarır. */
export function yilSayfasiniAyristir(yil, metin) {
  const out = { olay: {}, dogum: {}, olum: {} };
  const tarihRe = new RegExp(`^\\[\\[(\\d{1,2}) (${AY.join('|')})\\]\\]\\s*(?:[-–—:]\\s*)?(.*)$`);
  let bolum = null, cur = null;
  for (const satir of metin.split('\n')) {
    const h = satir.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (h) {
      const n = h[1].toLocaleLowerCase('tr-TR');
      bolum = n.startsWith('olay') ? 'olay' : n.startsWith('doğum') ? 'dogum' : (n.startsWith('ölüm') || n.startsWith('vefat')) ? 'olum' : null;
      cur = null;
      continue;
    }
    if (!bolum || !satir.startsWith('*')) continue;
    const derinlik = satir.match(/^\*+/)[0].length;
    const govde = satir.replace(/^\*+\s*/, '');
    const m = govde.match(tarihRe);
    let iso = null, metin2 = null;
    if (m) {
      iso = `${yil}-${String(AY.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      cur = iso;
      metin2 = temizle(m[3]);
    } else if (derinlik > 1 && cur) {
      iso = cur;
      metin2 = temizle(govde);
    }
    if (iso && metin2 && metin2.length > 3) (out[bolum][iso] ??= []).push(metin2);
  }
  return out;
}

/** Dizi bilgi kutusundan kanal / ilk yayın / son yayın */
export function diziBilgisi(baslik, metin) {
  const alan = (ad) => {
    const m = metin.match(new RegExp(`^\\|[ \\t]*${ad}[ \\t]*=[ \\t]*(.*)$`, 'mi'));
    return m ? m[1] : '';
  };
  const kanalHam = alan('kanal') || alan('kanalı') || alan('yayın_kanalı');
  const kanal = temizle(kanalHam.split(/<br\s*\/?>/i)[0]).replace(/\s*\(.*$/, '').trim();
  const ilk = tarih(alan('ilk_yayın') || alan('ilk_yayın_tarihi') || alan('yayın_tarihi') || alan('başlangıç'));
  const son = tarih(alan('son_yayın') || alan('son_yayın_tarihi') || alan('bitiş'));
  const ad = baslik.replace(/\s*\((?:\d{4}\s+)?(?:televizyon\s+)?dizi(?:si)?\)$/i, '').trim();
  return ilk ? [ad, kanal || null, ilk, son] : null;
}

async function api(params) {
  let son = '';
  for (let deneme = 0; deneme < 5; deneme++) {
    try {
      const r = await fetch(API + params, { headers: HEADERS });
      if (r.ok) return await r.json();
      son = `HTTP ${r.status} ${(await r.text()).slice(0, 160)}`;
    } catch (e) {
      son = String(e?.cause?.code || e?.message || e);
    }
    await sleep(2000 * (deneme + 1));
  }
  throw new Error(`Vikipedi yanıt vermedi (${son}) — ${decodeURIComponent(params).slice(0, 120)}`);
}

async function sayfalar(basliklar) {
  const sonuc = {};
  for (let i = 0; i < basliklar.length; i += 40) {
    const parti = basliklar.slice(i, i + 40);
    const j = await api('action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=' + encodeURIComponent(parti.join('|')));
    for (const p of j.query?.pages ?? []) {
      if (p.missing) continue;
      sonuc[p.title] = p.revisions?.[0]?.slots?.main?.content ?? '';
    }
    await sleep(300);
  }
  return sonuc;
}

async function kategoriUyeleri(kategori) {
  const uyeler = [];
  let devam = '';
  do {
    const j = await api('action=query&list=categorymembers&cmnamespace=0&cmlimit=500&cmtitle=' + encodeURIComponent(kategori) + devam);
    uyeler.push(...(j.query?.categorymembers ?? []).map((x) => x.title));
    devam = j.continue?.cmcontinue ? '&cmcontinue=' + encodeURIComponent(j.continue.cmcontinue) : '';
    await sleep(200);
  } while (devam);
  return uyeler;
}

async function yillikTurkiye() {
  const yillar = [];
  for (let y = 1950; y <= 2025; y++) yillar.push(y); // 13 Kasım: 1950'ye genişletildi
  const metinler = await sayfalar(yillar.map((y) => `${yilEki(y)} Türkiye`));
  await mkdir(join(OUT, 'turkiye'), { recursive: true });
  let toplam = 0;
  for (const y of yillar) {
    const metin = metinler[`${yilEki(y)} Türkiye`];
    if (!metin) { console.log('  bulunamadı:', `${yilEki(y)} Türkiye`); continue; }
    const veri = yilSayfasiniAyristir(y, metin);
    toplam += Object.values(veri.olay).flat().length;
    await writeFile(join(OUT, 'turkiye', `${y}.json`), JSON.stringify({
      kaynak: `Vikipedi — ${yilEki(y)} Türkiye (CC BY-SA 4.0)`,
      url: `https://tr.wikipedia.org/wiki/${encodeURIComponent(`${yilEki(y)} Türkiye`)}`,
      ...veri,
    }));
  }
  console.log(`  ${toplam} tarihli olay yazıldı`);
}

async function diziler() {
  const kategoriler = [];
  for (let y = 1968; y <= 2026; y++) kategoriler.push(`Kategori:${yilEki(y)} başlayan Türk televizyon dizileri`);
  const basliklar = new Set();
  let hata = 0;
  for (const k of kategoriler) {
    try {
      (await kategoriUyeleri(k)).forEach((t) => basliklar.add(t));
    } catch (e) {
      hata++;
      console.log('  atlandı:', k, '→', e.message.slice(0, 140));
    }
  }
  if (hata) console.log(`  ${hata} kategori atlandı`);
  console.log(`  ${basliklar.size} dizi sayfası bulundu, bilgi kutuları okunuyor…`);
  const metinler = await sayfalar([...basliklar]);
  const liste = [];
  for (const [baslik, metin] of Object.entries(metinler)) {
    const b = diziBilgisi(baslik, metin);
    if (b) liste.push(b);
  }
  liste.sort((a, b) => String(a[2]).localeCompare(String(b[2])));
  await writeFile(join(OUT, 'diziler.json'), JSON.stringify({
    kaynak: 'Vikipedi — Türk televizyon dizileri kategorileri (CC BY-SA 4.0)',
    alanlar: ['ad', 'kanal', 'ilk_yayin', 'son_yayin'],
    diziler: liste,
  }));
  console.log(`  ${liste.length} dizi tarihleriyle yazıldı`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  if (!process.argv.includes('--sadece-diziler')) {
    console.log('1/2 Yıllık Türkiye sayfaları…');
    await yillikTurkiye();
  }
  console.log('2/2 Türk dizileri…');
  await diziler();
  console.log('Bitti →', OUT);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
}
