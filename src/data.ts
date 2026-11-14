import { yerAdiDuzelt } from './yerAdlari';
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Veri kaynağı: telefona uygulamayı gönderen Expo sunucusu, web projesindeki
 * (kadran/public/data) gün dosyalarını /kadran-data/ altında servis eder
 * (bkz. metro.config.js). Ayrı bir sunucu ya da port gerekmez.
 */
export function dataBaseUrl(): string {
  // Web: sayfanın kendi adresi
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${(window as any).location.origin}/kadran-data`;
  }
  // Telefon: Expo Go'nun bağlandığı bilgisayarın adresi (örn. 172.20.10.4:8081)
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) return `http://${hostUri}/kadran-data`;
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const origin = scriptURL?.match(/^(https?:\/\/[^/]+)/)?.[1];
  return `${origin ?? 'http://localhost:8081'}/kadran-data`;
}

/* ---- Veri tipleri (web projesindeki types.ts'in mobilde kullandığımız kısmı) ---- */

export interface Source { name: string; url?: string }
export interface ImageRef { url: string; alt?: string; placeholder?: boolean; author?: string; license?: string; sourcePage?: string }

/** Gösterilebilir gerçek bir görsel mi? (yer tutucuları ele, http'yi https yap) */
/** Şarkı/film/dizi kartına düşen alakasız görseller: yazı logosu (svg), harita, şehir manzarası, kale, bayrak…
 * (ör. şarkıcı Bergen'e Norveç'teki Bergen şehrinin gece fotoğrafı, Jeanne d'Arc filmine kale maketi) */
function yanlisGorsel(url: string): boolean {
  let ad = url.includes('Special:FilePath/') ? url.split('Special:FilePath/')[1] : url.split('/').pop() ?? '';
  try { ad = decodeURIComponent(ad.split('?')[0]); } catch {}
  return /\.svg(\.png)?$|logo|wordmark|title[_ ]card|\bmap\b|harita|orthographic|flag|bayra|skyline|panorama|by[_ ]night|night[_ ]view|cityscape|view[_ ]of|aerial|harbou?r|castle|château|chateau|kalesi|fortress|\bfort\b|maquette|maket|model[_ ]of|cathedral|church|mosque|camii|stadium|stadyum/i.test(ad);
}

export function imageUrl(img?: ImageRef, adlar?: (string | undefined)[]): string | null {
  if (!img?.url || img.placeholder || img.url.startsWith('/')) return null;
  const url = img.url.replace(/^http:\/\//, 'https://');
  if (adlar && !adUygun(url, adlar)) return null;
  if (yanlisGorsel(url)) return null;
  return gorsel(url);
}

/**
 * Wikimedia görsellerini bilgisayardaki Kadran sunucusu üzerinden getirir (metro.config.js → /kadran-gorsel).
 * Wikimedia, uygulamaların toplu görsel isteklerini 429 ile engelliyor; sunucu indirip saklıyor.
 */
/** Wikimedia'nın izin verdiği standart küçük boyutlar; asıl dosya (bazen 10-20 MB) yerine 500 px'lik kopya iner */
function kucukBoy(u: string): string {
  // Special:FilePath/… → ?width=500
  if (/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(u)) return u.replace(/\?.*$/, '') + '?width=500';
  // …/thumb/a/ab/Ad.jpg/330px-Ad.jpg → standart boyuta yuvarla
  const t = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/thumb\/.+\/)(?:lang[a-z-]+-)?(\d+)px-([^/]+)$/);
  if (t) return Number(t[2]) > 500 ? `${t[1]}500px-${t[3]}` : u;
  // asıl dosya: /wikipedia/commons/a/ab/Ad.jpg → /wikipedia/commons/thumb/a/ab/Ad.jpg/500px-Ad.jpg
  const o = u.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/);
  if (o && !/\.(gif|ogg|ogv|webm|mp3|pdf|tiff?)$/i.test(o[4])) {
    const ek = /\.svg$/i.test(o[4]) ? '.png' : '';
    return `https://upload.wikimedia.org/wikipedia/${o[1]}/thumb/${o[2]}/${o[3]}/${o[4]}/500px-${o[4]}${ek}`;
  }
  return u;
}

export function gorsel(url?: string | null): string | null {
  if (!url) return null;
  // thumb.wikimedia.org adresleri upload.wikimedia.org ile aynı dosyayı verir; aracı (proxy) sadece upload'u kabul ediyor
  const u = kucukBoy(url.replace(/^http:\/\//, 'https://').replace(/^https:\/\/thumb\.wikimedia\.org\//, 'https://upload.wikimedia.org/').replace(/\?utm_[^#]*$/, ''));
  if (!/^https:\/\/(upload|commons)\.wikimedia\.org\//.test(u)) return u;
  return `${dataBaseUrl().replace(/\/kadran-data$/, '')}/kadran-gorsel?u=${encodeURIComponent(u)}`;
}

/** Wikidata kaydının Türkçe Vikipedi maddesindeki görsel (film afişi, albüm kapağı): sunucu Q → madde → görsel çözer */
export function wdGorsel(q?: string | null): string | null {
  if (!q || !/^Q\d+$/.test(q)) return null;
  return `${dataBaseUrl().replace(/\/kadran-data$/, '')}/kadran-gorsel?q=${q}`;
}

/** Vikipedi maddesinin baş görseli, bilgisayardaki aracı (proxy) üzerinden (madde → görsel adresini sunucu çözer). */
export function wpGorsel(baslik: string, dil = 'en'): string {
  return `${dataBaseUrl().replace(/\/kadran-data$/, '')}/kadran-gorsel?wp=${encodeURIComponent(baslik)}&wl=${dil}`;
}

/**
 * Görsel bu şarkının / dizinin / kişinin mi? (veri denetimi: arşivde adına göre bulunmuş alakasız görseller var —
 * Nilüfer'in şarkısına nilüfer çiçeği, "Rüya" filmine Rousseau'nun "Rüya" tablosu.)
 * Dosya adında addan bir kelime geçmeli; TMDB afişleri ve Internet Archive kayıtları güvenilir.
 */
const katla = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const ADSIZ = new Set(['the', 'and', 'film', 'jpg', 'jpeg', 'png', 'cropped', 'svg', 'afis', 'poster', 'album', 'dizi', 'logo']);
export function adUygun(url: string, adlar: (string | undefined)[]): boolean {
  if (/image\.tmdb\.org|archive\.org/.test(url)) return true;
  let ad = url.includes('Special:FilePath/') ? url.split('Special:FilePath/')[1] : url.split('/').pop() ?? '';
  ad = ad.split('?')[0];
  try { ad = decodeURIComponent(ad); } catch {}
  const dosya = katla(ad);
  const bitisik = dosya.replace(/[^a-z0-9]/g, '');
  const dosyaKel = new Set((dosya.match(/[a-z0-9]{3,}/g) ?? []).map((x) => x.slice(0, 5)));
  for (const a of adlar) {
    if (!a) continue;
    for (const k of katla(a).match(/[a-z0-9]{3,}/g) ?? []) {
      if (ADSIZ.has(k)) continue;
      if (dosyaKel.has(k.slice(0, 5)) || (k.length >= 4 && bitisik.includes(k.slice(0, 6)))) return true;
    }
  }
  return false;
}
export interface DayEvent { scope?: 'TR' | 'world'; title: string; body?: string; importance?: number | string; image?: ImageRef; sources?: { name: string; url?: string }[] }
export interface Song { title: string; artist: string; note?: string; youtubeId?: string; image?: ImageRef }
export interface TvProgram { channel?: string; program: string; note?: string; image?: ImageRef }
export interface Film { title: string; note?: string; youtubeId?: string; image?: ImageRef }
export interface Person { name: string; field?: string; bornYear?: number; image?: ImageRef }
export interface Weather { city: string; tempMin?: number; tempMax?: number; condition?: string }
export interface Valued { value: number; note?: string }
export interface Culture { type?: string; title: string; note?: string; image?: ImageRef }
export interface SportsItem { type?: 'match' | 'standing' | 'transfer' | 'other'; title: string; detail?: string }
export interface WebSnap { site: string; snapshotUrl: string; capturedAt?: string }
export interface Ad { brand: string; note?: string; image?: ImageRef; videoUrl?: string; youtubeId?: string }

export interface DayData {
  date: string;
  eraKey: string;
  headline?: { value: string };
  events?: DayEvent[];
  music?: Song[];
  tv?: TvProgram[];
  cinema?: Film[];
  notableBirths?: Person[];
  notableDeaths?: Person[];
  turkeyOfDay?: { year: number; photos: (ImageRef & { note?: string })[] };
  weather?: Weather[];
  economy?: { usdTry?: Valued; eurTry?: Valued; goldGram?: Valued };
  cultureMisc?: Culture[];
  ads?: Ad[];
  population?: { world?: Valued; turkey?: Valued };
  islamic?: { hijriDate?: string };
  sports?: SportsItem[];
  topSearches?: { year: number; terms: { term: string; rank: number }[] };
  webSnapshots?: WebSnap[];
  /** O günün gerçek gazete ön sayfası (arkadaşların verisi) */
  newspaperFront?: {
    provider?: 'milliyet' | 'gastearsivi' | 'kiosko' | 'turkiyegazetesi';
    paper?: string;
    image: { url: string; sourcePage?: string; license?: string; note?: string };
  };
  newspaperPages?: { count: number; pages: { no: number }[] };
  officialGazette?: {
    date: string; issueNumber?: number; fihristUrl: string; pdfUrl?: string; itemCount: number;
    items: { section: string; title: string; url?: string }[];
  };
  sky?: { title: string; mediaType?: string; imageUrl?: string; hdUrl?: string; license?: string; sources?: { url: string }[] };
}

/** Gazete sayfası görseli (bilgisayardaki Expo sunucusu Milliyet/Gaste Arşivi'nden taze çeker). */
export function gazeteUrl(iso: string, page?: number, thumb = false): string {
  const base = dataBaseUrl().replace(/\/kadran-data$/, '/kadran-gazete');
  const q = page != null ? `?page=${page}${thumb ? '&variant=thumb' : ''}` : '';
  return `${base}/${iso}${q}`;
}

function decadeFolder(year: number) {
  return `${Math.floor(year / 10) * 10}s`;
}

export function isoOf(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Arkadaşların gün arşivi 1980'de başlıyor; öncesi için boş gün döner, akış ek verilerden (Vikipedi, milli maçlar, kur) kurulur. */
export const ARSIV_BASI = 1980;
export async function fetchDay(iso: string): Promise<DayData> {
  const year = Number(iso.slice(0, 4));
  if (year < ARSIV_BASI) return { date: iso, eraKey: 'eski' } as DayData;
  const url = `${dataBaseUrl()}/${decadeFolder(year)}/${iso}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gün bulunamadı (${res.status})`);
  return (await res.json()) as DayData;
}

/* ---- Biçimlendirme ---- */

export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function weekdayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return GUNLER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Veri yeni TL cinsinden; 2005 öncesi için eski TL'ye çevirip gösterir. */
export function formatTL(valueYeniTL: number, year: number): string {
  if (year < 2005) {
    const eski = Math.round(valueYeniTL * 1_000_000);
    return `${eski.toLocaleString('tr-TR')} TL`;
  }
  return `${valueYeniTL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
}

/** Altın verisi 2005 öncesinde zaten eski TL cinsinden geliyor. */
export function formatGold(value: number, year: number): string {
  if (year < 2005) return `${Math.round(value).toLocaleString('tr-TR')} TL`;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
}

const AY_NO: Record<string, number> = { Oca: 1, Şub: 2, Mar: 3, Nis: 4, May: 5, Haz: 6, Tem: 7, Ağu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12 };
/** Nottaki ilk tarih ("18 Eki 1996 vizyona girdi") → '1996-10-18'; yoksa null */
export function notTarihi(note?: string): string | null {
  const m = note?.match(/(\d{1,2}) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara) (\d{4})/);
  return m ? `${m[3]}-${String(AY_NO[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
/** O gün çıkmış mı? (veri denetimi: arşivde vizyona girmemiş filmler ve çıkmamış oyunlar o günün sayfasında görünüyordu) */
export const cikmisMi = (note: string | undefined, iso: string) => { const t = notTarihi(note); return !t || t <= iso; };

/** Haber başlıklarındaki teknik artıkları temizler (baştaki #, fazla boşluk). */
export function cleanTitle(s: string): string {
  return s.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
}

/** Başlık Türkçe mi? (bazı dünya haberleri İngilizce özet olarak geliyor) */
export function looksTurkish(s: string): boolean {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(s)) return true;
  if (/\b(the|of|and|in|to|for|with|on|is|are|at|by|from|as|says|said|after|over|new|may|will|gets?|its|his|her|was|were|has|have|not|plan|faces?|opens?|support|into|while|a|an|but|who|what|why|how|calls?|sees?|urges?d?|suggests?|requiring|than|this|that|be)\b/i.test(s)) return false;
  // İngiliz gazete başlıkları her kelimesi büyük harfle yazılır ("Fearing G.I. Occupiers, Japan Urged…")
  const k = s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (k.length >= 4 && k.filter((w) => /^[A-Z][a-z]/.test(w)).length / k.length >= 0.6) return false;
  return true;
}

export function formatPop(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} milyar`;
  return `${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} milyon`;
}

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_TEAMS = /Türkiye|Galatasaray|Fenerbahçe|Beşiktaş|Trabzonspor|Bursaspor|Başakşehir|Göztepe|Kasımpaşa|Sivasspor|Kayserispor|Konyaspor|Antalyaspor|Gençlerbirliği|Ankaragücü|Denizlispor|Samsunspor|Eskişehirspor|Altay|Karşıyaka|Sarıyer|Zonguldakspor|Malatyaspor|Rizespor|Gaziantepspor|Kocaelispor|Adanaspor|Boluspor|Orduspor|Mersin|Manisaspor|Alanyaspor|Hatayspor/;

export interface Match { home: string; away: string; hs: string; as: string; detail?: string; turkish: boolean }

/** Spor verisini ayıklar: sezon/şampiyon, o günün maçları (skorlu), o güne tarihli diğer olaylar. */
export function sortSports(items: SportsItem[] | undefined, day: number, month: number, year: number) {
  const standing = (items ?? []).filter((x) => x.type === 'standing');
  const matches: Match[] = [];
  const others: SportsItem[] = [];
  const today = `${day} ${AY_KISA[month - 1]} ${year}`;
  for (const x of items ?? []) {
    if (x.type === 'match') {
      const m = x.title.match(/^(.+?)\s+(\d+)\s*[–-]\s*(\d+)\s+(.+)$/);
      if (m) matches.push({ home: m[1], hs: m[2], as: m[3], away: m[4], detail: x.detail, turkish: TR_TEAMS.test(x.title) });
    } else if (x.type === 'other' && x.detail?.includes(today)) {
      others.push(x);
    }
  }
  matches.sort((a, b) => Number(b.turkish) - Number(a.turkish));
  return { standing, matches, others };
}

/**
 * Gerçek bir haber başlığı mı? Veride bazen sadece bir Vikipedi madde adı
 * ("Çin", "Mike Pence", "Kertenkele") haber diye girilmiş; bunları ayıkla.
 */
export function isNewsy(title: string): boolean {
  return cleanTitle(title).split(' ').filter(Boolean).length >= 3;
}

/* ---- Ek veri (kadran-mobile/veri-ek): Vikipedi yıllık Türkiye, Türk dizileri, Süper Lig maçları ---- */

export interface TurkiyeYili { kaynak: string; url: string; olay: Record<string, string[]>; dogum: Record<string, string[]>; olum: Record<string, string[]> }
export interface MacYili { gunler: Record<string, [string, string, number, number][]> }
export type Dizi = [string, string | null, string, string | null];

const ekCache: Record<string, Promise<any>> = {};
/** Tanı: ek veri istekleri ne durumda? (ana sayfada küçük satır olarak gösterilir) */
export const ekDurum = { ok: 0, hata: 0, son: '' };
export function fetchEk<T>(rel: string): Promise<T | null> {
  if (!ekCache[rel]) {
    const base = dataBaseUrl().replace(/\/kadran-data$/, '/kadran-ek');
    ekCache[rel] = fetch(`${base}/${rel}`)
      .then((r) => {
        if (r.ok) { ekDurum.ok++; return r.json(); }
        ekDurum.hata++; ekDurum.son = `${rel} → HTTP ${r.status}`; return null;
      })
      .catch((e) => { ekDurum.hata++; ekDurum.son = `${base}/${rel} → ${String(e?.message ?? e)}`; return null; })
      .then((v) => { if (v == null) delete ekCache[rel]; return v; }); // başarısızsa sonra tekrar dene
  }
  return ekCache[rel];
}

/* ---- Wikidata (CC0) ---- */
export interface WdKisi { q: string; n: string; t: string; o?: number | null; d?: number | null; j?: string; img?: string; s: number }
export interface WdOlay { q: string; n: string; t: string; tur?: string; img?: string; s: number }
export interface WdDizi { q: string; n: string; bas: string | null; bit: string | null; kanal: string[]; img?: string; s: number; bolum?: number }
export interface WdFilm { q: string; n: string; t: string; yon?: string; img?: string; s: number }
export interface WdEser { q: string; n: string; sanatci?: string; tur: string; t: string; img?: string; s: number }
export interface Wd {
  dogum: Record<string, WdKisi[]>; olum: Record<string, WdKisi[]>; olay: Record<string, WdOlay[]>;
  diziler: WdDizi[]; filmler: Record<string, WdFilm[]>; muzik: Record<string, WdEser[]>;
  /** Vikipedi giriş paragrafından 1-2 cümle: "ne oldu / kim" (baglam_topla.mjs) */
  baglam?: Record<string, { m: string; o: string }>;
}
let wdPromise: Promise<Wd | null> | null = null;
export function fetchWd(): Promise<Wd | null> {
  if (!wdPromise) {
    wdPromise = Promise.all(['dogum', 'olum', 'olay', 'diziler', 'filmler', 'muzik', 'baglam'].map((n) => fetchEk<any>(`wikidata/${n}.json`)))
      .then(([dogum, olum, olay, diziler, filmler, muzik, baglam]) => (dogum || olum || olay)
        ? { dogum: dogum ?? {}, olum: olum ?? {}, olay: olay ?? {}, diziler: diziler ?? [], filmler: filmler ?? {}, muzik: muzik ?? {}, baglam: baglam ?? {} }
        : null)
      .then((v) => { if (!v) wdPromise = null; return v; });
  }
  return wdPromise;
}

/** Wikidata olaylarından spor sezonu, maç ve liste gibi gürültüyü ayıklar. */
const KOTU_TUR = new Set(['sezon', 'basketball game', 'futbol kulüpleri arası maç', 'düzenli olarak tekrarlanan spor etkinliği', 'spor sezonu']);
export function iyiOlay(e: WdOlay): boolean {
  if (e.tur && KOTU_TUR.has(e.tur)) return false;
  return !/\bvs\b|\d{8}$|listesi$|Ligi$|Lig$|sezonu|Season|League|Wikimedia|Under-\d+|\bat the\b/i.test(e.n);
}
/** Yıla bulunma eki: 1996'da, 1983'te, 2000'de, 1980'de, 1940'ta */
export function yilEki(y: number): string {
  const birler = ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'];
  const onlar = ['', 'da', 'de', 'da', 'ta', 'de', 'ta', 'te', 'de', 'da'];
  const e = y % 10 ? birler[y % 10] : (y % 100 ? onlar[(y % 100) / 10] : (y % 1000 ? 'de' : 'de'));
  return `${y}'${e}`;
}
/** Türkiye'nin en üst ligi 2001-02 sezonuna kadar "1. Lig" adını taşıyordu */
export const ligAdi = (iso: string) => (iso < '2001-08-01' ? '1. Lig' : 'Süper Lig');
/** "Senin İçin (Ferhat Göçer albümü)", "Doktorlar (dizi, 1989)" → parantezli tür ekini atar */
export const adTemizle = (s: string) => s.replace(/\s*\([^()]*\b(dizi|albüm|albümü|film|filmi|şarkı|şarkısı|single|TV dizisi|televizyon dizisi|program)\b[^()]*\)/gi, '').trim();
/** Wikidata tarihi yıl düzeyindeyse ("1996-01-01") sadece yıl say */
export const yilDuzeyi = (t: string) => t.endsWith('-01-01');

/* ---- Gündem (Vikipedi gün sayfaları), deprem (AFAD/USGS), YouTube çalınabilirlik ---- */
export interface GunOlay { t: string; tr: number }
export interface Deprem { m: number; yer: string; saat: string; dr?: number }
export interface Gundem { gunler: Record<string, Record<string, GunOlay[]>>; deprem: Record<string, Deprem[]>; depremKaynak: string; ytKotu: Set<string> }
let gundemP: Promise<Gundem | null> | null = null;
/** USGS yer adlarını düzelt: "Pazarcik earthquake, … sequence" → "Pazarcık merkezli" */
function depremTemizle(g: Record<string, Deprem[]>): Record<string, Deprem[]> {
  for (const k in g) for (const e of g[k]) e.yer = yerAdiDuzelt(e.yer);
  return g;
}
export function fetchGundem(): Promise<Gundem | null> {
  if (!gundemP) {
    gundemP = Promise.all([fetchEk<any>('gunler.json'), fetchEk<any>('deprem.json'), fetchEk<any>('youtube.json')])
      .then(([g, d, y]) => (g || d || y)
        ? {
            gunler: g ?? {},
            deprem: depremTemizle(d?.gunler ?? (d && !d.kaynak ? d : {})),
            depremKaynak: d?.kaynak ?? 'USGS',
            ytKotu: new Set<string>([...(y?.kapali ?? []), ...(y?.yok ?? [])]),
          }
        : null)
      .then((v) => { if (!v) gundemP = null; return v; });
  }
  return gundemP;
}

const ILLER = 'Adana|Adıyaman|Afyon|Ağrı|Amasya|Ankara|Antalya|Artvin|Aydın|Balıkesir|Bilecik|Bingöl|Bitlis|Bolu|Burdur|Bursa|Çanakkale|Çankırı|Çorum|Denizli|Diyarbakır|Edirne|Elazığ|Erzincan|Erzurum|Eskişehir|Gaziantep|Giresun|Gümüşhane|Hakkâri|Hakkari|Hatay|Isparta|Mersin|İstanbul|İzmir|Kars|Kastamonu|Kayseri|Kırklareli|Kırşehir|Kocaeli|Konya|Kütahya|Malatya|Manisa|Kahramanmaraş|Mardin|Muğla|Muş|Nevşehir|Niğde|Ordu|Rize|Sakarya|Samsun|Siirt|Sinop|Sivas|Tekirdağ|Tokat|Trabzon|Tunceli|Şanlıurfa|Uşak|Van|Yozgat|Zonguldak|Aksaray|Bayburt|Karaman|Kırıkkale|Batman|Şırnak|Bartın|Ardahan|Iğdır|Yalova|Karabük|Kilis|Osmaniye|Düzce';
const TR_RE = new RegExp(`Türkiye|(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü])(?:Türk(?!men|i?stan)|TBMM|Meclis|Atatürk|Anadolu|Marmara|Gölcük|Üsküdar|Kadıköy|Beyoğlu|Taksim|Boğaziçi|Gümüşsuyu|Tuzla|Şişli|Bakırköy|Esenyurt|Pendik|Ümraniye|Kızılay|Çankaya|PKK|DHKP|TSK|MİT|YÖK|Diyanet|THY|TRT|CHP|AKP|AK Parti|MHP|HDP|DEM Parti|DYP|ANAP|SHP|DSP|Refah Partisi|İYİ Parti|Erdoğan|Ecevit|Özal|Demirel|Çiller|Erbakan|Mesut Yılmaz|Baykal|Bahçeli|Kılıçdaroğlu|Davutoğlu|Abdullah Gül|Necdet Sezer|Kenan Evren|Ajda Pekkan|Barış Manço|Zeki Müren|Sezen Aksu|Tarkan|Halkbank|Arkas|Barış Pınarı|Zeytin Dalı|Fırat Kalkanı|Pençe-|Kızılay|AFAD|Maraş|Menderes|İnönü|Celal Bayar|Cemal Gürsel|Cevdet Sunay|Fahri Korutürk|Mill[iî] Birlik|Demokrat Parti|Adalet Partisi|Yassıada|Nihat Erim|Ferit Melen|Naim Talu|Sadi Irmak|Türkeş|Feyzioğlu|Aybar|Galatasaray|Fenerbahçe|Beşiktaş|Trabzonspor|TFF|Süper Lig|Milli Takım|Kıbrıs|KKTC|${ILLER})(?![a-zçğıöşü])`);
/** Metin Türkiye ile mi ilgili? (il adları, kurumlar; Türkmenistan hariç) */
export const trMi = (t: string) => TR_RE.test(t) && !(/(Federal|Ulusal|Avrupa|Halk|Yüksek) Meclis|Meclis(i|) Başkan(vekili|ı)? [A-Z]|Merkel|Alman|Charlie|Fransız|İngiliz|Yunan/.test(t) && !/Türkiye|TBMM|Türk(?!men)|Ankara|İstanbul/.test(t));
/** Cümle gibi mi? ("Sudan İç Savaşı (2023-günümüz)" gibi madde adlarını eler) */
export const cumleMi = (t: string) => t.trim().split(/\s+/).length >= 5 && !/\(\d{4}/.test(t);

/** 1950-79 için: milli maçlar (CC0 veri seti), resmi dolar kuru dönemleri, lig şampiyonları */
export type MilliMac = [string, string, number, number, string, string]; // ev, deplasman, skor, skor, turnuva, şehir
export interface Eski {
  milli: Record<string, MilliMac[]>; milliKaynak?: string;
  dolar: { donem: { bas: string; kur: number }[]; yilsonu: Record<string, number>; kaynaklar: Record<string, string> } | null;
  /** Aylık brüt asgari ücret dönemleri (1974-), yeni TL */
  asgari: { bas: string; brut: number }[];
  /** Kaynağı belli fiyat noktaları (fiyatlar.json) */
  fiyat: { ekmek: { y: number; fiyat: string; gram?: number; k: string }[]; ekmek_dakika?: { yil: Record<string, number> } } | null;
}
let eskiP: Promise<Eski | null> | null = null;
export function fetchEski(): Promise<Eski | null> {
  if (!eskiP) {
    eskiP = Promise.all([fetchEk<any>('milli.json'), fetchEk<any>('dolar_eski.json'), fetchEk<any>('asgari_ucret.json'), fetchEk<any>('fiyatlar.json')])
      .then(([m, d, a, f]) => (m || d || a || f) ? { milli: m?.gunler ?? {}, milliKaynak: m?.kaynak, dolar: d ?? null, asgari: a?.donem ?? [], fiyat: f ?? null } : null)
      .then((v) => { if (!v) eskiP = null; return v; });
  }
  return eskiP;
}
/** O tarihteki resmi kur (1 dolar kaç lira). Sabit kur dönemlerinde dönem kuru, 1971-79'da yıl değeri. */
export function eskiDolar(e: Eski | null | undefined, iso: string): number | null {
  const d = e?.dolar; if (!d) return null;
  const y = Number(iso.slice(0, 4));
  if (y >= 1971 && d.yilsonu[String(y)]) return d.yilsonu[String(y)];
  const don = d.donem.filter((x) => x.bas <= iso).pop();
  return don?.kur ?? null;
}
/** O tarihte geçerli aylık brüt asgari ücret (yeni TL); 1974 öncesi yok */
export function asgariUcret(e: Eski | null | undefined, iso: string): number | null {
  return e?.asgari.filter((x) => x.bas <= iso).pop()?.brut ?? null;
}
/** O yılın ekmek fiyatı ve bir ekmek için kaç dakika çalışmak gerektiği (kaynaklı noktalar) */
export function ekmekSatirlari(e: Eski | null | undefined, year: number): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const ek = e?.fiyat?.ekmek.find((x) => x.y === year);
  if (ek) out.push({ label: 'Ekmek', value: `${ek.fiyat}${ek.gram ? ` (${ek.gram} gr)` : ''}` });
  const dk = e?.fiyat?.ekmek_dakika?.yil[String(year)];
  if (dk) out.push({ label: 'Bir ekmek için', value: `${dk.toLocaleString('tr-TR')} dakika çalışmak` });
  return out;
}
/** O güne en yakın milli maç (±3 gün) */
export function yakinMilliMac(e: Eski | null | undefined, iso: string): { mac: MilliMac; fark: number } | null {
  if (!e) return null;
  const t = Date.parse(iso);
  for (const f of [0, -1, 1, -2, 2, -3, 3]) {
    const k = new Date(t + f * 86400000).toISOString().slice(0, 10);
    const m = e.milli[k]?.[0];
    if (m) return { mac: m, fark: f };
  }
  return null;
}

/** Gazete arşivi başlıklarına haberin kendi sayfasından açıklama (aciklama_topla.mjs): tarih → başlık anahtarı → { o: metin, u: adres } */
export type Aciklamalar = Record<string, Record<string, { o: string; u: string }>>;
export interface Ek { turkiye: TurkiyeYili | null; maclar: MacYili | null; diziler: Dizi[]; wd: Wd | null; gundem: Gundem | null; eski?: Eski | null; aciklama?: Aciklamalar | null; ceviri?: Ceviriler | null }
/** O gün o yıl Vikipedi gün sayfasındaki olaylar, Türkiye ve dünya diye ayrılmış */
export function gununOlaylari(ek: Ek | null | undefined, iso: string) {
  const list = ek?.gundem?.gunler[iso.slice(5)]?.[iso.slice(0, 4)] ?? [];
  return { tr: list.filter((x) => trMi(x.t)).map((x) => x.t), dunya: list.filter((x) => !trMi(x.t)).map((x) => x.t) };
}
let aciklamaP: Promise<Aciklamalar | null> | null = null;
const fetchAciklama = () => (aciklamaP ??= fetchEk<Aciklamalar>('aciklama.json').then((v) => { if (!v) aciklamaP = null; return v; }));

/** 1990'ların İngilizce NYT haberlerinin Türkçesi (veri-ek/ceviri.json): tarih → İngilizce başlığın anahtarı → { t: Türkçe başlık, b: Türkçe giriş cümlesi } */
export type Ceviriler = Record<string, Record<string, { t: string; b?: string }>>;
let ceviriP: Promise<Ceviriler | null> | null = null;
const fetchCeviri = () => (ceviriP ??= fetchEk<Ceviriler>('ceviri.json').then((v) => { if (!v) ceviriP = null; return v; }));

export async function fetchEkForYear(year: number): Promise<Ek> {
  const [turkiye, maclar, d, wd, gundem, eski, aciklama, ceviri] = await Promise.all([
    year >= 1980 && year <= 2025 ? fetchEk<TurkiyeYili>(`turkiye/${year}.json`) : Promise.resolve(null),
    year >= 1994 && year <= 2025 ? fetchEk<MacYili>(`maclar/${year}.json`) : Promise.resolve(null),
    fetchEk<{ diziler: Dizi[] }>('diziler.json'),
    fetchWd(),
    fetchGundem(),
    fetchEski(),
    fetchAciklama(),
    year >= 1990 && year < 2005 ? fetchCeviri() : Promise.resolve(null),
  ]);
  // Vikipedi dizi listesine Wikidata'dan gelen (listede olmayan, tarihli) dizileri ekle
  const diziler = [...(d?.diziler ?? [])];
  if (wd) {
    const norm = (x: string) => x.replace(/\s*\(.*?\)/g, '').trim().toLocaleLowerCase('tr-TR');
    const var_ = new Set(diziler.map((x) => norm(x[0])));
    for (const w of wd.diziler) {
      if (!w.bas || var_.has(norm(w.n))) continue;
      const kisalt = (t: string | null) => (t && yilDuzeyi(t) ? t.slice(0, 4) : t);
      diziler.push([w.n.replace(/\s*\((?:dizi|TV dizisi|televizyon dizisi)\)/i, ''), w.kanal[0]?.replace('Türkiye Radyo Televizyon Kurumu', 'TRT') ?? null, kisalt(w.bas)!, kisalt(w.bit)]);
    }
  }
  return { turkiye, maclar, diziler, wd, gundem, eski, aciklama, ceviri };
}

/** O tarihte yayında olan diziler (kısmi tarihler: '1993' → yıl başı/sonu). */
export function dizilerOnAir(all: Dizi[], iso: string): Dizi[] {
  const lo = (s: string) => (s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s);
  const hi = (s: string) => (s.length === 4 ? `${s}-12-31` : s.length === 7 ? `${s}-31` : s);
  return all.filter(([, , ilk, son]) => {
    const start = lo(ilk);
    const end = son ? hi(son) : `${Number(ilk.slice(0, 4)) + 1}-06-30`;
    return start <= iso && iso <= end;
  }).sort((a, b) => b[2].localeCompare(a[2]));
}

/** Aynı haftadaki (±6 gün) Türkiye olayları — o gün kayıt yoksa "bu hafta" olarak gösterilir. */
export function haftaninOlaylari(t: TurkiyeYili | null, iso: string): { iso: string; text: string; fark: number }[] {
  if (!t) return [];
  const base = Date.parse(iso + 'T00:00:00Z');
  const out: { iso: string; text: string; fark: number }[] = [];
  for (const [d, list] of Object.entries(t.olay)) {
    const fark = Math.round((Date.parse(d + 'T00:00:00Z') - base) / 86400000);
    if (fark !== 0 && Math.abs(fark) <= 6) list.forEach((text) => out.push({ iso: d, text, fark }));
  }
  return out.sort((a, b) => Math.abs(a.fark) - Math.abs(b.fark));
}

/** O gün maç yoksa ±4 gün içindeki en yakın maç gününü bulur. */
export function enYakinMacGunu(m: MacYili | null, iso: string) {
  if (!m) return null;
  const base = Date.parse(iso + 'T00:00:00Z');
  for (const fark of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const d = new Date(base + fark * 86400000).toISOString().slice(0, 10);
    const maclar = m.gunler[d];
    if (maclar?.length) {
      const [y, mo, g] = d.split('-').map(Number);
      const gun = GUNLER[new Date(Date.UTC(y, mo - 1, g)).getUTCDay()];
      return { fark, iso: d, maclar, etiket: `${g} ${AYLAR[mo - 1]} ${gun}` };
    }
  }
  return null;
}
