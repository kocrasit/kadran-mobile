import { useEffect, useState } from 'react';
import { Haber, haberleriTopla } from './haberler';
import { GAZETE_TARAMA } from './ayarlar';
import {
  DayData, Ek, cleanTitle, dataBaseUrl, fetchDay, fetchEkForYear, imageUrl, isNewsy, iyiOlay, isoOf, looksTurkish,
  enYakinMacGunu, sortSports, cikmisMi, gorsel, gazeteUrl, dizilerOnAir, formatTL, formatGold, yilDuzeyi, gununOlaylari, haftaninOlaylari, cumleMi, eskiDolar, yakinMilliMac, ARSIV_BASI, asgariUcret, ekmekSatirlari, ligAdi, adTemizle, wdGorsel,
} from './data';

/** Şarkı Türkçe mi: Türkçe harf ya da bilinen Türkçe sözcük */
const turkceSarki = (t: string, a?: string) => /[çğıöşüÇĞİÖŞÜ]/.test(`${t} ${a ?? ''}`) || /\b(ve|bir|sen|ben|aşk|gel|yok|var|beni|seni|benim|senin|gibi|için|kadar|olmaz|dünya|yalan|deli|gönül|kalbim)\b/i.test(t);

const GAZETE_SOZ = ['O günün gazetesi.', 'Gazetelerde o gün bunlar vardı.', 'O günün başlıkları.', 'Gündemde neler vardı?', 'O gün gazeteyi açan bunları okudu.'];

export const FIRST_YEAR = 1950;
export const LAST_DAY = { y: 2026, m: 6, d: 25 }; // verinin bittiği gün

/** Radyo düğmesi için: o yıl bugün çalan şarkı */
export interface Song { title: string; artist: string; image?: string | null; yt?: string; adaylar?: Song[] }

export interface Moment {
  year: number;
  kind: 'Gazete' | 'Manşet' | 'Radyoda' | 'Ekranda' | 'Sinemada' | 'Doğdu' | 'Spor' | 'Vefat' | 'Cüzdan' | 'Deprem' | 'Dünya' | 'Gündem';
  /** Gündem kartı: o günün olayları (etiket: TÜRKİYE / DÜNYA / '2 GÜN ÖNCE') */
  liste?: { t: string; etiket: string; tr: boolean }[];
  text: string;
  sub?: string;
  image?: string | null;
  /** Cüzdan kartı için: o günkü fiyatlar ve bugüne göre kat */
  cuzdan?: { label: string; value: string; kat?: number }[];
  /** Kadran Gazetesi (tarama yerine kendi tasarımımız): başlıklar ve gazetenin arşivdeki sayfası */
  gazete?: { basliklar: string[]; link?: string };
  /** Bilginin kaynağı (gönderinin altında küçük yazılır) */
  kaynak?: string;
  /** Güne değil yıla ait bilgi (eski yıllarda "o yıl çıkan plak/film") */
  yillik?: boolean;
  /** "Ne oldu / kim": Vikipedi'den 1-2 cümle */
  baglam?: string;
}

const BUYUK = /Galatasaray|Fenerbahçe|Beşiktaş|Trabzonspor/;
const SON_GUN = '2026-06-25';
const kisalt = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…');

/**
 * O günden akışa düşecek gönderiler (yıl başına en fazla 3):
 * manşet → spor (o gün yoksa en yakın maç günü) → her on yılda bir cüzdan → yıldan yıla dönüşen kültür kartı (dizi/film/radyo) → vefat.
 */
/** Açıklamasız tek başlık ancak tam bir cümleyse gösterilir */
const haberCumlesiMi = (t: string) => t.split(/\s+/).length >= 6;

export function pickMoments(year: number, d: DayData, ek?: Ek | null, son?: DayData | null): Moment[] {
  const out: Moment[] = [];
  const [, mm, dd] = d.date.split('-').map(Number);

  // 1) olaylar: en iyi Türkiye olayı fotoğraf ve açıklamasıyla kendi kartında; kalanlar tek "O gün" kartında
  const haberler = haberleriTopla(d, ek ?? null);
  const tr = haberler.filter((h) => h.scope === 'TR');
  const dunya = haberler.filter((h) => h.scope !== 'TR');
  const mansetOlur = (h: Haber) => !/^\d{4} /.test(h.title); // "1980 Türkiye cumhurbaşkanlığı seçimi" gibi madde adları manşet olmaz
  const lead = tr.find((h) => mansetOlur(h) && h.img && h.body) ?? tr.find((h) => mansetOlur(h) && h.body) ?? tr.find((h) => mansetOlur(h) && h.img && haberCumlesiMi(h.title));
  // 0) o sabahın gazetesi: gazete arşivinden ön sayfanın üst kısmı (görsel inmezse gönderi hiç görünmez)
  const nf = d.newspaperFront;
  if (GAZETE_TARAMA && nf && nf.provider !== 'turkiyegazetesi') {
    const ad = nf.paper ?? 'Milliyet';
    out.push({ year, kind: 'Gazete', text: `${ad}, o sabah bayide böyle duruyordu.`, image: gazeteUrl(d.date), kaynak: `${ad} gazete arşivi` });
  }
  // yayın: taramayı göstermeyiz; manşet dışındaki başlıklarla kendi gazetemiz + gazetenin kendi arşivine bağlantı.
  // Bu gönderi varsa Gündem gönderisi çıkmaz (aynı başlıklar iki kez görünmesin).
  // gazetedeki başlıklar ne manşeti ne birbirini tekrarlar (aynı depremin "7.6 M" ve "Mw 7,5" hâli gibi)
  const gzBasliklar = tekrarsiz([...(lead ? [lead] : []), ...tr.filter((h) => h !== lead)]).filter((h) => h !== lead).slice(0, 4);
  const kadranGazetesi = !GAZETE_TARAMA && gzBasliklar.length >= 2;
  if (kadranGazetesi) {
    const ad = nf?.paper ?? (nf ? 'Milliyet' : undefined);
    out.push({ year, kind: 'Gazete', text: GAZETE_SOZ[year % GAZETE_SOZ.length], gazete: { basliklar: gzBasliklar.map((h) => h.title), link: nf ? (nf.provider === 'turkiyegazetesi' ? nf.image.url : nf.image.sourcePage ?? nf.image.url) : undefined },
      kaynak: [...new Set(gzBasliklar.map((h) => h.kaynak).filter(Boolean))].join(', ') || undefined, sub: ad });
  }
  const baglamOf = (q?: string) => (q ? ek?.wd?.baglam?.[q]?.o : undefined);
  if (lead) out.push({ year, kind: 'Manşet', text: lead.title, sub: lead.body ? kisalt(lead.body, 200) : undefined, image: lead.img ?? undefined,
    kaynak: lead.q && baglamOf(lead.q) ? `${lead.kaynak}, Vikipedi` : lead.kaynak, baglam: lead.body ? undefined : baglamOf(lead.q) });
  const trKalan = tr.filter((h) => h !== lead);
  const liste: NonNullable<Moment['liste']> = [
    ...trKalan.slice(0, 3).map((h) => ({ t: h.title, etiket: 'TÜRKİYE', tr: true })),
    ...(tr.length ? [] : haftaninOlaylari(ek?.turkiye ?? null, d.date).slice(0, 2)
      .map((h) => ({ t: h.text, etiket: h.fark > 0 ? `${h.fark} GÜN SONRA` : `${-h.fark} GÜN ÖNCE`, tr: true }))),
    ...dunya.slice(0, 2).map((h) => ({ t: h.title, etiket: 'DÜNYA', tr: false })),
  ];
  const resim = lead ? undefined : (tr.find((h) => h.img) ?? dunya.find((h) => h.img))?.img;
  if (kadranGazetesi) { /* başlıklar gazetede */ }
  else {
    // Twitter gibi: her haber kendi gönderisi. Altında açıklaması olan haberler gösterilir;
    // sadece başlıktan ibaret olanlar (açıklamasız tek satır) o yıl başka haber yoksa en fazla bir tane.
    // Açıklamalı haberler önce; açıklamasız başlıklar da kalır ama en fazla iki tane ve aralara dağıtılır (aşağıda)
    const aciklamali = [...trKalan.filter((h) => h.body).slice(0, lead ? 1 : 2), ...dunya.filter((h) => h.body).slice(0, 1)];
    const ciplak = [...trKalan, ...dunya].filter((h) => !h.body && haberCumlesiMi(h.title)).slice(0, 2);
    const secilen = [...aciklamali, ...ciplak];
    secilen.forEach((h, i) => out.push({
      year, kind: h.scope === 'TR' ? 'Gündem' : 'Dünya', text: h.title, sub: h.body ? kisalt(h.body, 220) : undefined,
      image: h.img ?? (i === 0 && !lead ? resim : undefined), kaynak: h.kaynak, baglam: h.body ? undefined : baglamOf(h.q),
    }));
  }

  // deprem: o gün Türkiye'de 5 ve üzeri
  const dep = ek?.gundem?.deprem[d.date]?.[0];
  if (dep && dep.m >= 5) {
    const kart: Moment = { year, kind: 'Deprem', text: `${dep.m.toLocaleString('tr-TR')} büyüklüğünde deprem`, sub: `${dep.yer} · saat ${dep.saat}` };
    if (dep.m >= 6) out.unshift(kart); else out.push(kart);
  }

  // 2) spor: o gün ya da ±4 gün içindeki en yakın Süper Lig günü; yoksa günün spor kaydı
  const yakin = enYakinMacGunu(ek?.maclar ?? null, d.date);
  if (yakin) {
    // en çok gol atılan büyük takım maçı (Başakşehir 0-7 Galatasaray, sıradan bir maçın önüne geçsin)
    const buyukler = yakin.maclar.filter(([h, a]) => BUYUK.test(h + a)).sort((x, y) => (y[2] + y[3]) - (x[2] + x[3]));
    const m = buyukler[0] ?? yakin.maclar[0];
    const ne = yakin.fark === 0 ? ligAdi(d.date) : `${ligAdi(d.date)} · ${Math.abs(yakin.fark)} gün ${yakin.fark > 0 ? 'sonra' : 'önce'}`;
    out.push({ year, kind: 'Spor', text: yakin.fark > 0 ? `${m[0]} – ${m[1]}` : `${m[0]} ${m[2]}–${m[3]} ${m[1]}`, sub: ne });
  } else {
    const sm = sortSports(d.sports, dd, mm, year).matches.find((x) => x.turkish) ?? null;
    const milli = sm ? null : yakinMilliMac(ek?.eski, d.date);
    if (sm) out.push({ year, kind: 'Spor', text: `${sm.home} ${sm.hs}–${sm.as} ${sm.away}`, sub: sm.detail ? turnuvaTr(sm.detail) : 'Maç sonucu' });
    else if (milli) {
      const [ev, dep, a, b, tur, sehir] = milli.mac;
      const ne = milli.fark === 0 ? '' : ` · ${Math.abs(milli.fark)} gün ${milli.fark > 0 ? 'sonra' : 'önce'}`;
      out.push({ year, kind: 'Spor', text: milli.fark > 0 ? `${ev} – ${dep}` : `${ev} ${a}–${b} ${dep}`, sub: `Milli maç · ${turnuvaTr(tur)}${sehir ? `, ${sehir}` : ''}${ne}`, kaynak: 'International football results (CC0)' });
    }
  }

  // 3) her on yılda bir cüzdan (1985, 1995, 2005, 2015, 2025)
  const e = d.economy;
  if (year % 10 === 5 && e && (e.usdTry || e.goldGram)) {
    const c: NonNullable<Moment['cuzdan']> = [];
    if (e.usdTry) c.push({ label: 'Dolar', value: formatTL(e.usdTry.value, year), kat: son?.economy?.usdTry ? son.economy.usdTry.value / e.usdTry.value : undefined });
    if (e.goldGram) c.push({ label: 'Gram altın', value: formatGold(e.goldGram.value, year), kat: son?.economy?.goldGram ? son.economy.goldGram.value / (year < 2005 ? e.goldGram.value / 1e6 : e.goldGram.value) : undefined });
    if (e.eurTry) c.push({ label: 'Euro', value: formatTL(e.eurTry.value, year) });
    const au = asgariUcret(ek?.eski, d.date);
    if (au) c.push({ label: 'Asgari ücret (brüt)', value: formatTL(au, year), kat: son ? asgariUcret(ek?.eski, SON_GUN)! / au : undefined });
    c.push(...ekmekSatirlari(ek?.eski, year));
    out.push({ year, kind: 'Cüzdan', text: 'O gün cüzdanda', sub: year < 2005 ? "2005'te liradan altı sıfır atıldı; kat hesabı yeni TL ile" : undefined, cuzdan: c, kaynak: c.some((x) => x.label.startsWith('Asgari')) ? `Kadran veri arşivi, ÇSGB (asgari ücret)${c.some((x) => x.label.includes('ekmek') || x.label === 'Ekmek') ? ', İHA/DİSK (ekmek)' : ''}` : undefined });
  }
  // 1950-79: her beş yılda bir resmi dolar kuru (1950, 1955, … 1975)
  const ekmek = year < ARSIV_BASI ? ekmekSatirlari(ek?.eski, year).filter((x) => x.label === 'Ekmek') : [];
  const kur = year < ARSIV_BASI && (year % 5 === 0 || ekmek.length) ? eskiDolar(ek?.eski, d.date) : null;
  if (kur) {
    const bugun = son?.economy?.usdTry?.value;
    out.push({ year, kind: 'Cüzdan', text: 'O gün cüzdanda',
      cuzdan: [{ label: 'Dolar', value: `${kur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lira`, kat: bugun ? bugun / (kur / 1e6) : undefined },
        ...(() => { const au = asgariUcret(ek?.eski, d.date); return au ? [{ label: 'Asgari ücret (brüt)', value: formatTL(au, year), kat: asgariUcret(ek?.eski, SON_GUN)! / au }] : []; })(),
        ...ekmekSatirlari(ek?.eski, year)],
      sub: year < 1971 ? 'Resmî kur, devlet sabitliyordu. 2005’te liradan altı sıfır atıldı.' : 'Resmî kur, yıl sonu. 2005’te liradan altı sıfır atıldı.',
      kaynak: [year < 1971 ? 'Sözcü, CNN Türk (kur)' : 'OECD / FRED, ÇSGB', ekmek.length ? 'Hürriyet, İHA (ekmek)' : year >= 1969 ? 'İHA/DİSK (ekmek)' : ''].filter(Boolean).join(', ') });
  }

  // 4) yıldan yıla dönüşen kültür kartı
  const kultur: (() => Moment | null)[] = [
    () => { // ekranda
      const on = dizilerOnAir(ek?.diziler ?? [], d.date)[0];
      if (on) return { year, kind: 'Ekranda', text: adTemizle(on[0]), sub: on[1] ?? undefined };
      const tv = d.tv?.[0];
      return tv ? { year, kind: 'Ekranda', text: tv.program.replace(/\s*—.*$/, ''), sub: tv.channel?.replace('Türkiye Radyo Televizyon Kurumu', 'TRT'), image: imageUrl(tv.image, [tv.program]) } : null;
    },
    () => { // vizyonda
      const f = (ek?.wd?.filmler[String(year)] ?? []).filter((x) => !yilDuzeyi(x.t) && x.t.slice(0, 10) <= d.date)
        .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0];
      if (f && Date.parse(d.date) - Date.parse(f.t) < 45 * 86400000) return { year, kind: 'Sinemada', text: f.n.replace(/\s*\(film[^)]*\)/i, ''), sub: f.yon, image: gorsel(f.img) };
      const c = (d.cinema ?? []).find((x) => cikmisMi(x.note, d.date));
      return c ? { year, kind: 'Sinemada', text: c.title, image: imageUrl(c.image, [c.title]) } : null;
    },
    () => { // radyoda
      // Türkçe şarkılar önce (Türkiye'de o gün radyoda ne çalıyordu)
      const cikan = (d.music ?? []).filter((x) => cikmisMi(x.note, d.date));
      const m = cikan.find((x) => turkceSarki(x.title, x.artist)) ?? cikan[0];
      return m ? { year, kind: 'Radyoda', text: adTemizle(m.title), sub: m.artist, image: imageUrl(m.image, [m.title, m.artist]) } : null;
    },
  ];
  if (year < ARSIV_BASI) {
    // eski yıllarda güne ait kültür kaydı yok: o yılın filmi / plağı, ama yalnızca o gün başka bir şey de varsa
    const temiz = (n: string) => n.replace(/\s*\((?:film|albüm|şarkı|single|plak)[^)]*\)/i, '');
    const sira = (Number(d.date.slice(5, 7)) * 31 + dd) ; // gün gün farklı eser
    const filmler = ek?.wd?.filmler[String(year)] ?? [];
    const plaklar = (ek?.wd?.muzik[String(year)] ?? []).filter((x) => temiz(x.n).length >= 3);
    const sec = <T,>(l: T[]) => (l.length ? l[sira % l.length] : null);
    if (out.length && out.length < 6) {
      const f = (year + dd) % 2 === 0 ? sec(filmler) : null;
      const p = f ? null : sec(plaklar);
      const f2 = !f && !p ? sec(filmler) : null;
      if (f || f2) { const x = (f ?? f2)!; out.push({ year, kind: 'Sinemada', text: temiz(x.n), sub: x.yon, image: gorsel(x.img) ?? wdGorsel(x.q) ?? undefined, yillik: true, kaynak: 'Wikidata' }); }
      else if (p) out.push({ year, kind: 'Radyoda', text: temiz(p.n), sub: p.sanatci, image: gorsel(p.img) ?? wdGorsel(p.q) ?? undefined, yillik: true, kaynak: 'Wikidata' });
    }
  }
  else for (let k = 0; k < kultur.length && out.length < 6; k++) {
    const mo = kultur[(year + k) % kultur.length]();
    if (mo) { out.push(mo); break; }
  }


  // 5) vefat (yer varsa)
  const wdVefat = (ek?.wd?.olum[d.date] ?? []).find((k) => !k.d || k.d < year);
  const meslek = wdVefat?.j && looksTurkish(wdVefat.j) && !/^[a-z ]+$/i.test(wdVefat.j) ? wdVefat.j : undefined;
  const vefat = ek?.turkiye?.olum[d.date]?.[0] ?? (wdVefat ? `${wdVefat.n}${meslek ? `, ${meslek}` : ''}` : undefined);
  const vefatBaglam = !ek?.turkiye?.olum[d.date]?.[0] ? baglamOf(wdVefat?.q) : undefined;
  if (vefat && out.length < 6) out.push({ year, kind: 'Vefat', text: vefat, baglam: vefatBaglam, kaynak: vefatBaglam ? 'Vikipedi' : undefined });
  return dagit(tekrarAt(out));
}

/** Aynı gün aynı olay iki kez çıkmasın (12 Eylül darbesi hem manşet hem gündem; deprem hem haber hem deprem kartı) */
function tekrarAt(list: Moment[]): Moment[] {
  const kok = (t: string) => new Set((t.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü0-9]{4,}/g) ?? []).map((w) => w.slice(0, 5)));
  const haber = (m: Moment) => m.kind === 'Manşet' || m.kind === 'Gündem' || m.kind === 'Dünya';
  const gor: Set<string>[] = [];
  const depremHaberi = list.some((m) => (haber(m) && /deprem/i.test(m.text)) || (m.kind === 'Gazete' && (m.gazete?.basliklar ?? []).some((b) => /deprem/i.test(b))));
  return list.filter((m) => {
    if (m.kind === 'Deprem' && depremHaberi) return false; // büyüklük iki kartta farklı yazmasın; haber kalır
    if (!haber(m)) return true;
    const k = kok(m.text.slice(0, 160));
    const ayni = gor.some((g) => { let o = 0; for (const w of k) if (g.has(w)) o++; const az = Math.min(k.size, g.size); return (o >= 3 || (az <= 4 && o >= 2)) && o / az >= 0.5; })
      || gor.some((g) => ['depre', 'darbe', 'belge'].some((w) => g.has(w) && k.has(w)));
    if (ayni) return false;
    gor.push(k);
    return true;
  });
}

/** Aynı olayın farklı yazılmış başlıklarını eler (ilk geçen kalır) */
function tekrarsiz(list: Haber[]): Haber[] {
  const kok = (t: string) => new Set((t.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü0-9]{4,}/g) ?? []).map((w) => w.slice(0, 5)));
  const gor: Set<string>[] = [];
  return list.filter((h) => {
    const k = kok(h.title);
    const ayni = gor.some((g) => { let o = 0; for (const w of k) if (g.has(w)) o++; const az = Math.min(k.size, g.size); return (o >= 3 || (az <= 4 && o >= 2)) && o / az >= 0.5; })
      // aynı olay: ikisinde de deprem / darbe / saldırı / belgesel geçiyorsa
      || gor.some((g) => ['depre', 'darbe', 'saldı', 'belge'].some((w) => g.has(w) && k.has(w)));
    if (ayni) return false;
    gor.push(k); return true;
  });
}

/** Maç kayıtlarındaki İngilizce turnuva adları */
function turnuvaTr(t: string): string {
  return t.replace(/(\d{4}\s+)?FIFA World Cup qualification/i, 'Dünya Kupası elemesi').replace(/(\d{4}\s+)?FIFA World Cup/i, 'Dünya Kupası')
    .replace(/UEFA Euro(pean Championship)?\s*(\d{4})?\s*qualifying/i, 'Avrupa Şampiyonası elemesi').replace(/UEFA Euro(pean Championship)?\s*(\d{4})?/i, 'Avrupa Şampiyonası')
    .replace(/UEFA Nations League/i, 'Uluslar Ligi').replace(/^Friendly$/i, 'Hazırlık maçı').replace(/Mediterranean Games/i, 'Akdeniz Oyunları');
}

/** Açıklamasız tek satırlık haberler art arda gelmesin: zengin gönderilerin (açıklamalı, görselli, kartlı) arasına serpiştir */
function dagit(list: Moment[]): Moment[] {
  const ciplak = (m: Moment) => (m.kind === 'Gündem' || m.kind === 'Dünya' || m.kind === 'Manşet') && !m.sub && !m.image && !m.baglam;
  const zengin = list.filter((m) => !ciplak(m)), tek = list.filter(ciplak);
  if (!tek.length || !zengin.length) return list;
  const out: Moment[] = [];
  zengin.forEach((m, i) => { out.push(m); if (tek.length && i % 2 === 0) out.push(tek.shift()!); });
  return [...out, ...tek];
}

function hasData(y: number, m: number, d: number) {
  if (y < FIRST_YEAR) return false;
  if (y < LAST_DAY.y) return true;
  return y === LAST_DAY.y && (m < LAST_DAY.m || (m === LAST_DAY.m && d <= LAST_DAY.d));
}

/** Bugünün tarihini her yıl için çeker; geldikçe listeye ekler (yeniden eskiye). */
export function useTodayAcrossYears(month: number, day: number, thisYear: number) {
  const [moments, setMoments] = useState<Record<number, Moment[] | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<Record<number, Song>>({});
  const years: number[] = [];
  for (let y = thisYear; y >= FIRST_YEAR; y--) if (hasData(y, month, day)) years.push(y);

  useEffect(() => {
    let alive = true;
    const queue = [...years];
    const sonP = fetchDay(SON_GUN).catch(() => null);
    const worker = async () => {
      while (alive && queue.length) {
        const y = queue.shift()!;
        try {
          const [d, ek, son] = await Promise.all([fetchDay(isoOf(y, month, day)), fetchEkForYear(y), sonP]);
          if (alive) {
            setMoments((prev) => ({ ...prev, [y]: pickMoments(y, d, ek, son) }));
            const m = d.music?.find((x) => cikmisMi(x.note, d.date));
            // radyo: o günün YouTube kaydı olan şarkıları sırayla denenecek adaylar (o gün henüz çıkmamış olanlar hariç)
            const kotu = ek?.gundem?.ytKotu;
            const adaylar = (d.music ?? []).filter((x) => x.youtubeId && !kotu?.has(x.youtubeId) && cikmisMi(x.note, d.date))
              .sort((a, b) => Number(turkceSarki(b.title, b.artist)) - Number(turkceSarki(a.title, a.artist))).slice(0, 8)
              .map((x) => ({ title: x.title, artist: x.artist, image: imageUrl(x.image, [x.title, x.artist]), yt: x.youtubeId }));
            if (m) setSongs((prev) => ({ ...prev, [y]: { title: m.title, artist: m.artist, image: imageUrl(m.image, [m.title, m.artist]), yt: m.youtubeId, adaylar } }));
          }
        } catch (e: any) {
          if (alive) {
            setMoments((prev) => ({ ...prev, [y]: null }));
            setError(`${dataBaseUrl()} · ${String(e?.message ?? e)}`);
          }
        }
      }
    };
    Promise.all(Array.from({ length: 6 }, worker));
    return () => { alive = false; };
  }, [month, day]);

  return { years, moments, songs, error };
}
