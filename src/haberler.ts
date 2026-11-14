import { DayData, DayEvent, Ek, gorsel, cleanTitle, cumleMi, gununOlaylari, isNewsy, iyiOlay, looksTurkish, trMi } from './data';

/**
 * O günün olayları: başlık, varsa açıklama ve görsel. Gün sayfası, ana sayfa akışı ve hikâye aynı listeyi kullanır.
 *
 * Veri denetiminden (29 Ekim) çıkan kurallar:
 * - Haber sitelerinden gelen başlıklara arşiv, Wikimedia'dan anahtar kelimeyle "stok" görsel eklemiş
 *   (deprem haberine yabani at, kabine haberine Obama'nın kabinesi). Bunlar gösterilmez; sadece haber
 *   sitesinin kendi görseli kalır.
 * - Vikipedi "güncel olaylar" kayıtları çoğu zaman olay değil, o günün haberinde geçen bir maddedir
 *   ("Barbados", "Kraft Foods"). Olay adı değilse gösterilmez; açıklaması madde tanımı olduğu için kullanılmaz.
 * - Vikipedi "tarihte bugün / yıl makalesi" kayıtlarında başlık bir madde adıdır ("Iğdır"), asıl olay
 *   açıklamadadır ("Iğdır'ın Aralık ilçesinde karakola saldırı…"). Başlık olarak açıklama kullanılır.
 * - Madde görselleri (şehir fotoğrafı, kişinin yıllar sonraki portresi) olayı anlatmaz, gösterilmez.
 * - Haritalar, bayraklar, logolar ve dosya adında o yıldan sonraki bir yıl geçen görseller gösterilmez.
 * - Açıklamada o günden sonraki bir yıl geçiyorsa (geleceği anlatıyorsa) açıklama gösterilmez.
 */
export interface Haber { title: string; body?: string; img?: string | null; scope: 'TR' | 'world'; kaynak?: string; /** Wikidata kimliği (bağlam için) */ q?: string }
/** aciklama_topla.mjs ile aynı anahtar */
export const aciklamaAnahtar = (t: string) => t.toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();
export const anahtar = (t: string) => cleanTitle(t).toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '').slice(0, 22);

const MADDE_KAYNAK = new Set(['Vikipedi (Güncel olaylar)', 'Vikipedi', 'Vikipedi (dünya — olaylar)']);
const OLAY_GOVDE_KAYNAK = new Set(['Vikipedi (gün — olaylar)', 'Vikipedi — Tarihte bugün', 'Vikipedi (Türkiye yıl makalesi)', 'Vikipedi (yıl makalesi)']);
const WIKIDATA_KAYNAK = new Set(['Wikidata (Türkiye olayı)', 'Wikidata (dünya olayı)', 'Wikidata / Vikipedi']);
/** Olay adı gibi mi? ("1999 Düzce depremi", "Dökme Kurşun Harekâtı") — madde adlarını ("Barbados") eler */
const OLAY_ADI = /(deprem|savaş|harekât|harekat|operasyon|saldırı|suikast|darbe|seçim|referandum|kaza|faciası|felaket|yangın|sel\b|kriz|protesto|ayaklanma|isyan|katliam|bombalama|patlama|kongre|zirve|antlaşma|anlaşma|beyanname|şampiyona|olimpiyat|kupa|final|maçı|turnuva|festival|fırtına|tsunami|kasırga|salgın|pandemi|grev|muharebe|kuşatma|işgal|sefer sayılı|tecrit|ilanı|açılış|tören|cenaze)/i;
const GENEL_GORSEL = /(\.svg|flag|bayra|map\b|_map|map_|harita|locator|location|logo|seal|coat_of_arms|arma|emblem|collage|fallback|amp_default|default\.|icon|banner|diagram|chart)/i;
const YIL = /(19[0-9]\d|20[0-2]\d)/g;

const kaynakAdi = (e: DayEvent) => e.sources?.[0]?.name ?? '';
/** Haber cümlesi mi? Madde adları ("Çin Endüstri ve Ticaret Bankası", "Kuzey İrlanda millî futbol takımı") fiille bitmez. */
const haberCumlesi = (t: string) => {
  const s = t.replace(/["'’”»)\]]+$/, '').trim();
  if (/[.!?]$/.test(s)) return true;
  const son = s.split(/\s+/).pop() ?? '';
  return /(d[ıiuü]|t[ıiuü]|m[ıiuü]ş|yor|acak|ecek|d[ıiuü]r|t[ıiuü]r|[ıiuü]r|[ae]r|maz|mez|l[ıi]|meli|malı)$/i.test(son) && s.split(/\s+/).length >= 3;
};
const YABANCI = /Merkel|Charlie|Almanya|Fransa|İngiltere|ABD|Amerika|Rusya|Çin|Japonya|İtalya|İspanya|Yunanistan|Ermenistan|Azerbaycan|İran|Irak|Suriye|İsrail|Mısır|Hindistan|Pakistan|Brezilya|Kanada|Avustralya|Ukrayna|Federal/;
const gelecekYilVar = (metin: string, yil: number) => (metin.match(YIL) ?? []).some((y) => Number(y) > yil);
/** Görsel o olayı mı gösteriyor, yoksa genel bir görsel mi? */
function gorselUygun(url: string | undefined | null, yil: number): string | null {
  if (!url || url.startsWith('/')) return null;
  let ad = url.split('/').pop() ?? '';
  try { ad = decodeURIComponent(ad); } catch {}
  if (GENEL_GORSEL.test(ad) || gelecekYilVar(ad, yil)) return null;
  return gorsel(url);
}
const wikimedia = (url: string) => /wikimedia|wikipedia/.test(url);
/** Harita, video, galeri gibi içerik başlıkları ve kur tabloları olay değildir */
/** "Hava İSTANBUL 13ºC", "…için tıklayınız", "CANLI YAYIN…", "(maç özeti)", "SON DAKİKA … !" gibi haber olmayan başlıklar */
const COP = /!|:\s*\.|Büyük sürpriz|öyle bir|Brifing|Bülten(iniz)?$|^Sabah Brifingi|^Akşam Brifingi|^Hava\s|tıklayın|^CANLI YAYIN|SON DAKİKA|ma[çc]ı? özeti\)|^TimesCast|!.*(\.\.|…)\s*$|\?\.\.|Peki ne anlama|İşte (detaylar|o anlar)|\bVodafone|\bTurkcell|Avucunuzda|Gastronomi Rehberi|Ekonomi Zirvesi$/i;
const copBaslik = (t: string) => t.length < 14 || COP.test(t) || /View International Edition|^EURO\s|USD\s.*ALTIN|(\d+,\d+.*){3}|^(Harita|Map|Video|Galeri|Fotoğraf|Foto galeri|Grafik|Canlı)\s*:/i.test(t) || /['"]\s*\+|\+\s*['"]|\.metin\b|\{\{|\}\}|\bundefined\b|^National Geographic/i.test(t);

/** "Sudan İç Savaşı (2023-günümüz)" gibi süregelen konu maddeleri o günün olayı değildir */
const suregelenMadde = (t: string) => /^(19|20)\d\d\s*[-–]\s*(19|20)?\d\d\s/.test(t) || /\((\d{4})?\s*[-–]\s*(günümüz|\d{4})\)\s*$/.test(t) || /\(\d{4}[-–]günümüz\)/.test(t);
const kelimeSeti = (t: string) => new Set(t.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9\s]/g, ' ').split(/\s+/).filter((x) => x.length > 2).map((x) => x.slice(0, 6)));
const benzerlik = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let o = 0; for (const x of a) if (b.has(x)) o++; return o / Math.min(a.size, b.size); };

/** Arşivdeki bir olay kaydını kaynağına göre düzeltir; gösterilmemesi gerekiyorsa null döner. */
function arsivOlayi(e: DayEvent, yil: number): { title: string; body?: string; img: string | null; kaynak: string } | null {
  const k = kaynakAdi(e);
  const ham = e.image?.placeholder ? null : e.image?.url ?? null;
  let title = cleanTitle(e.title);
  let body = e.body ? e.body.replace(/\s+/g, ' ').replace(/\s*\((NYT|New York Times)[^)]*\)\s*$/i, '').replace(/;?\s*fotoğraf\s*\(M\)\s*$/i, '').trim() : undefined;
  // NYT çevirileri İngiliz usulü her kelimesi büyük harfle geliyor: Türkçe cümle düzenine çevir
  if (/New York Times|NYT/.test(k)) title = cumleDuzeni(title);
  // köşe yazısından kalan imza: "… -Ergun BABAHAN"
  if (body) body = body.replace(/\s*[-–]\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]{3,}\s*$/, '').trim();
  title = title.replace(/\s*[-–]\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]{3,}\s*$/, '').trim();
  let img: string | null = null;
  if (copBaslik(title)) return null;
  if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]{3,}\s/.test(title)) return null; // köşe yazısı: "Sedat ERGİN Trump'ın…"
  title = title.replace(/\s*(\.\.\.|…)\s*$/, '');
  if (/hindi|Şükran Günü/i.test(`${title} ${body ?? ''}`)) return null; // NYT: "turkey" = hindi
  if (OLAY_GOVDE_KAYNAK.has(k)) {
    // asıl olay açıklamada
    if (!body || body.length < 20) return null;
    title = body.length > 220 ? body.slice(0, 217).replace(/\s+\S*$/, '') + '…' : body;
    body = undefined;
  } else if (MADDE_KAYNAK.has(k)) {
    if (!cumleMi(title) && !OLAY_ADI.test(title)) return null;
    if (!cumleMi(title) && !/\b(19|20)\d\d\b/.test(title) && !trMi(title)) return null; // tarihsiz yabancı konu maddesi
    body = undefined;
  } else if (WIKIDATA_KAYNAK.has(k)) {
    img = gorselUygun(ham, yil);
  } else if (ham && !wikimedia(ham)) {
    // haber sitesinin kendi görseli
    img = gorselUygun(ham, yil);
  }
  if (body && (gelecekYilVar(body, yil) || body.length < 30 || !looksTurkish(body))) body = undefined;
  if (body && body.toLocaleLowerCase('tr-TR').startsWith(title.toLocaleLowerCase('tr-TR').slice(0, 30)) && body.length < title.length + 20) body = undefined;
  return { title, body, img, kaynak: kaynakEtiketi(k) };
}
/** "Türkiye Deprem Bölgesine Yardım Geliyor" → "Türkiye deprem bölgesine yardım geliyor" (özel adlar korunur) */
function cumleDuzeni(t: string): string {
  const k = t.split(/\s+/);
  if (k.length < 3 || k.filter((w) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(w)).length / k.length < 0.6) return t;
  const OZEL = /^(Türk|Türkiye|İstanbul|Ankara|İzmir|Kıbrıs|Avrupa|Birliği|Birleşmiş|Milletler|ABD|AB|NATO|Amerika|Amerikan|Birleşik|Devletleri|Rusya|Rus|Suriye|Irak|İran|Yunanistan|Ermenistan|Azerbaycan|Kürt|PKK|Erdoğan|Esad|Trump|Obama|Bush|Clinton|Putin|Ortadoğu|Orta|Doğu|Kaşıkçı|Suudi|Arabistan|İsrail|Filistin|Almanya|Fransa|İngiltere|Londra|Paris|Washington|Moskova|Atatürk|İslam|Müslüman|Hristiyan|Ermeni|Kıbrıs'ta|Deutsche|Bank|Ackermann|McCain|Senatör|Cumhurbaşkanı|Başbakan)(?=$|['’,]|lar|ler)/;
  // vefat başlığı: "İsmat Kittani, 72, …" → virgüle kadar özel ad
  const ad = t.match(/^([^,]+), \d{1,3}, /);
  const sabit = ad ? ad[1].split(/\s+/).length : 0;
  return k.map((w, i) => (i === 0 || i < sabit || /^[A-ZÇĞİÖŞÜ][^\s'’]*['’]/.test(w) || /^[A-ZÇĞİÖŞÜ]+-\d/.test(w) || OZEL.test(w) || /^[A-ZÇĞİÖŞÜ]{2,}/.test(w) || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]*'/.test(w) && OZEL.test(w.split("'")[0]) ? w : w.charAt(0).toLocaleLowerCase('tr-TR') + w.slice(1))).join(' ');
}
const kaynakEtiketi = (k: string) => k.replace(/\s*\((gazete arşivi|haber arşivi|web arşivi|arşiv|dünya)\)/, ' arşivi').replace(/\s*\(.*?\)/, '') || 'Kadran arşivi';

/** O günün olaylarını tek listede toplar: arşiv olayları, Wikidata, Vikipedi, gündem. */
export function haberleriTopla(d: DayData, ek: Ek | null): Haber[] {
  const yil = Number(d.date.slice(0, 4));
  const out: Haber[] = [];
  const gor = new Set<string>();
  const kelimeler: Set<string>[] = [];
  const ekle = (h: Haber) => {
    if (copBaslik(h.title) || !looksTurkish(h.title)) return;
    // açıklaması olmayan gazete başlığına haberin kendi sayfasından açıklama
    if (!h.body) { const a = ek?.aciklama?.[d.date]?.[aciklamaAnahtar(h.title)]; if (a) h = { ...h, body: a.o }; }
    const k = anahtar(h.title);
    if (!k || gor.has(k) || suregelenMadde(h.title)) return;
    // aynı haberin iki gazetedeki hâli ("CUMHURBAŞKANI ERDOĞAN: AB'ye…" / "Erdoğan'dan AB'ye…")
    const w = kelimeSeti(h.title);
    if (kelimeler.some((x) => benzerlik(x, w) >= 0.6)) return;
    gor.add(k); kelimeler.push(w); out.push(h);
  };
  // 1990'ların İngilizce NYT haberleri: Türkçesi varsa onunla (yoksa İngilizce başlık elenir)
  const cev = ek?.ceviri?.[d.date];
  const olaylar = (d.events ?? []).map((e) => {
    const c = cev?.[aciklamaAnahtar(e.title)];
    return c ? { ...e, title: c.t, body: c.b ?? undefined, sources: [{ ...(e.sources?.[0] ?? { url: '' }), name: 'New York Times arşivi (Kadran çevirisi)' }] } as DayEvent : e;
  });
  const arsiv = olaylar.filter((e) => isNewsy(e.title) && looksTurkish(e.title))
    .sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0))
    .map((e) => ({ e, o: arsivOlayi(e, yil) }))
    .filter((x): x is { e: DayEvent; o: NonNullable<ReturnType<typeof arsivOlayi>> } => !!x.o);
  const gun = gununOlaylari(ek, d.date);
  // Türkiye mi? Kaynağın etiketine değil metne bakılır (arşivde etiket sık sık yanlış).
  // NYT haberlerinde "Turkey" bazen hindi demek: sadece başlık açıkça Türkiye'yi anıyorsa.
  const trOlay = (e: DayEvent, o: { title: string; body?: string; kaynak?: string }) => {
    const nyt = /NYT|New York Times/.test(`${e.body ?? ''} ${kaynakAdi(e)}`);
    if (nyt) return trMi(o.title) && !/hindi|Türkiye Yolu|Şükran/i.test(`${o.title} ${e.body ?? ''}`);
    return trMi(`${o.title} ${o.body ?? ''}`) || (e.scope === 'TR' && /arşivi$/.test(o.kaynak ?? '') && !/New York/.test(o.kaynak ?? '') && !YABANCI.test(o.title));
  };
  // Türkiye
  for (const { e, o } of arsiv.filter(({ e, o }) => trOlay(e, o))) ekle({ ...o, scope: 'TR' });
  const wdOlay = (ek?.wd?.olay[d.date] ?? []).filter((w) => iyiOlay(w) && looksTurkish(w.n));
  for (const w of wdOlay.filter((w) => trMi(w.n))) ekle({ title: w.n, img: gorselUygun(w.img, yil), scope: 'TR', kaynak: 'Wikidata', q: w.q });
  for (const t of ek?.turkiye?.olay[d.date] ?? []) ekle({ title: cleanTitle(t), scope: 'TR', kaynak: 'Vikipedi' });
  for (const t of gun.tr) ekle({ title: cleanTitle(t), scope: 'TR', kaynak: 'Vikipedi' });
  // Dünya
  // dünya: cümle ya da tarihli olay adı ("2005 Keşmir depremi"); "Yemen İç Savaşı" gibi konu maddeleri değil
  const tarihliOlay = (t: string) => OLAY_ADI.test(t) && /\b(19|20)\d\d\b/.test(t);
  for (const { e, o } of arsiv.filter(({ e, o }) => !trOlay(e, o) && (haberCumlesi(o.title) || o.body || tarihliOlay(o.title)))) ekle({ ...o, scope: 'world' });
  for (const w of wdOlay.filter((w) => !trMi(w.n) && tarihliOlay(w.n))) ekle({ title: w.n, scope: 'world', kaynak: 'Wikidata', q: w.q });
  for (const t of gun.dunya.filter((t) => haberCumlesi(t) || /\b(19|20)\d\d\b/.test(t))) ekle({ title: cleanTitle(t), scope: 'world', kaynak: 'Vikipedi' });
  // görselli ve açıklamalı olanlar önce (kendi içinde sıra korunur)
  const puan = (h: Haber) => (h.img ? 2 : 0) + (h.body ? 1 : 0);
  return out.map((h, i) => ({ h, i })).sort((a, b) => (a.h.scope === b.h.scope ? puan(b.h) - puan(a.h) || a.i - b.i : 0)).map((x) => x.h);
}
