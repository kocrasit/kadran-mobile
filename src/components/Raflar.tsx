import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { haberleriTopla } from '../haberler';
import { KadranGazetesi } from './KadranGazetesi';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  AYLAR, fetchEk, fetchEski, fetchGundem, fetchWd, formatTL, gazeteUrl, gorsel, isoOf, yilDuzeyi, fetchDay, ARSIV_BASI,
  eskiDolar, asgariUcret, Dizi, ligAdi, wdGorsel, fetchEkForYear,
} from '../data';
import { GAZETE_TARAMA } from '../ayarlar';
import { Bas, C, F } from '../ui';

/**
 * Raflar: Kadran'daki her şey türüne göre, on yıl on yıl.
 * Filmler, plaklar, diziler, maçlar, gazeteler, depremler, fiyatlar, aletler.
 * Tarihi belli olan bir kayda basınca o güne ışınlanılır.
 */

const AMBER = '#FFB000';
const ON_YILLAR = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const ON_YIL_AD: Record<number, string> = { 1950: "50'ler", 1960: "60'lar", 1970: "70'ler", 1980: "80'ler", 1990: "90'lar", 2000: "2000'ler", 2010: "2010'lar", 2020: "2020'ler" };

interface Kayit { y: number; baslik: string; alt?: string; gorsel?: string | null; tarih?: string; skor?: number; vurgu?: boolean;
  /** Gazeteler rafı (yayın): o sabahın başlıkları ve gazetenin kendi arşivine bağlantı */
  gazete?: { basliklar: string[]; link?: string; ad: string; kaynak?: string } }
type Yukleyici = (ctx: { month: number; day: number; onYil: number }) => Promise<Kayit[]>;
interface Raf { key: string; ad: string; ikon: string; aciklama: string; kaynak: string; yukle: Yukleyici; onYilBazli?: boolean; gizli?: boolean }

const temiz = (n: string) => n.replace(/\s*\((?:film|albüm|şarkı|single|plak|dizi|TV dizisi|televizyon dizisi)[^)]*\)/i, '').trim();
const tarihMi = (t?: string | null) => !!t && !yilDuzeyi(t) && /^\d{4}-\d{2}-\d{2}/.test(t);
const gunAy = (iso: string) => `${Number(iso.slice(8, 10))} ${AYLAR[Number(iso.slice(5, 7)) - 1]}`;
function indir(uri: string): Promise<boolean> {
  return Promise.race([
    Image.prefetch(uri).then((ok) => ok !== false).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
  ]);
}
const BUYUKLER = /^(Galatasaray|Fenerbahçe|Beşiktaş|Trabzonspor)$/;

const RAFLAR: Raf[] = [
  {
    key: 'film', ad: 'Filmler', ikon: '🎬', aciklama: 'Yeşilçam’dan bugüne vizyona girenler', kaynak: 'Wikidata',
    yukle: async () => {
      const wd = await fetchWd();
      return Object.values(wd?.filmler ?? {}).flat().map((f) => ({
        y: Number(f.t.slice(0, 4)), baslik: temiz(f.n), alt: f.yon ? `yönetmen ${f.yon}` : undefined, gorsel: gorsel(f.img) ?? wdGorsel(f.q),
        tarih: tarihMi(f.t) ? f.t.slice(0, 10) : undefined, skor: f.s,
      }));
    },
  },
  {
    key: 'muzik', ad: 'Plaklar', ikon: '💿', aciklama: 'O yıl çıkan albümler ve şarkılar', kaynak: 'Wikidata',
    yukle: async () => {
      const wd = await fetchWd();
      return Object.values(wd?.muzik ?? {}).flat().filter((m) => temiz(m.n).length >= 3).map((m) => ({
        y: Number(m.t.slice(0, 4)), baslik: temiz(m.n), alt: m.sanatci, gorsel: gorsel(m.img) ?? wdGorsel(m.q),
        tarih: tarihMi(m.t) ? m.t.slice(0, 10) : undefined, skor: m.s,
      }));
    },
  },
  {
    key: 'dizi', ad: 'Diziler', ikon: '📺', aciklama: 'Ekrana ilk geldikleri yıla göre', kaynak: 'Vikipedi, Wikidata',
    yukle: async () => {
      const [d, wd] = await Promise.all([fetchEk<{ diziler: Dizi[] }>('diziler.json'), fetchWd()]);
      const out: Kayit[] = [];
      const gor = new Set<string>();
      const norm = (x: string) => temiz(x).toLocaleLowerCase('tr-TR');
      for (const w of wd?.diziler ?? []) {
        if (!w.bas) continue;
        gor.add(norm(w.n));
        const kanal = w.kanal[0]?.replace('Türkiye Radyo Televizyon Kurumu', 'TRT');
        out.push({ y: Number(w.bas.slice(0, 4)), baslik: temiz(w.n), alt: [kanal, w.bit && w.bit.slice(0, 4) !== w.bas.slice(0, 4) ? `${w.bas.slice(0, 4)}–${w.bit.slice(0, 4)}` : null, w.bolum ? `${w.bolum} bölüm` : null].filter(Boolean).join(' · ') || undefined, gorsel: gorsel(w.img) ?? wdGorsel(w.q), skor: w.s + 1 });
      }
      for (const [n, kanal, bas, bit] of d?.diziler ?? []) {
        if (gor.has(norm(n))) continue;
        out.push({ y: Number(bas.slice(0, 4)), baslik: temiz(n), alt: [kanal, bit && bit.slice(0, 4) !== bas.slice(0, 4) ? `${bas.slice(0, 4)}–${bit.slice(0, 4)}` : null].filter(Boolean).join(' · ') || undefined, skor: 0 });
      }
      return out;
    },
  },
  {
    key: 'mac', ad: 'Maçlar', ikon: '⚽', aciklama: 'Milli maçlar, derbiler ve şampiyonlar', kaynak: 'International football results (CC0), engsoccerdata, RSSSF', onYilBazli: true,
    yukle: async ({ onYil }) => {
      const out: Kayit[] = [];
      const [e, s] = await Promise.all([fetchEski(), fetchEk<{ sezonlar: { sezon: string; sampiyon: string; son: number }[] }>('sampiyonlar.json')]);
      for (const z of s?.sezonlar ?? []) if (z.son >= onYil && z.son < onYil + 10) out.push({ y: z.son, baslik: `${z.sampiyon} şampiyon`, alt: `${z.sezon} sezonu`, vurgu: true, skor: 100 });
      for (const [iso, maclar] of Object.entries(e?.milli ?? {})) {
        const y = Number(iso.slice(0, 4));
        if (y < onYil || y >= onYil + 10) continue;
        for (const [ev, dep, a, b, tur, sehir] of maclar) out.push({ y, baslik: `${ev} ${a}–${b} ${dep}`, alt: `${gunAy(iso)} · ${tur}${sehir ? `, ${sehir}` : ''}`, tarih: iso, skor: 10 });
      }
      // derbiler: büyük takımların birbiriyle maçları (lig verisi 1994'ten)
      const yillar = Array.from({ length: 10 }, (_, i) => onYil + i).filter((y) => y >= 1994 && y <= 2025);
      const ligler = await Promise.all(yillar.map((y) => fetchEk<{ gunler: Record<string, [string, string, number, number][]> }>(`maclar/${y}.json`)));
      for (const lig of ligler) for (const [iso, maclar] of Object.entries(lig?.gunler ?? {})) {
        for (const [ev, dep, a, b] of maclar) if (BUYUKLER.test(ev) && BUYUKLER.test(dep)) out.push({ y: Number(iso.slice(0, 4)), baslik: `${ev} ${a}–${b} ${dep}`, alt: `${gunAy(iso)} · ${ligAdi(iso)} derbisi`, tarih: iso, skor: 5 });
      }
      return out;
    },
  },
  {
    key: 'gazete', ad: 'Gazeteler', ikon: '🗞', aciklama: 'Bugünün tarihli gazetesi, yıl yıl', kaynak: 'gazete arşivleri', onYilBazli: true,
    yukle: async ({ month, day, onYil }) => {
      const bugun = new Date().getFullYear();
      if (!GAZETE_TARAMA) {
        // yayın: taramayı göstermeyiz; o sabahın başlıklarıyla Kadran Gazetesi + gazetenin kendi arşivine bağlantı
        const yillar = Array.from({ length: 10 }, (_, i) => onYil + i).filter((y) => y < bugun && y >= ARSIV_BASI);
        const sonuc = await Promise.all(yillar.map(async (y) => {
          const iso = isoOf(y, month, day);
          const [d, ek] = await Promise.all([fetchDay(iso).catch(() => null), fetchEkForYear(y).catch(() => null)]);
          if (!d) return null;
          const tr = haberleriTopla(d, ek).filter((h) => h.scope === 'TR');
          if (tr.length < 2) return null;
          const nf = d.newspaperFront;
          const ad = nf?.paper ?? 'Milliyet';
          const link = nf ? (nf.provider === 'turkiyegazetesi' ? nf.image.url : nf.image.sourcePage ?? nf.image.url) : undefined;
          return { y, baslik: `${day} ${AYLAR[month - 1]} ${y}`, tarih: iso,
            gazete: { basliklar: tr.slice(0, 4).map((h) => h.title), link, ad, kaynak: [...new Set(tr.slice(0, 4).map((h) => h.kaynak).filter(Boolean))].join(', ') } } as Kayit;
        }));
        return sonuc.filter(Boolean) as Kayit[];
      }
      const adaylar = Array.from({ length: 10 }, (_, i) => onYil + i).filter((y) => y < bugun)
        .map((y) => ({ y, baslik: `${day} ${AYLAR[month - 1]} ${y}`, alt: 'Milliyet ön sayfası', gorsel: gazeteUrl(isoOf(y, month, day)), tarih: isoOf(y, month, day) }));
      // sayfası inmeyen yıl hiç gösterilmez
      const inen = await Promise.all(adaylar.map((k) => indir(k.gorsel)));
      return adaylar.filter((_, i) => inen[i]);
    },
  },
  {
    key: 'deprem', ad: 'Depremler', ikon: '⚠️', aciklama: 'Türkiye’de 5 ve üzeri sarsıntılar', kaynak: 'AFAD, USGS',
    yukle: async () => {
      const g = await fetchGundem();
      const out: Kayit[] = [];
      for (const [iso, list] of Object.entries(g?.deprem ?? {})) for (const d of list) {
        if (d.m < 5) continue;
        out.push({ y: Number(iso.slice(0, 4)), baslik: `${d.m.toLocaleString('tr-TR')} büyüklüğünde`, alt: `${gunAy(iso)} · ${d.yer} · saat ${d.saat}`, tarih: iso, skor: d.m, vurgu: d.m >= 6.5 });
      }
      return out;
    },
  },
  {
    key: 'fiyat', ad: 'Fiyatlar', ikon: '💰', aciklama: 'Dolar, asgari ücret, ekmek', kaynak: 'OECD/FRED, ÇSGB, Hürriyet, İHA, Kadran veri arşivi', onYilBazli: true,
    yukle: async ({ month, day, onYil }) => {
      const e = await fetchEski();
      const bugun = new Date().getFullYear();
      const yillar = Array.from({ length: 10 }, (_, i) => onYil + i).filter((y) => y < bugun);
      const gunler = await Promise.all(yillar.map((y) => (y >= ARSIV_BASI ? fetchDay(isoOf(y, month, day)).catch(() => null) : Promise.resolve(null))));
      const out: Kayit[] = [];
      yillar.forEach((y, i) => {
        const iso = isoOf(y, month, day);
        const satir: string[] = [];
        const usd = gunler[i]?.economy?.usdTry?.value;
        const eski = eskiDolar(e, iso);
        if (usd) satir.push(`1 dolar ${formatTL(usd, y)}`);
        else if (eski && y < ARSIV_BASI) satir.push(`1 dolar ${eski.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lira`);
        const au = asgariUcret(e, iso);
        if (au) satir.push(`asgari ücret ${formatTL(au, y)}`);
        const ek = e?.fiyat?.ekmek.find((x) => x.y === y);
        if (ek) satir.push(`ekmek ${ek.fiyat}${ek.gram ? ` (${ek.gram} gr)` : ''}`);
        const dk = e?.fiyat?.ekmek_dakika?.yil[String(y)];
        if (dk) satir.push(`bir ekmek ${dk.toLocaleString('tr-TR')} dk emek`);
        if (satir.length) out.push({ y, baslik: satir[0], alt: satir.slice(1).join(' · ') || undefined, tarih: y >= ARSIV_BASI ? iso : undefined });
      });
      return out;
    },
  },
  {
    key: 'alet', ad: 'Aletler', ikon: '📟', aciklama: 'Evimize girdikleri yıla göre', kaynak: 'Kadran, Vikipedi görselleri',
    yukle: async () => {
      const a = await fetchEk<{ a: string; n: string; b: number; s?: number }[]>('aletler.json');
      return (a ?? []).map((x) => ({ y: x.b, baslik: x.a, alt: x.s ? `${x.n} · ${x.b}–${x.s}` : x.n }));
    },
  },
];

export function Raflar({ month, day, onTravel }: { month: number; day: number; onTravel: (y: number, m: number, d: number) => void }) {
  const [acik, setAcik] = useState<Raf | null>(null);
  if (acik) return <RafSayfasi raf={acik} month={month} day={day} onGeri={() => setAcik(null)} onTravel={onTravel} />;
  const gorunen = RAFLAR.filter((r) => !r.gizli);
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>Raflar</Text>
      <Text style={st.p}>Kadran’daki her şey türüne göre. Bir rafı aç, on yılını seç, istediğin güne git.</Text>
      <View style={st.izgara}>
        {gorunen.map((r) => (
          <View key={r.key} style={st.kartKap}>
            <Bas onPress={() => setAcik(r)} style={st.kart} scale={0.97}>
              <Text style={st.kartIkon}>{r.ikon}</Text>
              <Text style={st.kartAd}>{r.ad}</Text>
              <Text style={st.kartAlt} numberOfLines={2}>{r.aciklama}</Text>
            </Bas>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function RafSayfasi({ raf, month, day, onGeri, onTravel }: {
  raf: Raf; month: number; day: number; onGeri: () => void; onTravel: (y: number, m: number, d: number) => void;
}) {
  const [onYil, setOnYil] = useState(1980);
  const [kayitlar, setKayitlar] = useState<Kayit[] | null>(null);
  const [acikYil, setAcikYil] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    setKayitlar(null);
    raf.yukle({ month, day, onYil }).then((k) => alive && setKayitlar(k)).catch(() => alive && setKayitlar([]));
    return () => { alive = false; };
  }, [raf.key, raf.onYilBazli ? onYil : 0]);

  // on yıl bazlı olmayan raflarda: hangi on yıllarda kayıt var
  const doluOnYillar = useMemo(() => {
    if (raf.onYilBazli || !kayitlar) return ON_YILLAR;
    const s = new Set(kayitlar.map((k) => Math.floor(k.y / 10) * 10));
    return ON_YILLAR.filter((o) => s.has(o));
  }, [kayitlar, raf.onYilBazli]);
  useEffect(() => { if (!doluOnYillar.includes(onYil) && doluOnYillar.length) setOnYil(doluOnYillar[Math.min(3, doluOnYillar.length - 1)]); }, [doluOnYillar]);

  const yillar = useMemo(() => {
    const m = new Map<number, Kayit[]>();
    for (const k of kayitlar ?? []) {
      if (k.y < onYil || k.y >= onYil + 10) continue;
      if (!m.has(k.y)) m.set(k.y, []);
      m.get(k.y)!.push(k);
    }
    for (const l of m.values()) l.sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0) || (a.tarih ?? '').localeCompare(b.tarih ?? ''));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [kayitlar, onYil]);

  const git = (iso: string) => onTravel(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));

  return (
    <ScrollView contentContainerStyle={st.page} stickyHeaderIndices={[1]}>
      <View>
        <Pressable onPress={onGeri} hitSlop={10} style={st.geri}><Text style={st.geriText}>‹ Raflar</Text></Pressable>
        <Text style={st.h1}>{raf.ikon} {raf.ad}</Text>
        <Text style={st.p}>{raf.aciklama}</Text>
      </View>
      <View style={st.seritKap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {doluOnYillar.map((o) => (
            <Pressable key={o} onPress={() => setOnYil(o)} style={[st.cip, onYil === o && st.cipAktif]}>
              <Text style={[st.cipText, onYil === o && { color: '#111' }]}>{ON_YIL_AD[o]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {!kayitlar && <ActivityIndicator color={C.faint} style={{ marginTop: 40 }} />}
      {kayitlar && !yillar.length && <Text style={[st.p, { marginTop: 30 }]}>Bu on yıl için bu rafta henüz kayıt yok.</Text>}

      {yillar.map(([y, list]) => {
        const hepsi = acikYil[y];
        const gosterilen = hepsi ? list : list.slice(0, raf.key === 'gazete' ? 1 : 6);
        return (
          raf.key === 'fiyat' ? (
            <View key={y} style={st.fiyatSatir}>
              <Text style={st.fiyatYil}>{y}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.satirBaslik}>{list[0].baslik}</Text>
                {!!list[0].alt && <Text style={st.satirAlt}>{list[0].alt}</Text>}
              </View>
            </View>
          ) :
          <Animated.View key={y} entering={FadeIn} style={st.yil}>
            <Text style={st.yilNo}>{y}</Text>
            {raf.key === 'gazete'
              ? gosterilen.map((k) => k.gazete
                ? <GazeteSayfasi key={k.baslik} k={k} onPress={() => k.tarih && git(k.tarih)} />
                : <GazeteKapak key={k.baslik} k={k} onPress={() => k.tarih && git(k.tarih)} />)
              : gosterilen.map((k, i) => <Satir key={i} k={k} onPress={k.tarih ? () => git(k.tarih!) : undefined} />)}
            {list.length > gosterilen.length && (
              <Pressable onPress={() => setAcikYil({ ...acikYil, [y]: true })} hitSlop={6}>
                <Text style={st.daha}>+{list.length - gosterilen.length} daha</Text>
              </Pressable>
            )}
          </Animated.View>
        );
      })}
      {kayitlar && yillar.length > 0 && <Text style={st.kaynak}>Kaynak: {raf.kaynak}</Text>}
    </ScrollView>
  );
}

function Satir({ k, onPress }: { k: Kayit; onPress?: () => void }) {
  const [resimYok, setResimYok] = useState(false);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.satir, pressed && { opacity: 0.6 }]}>
      {k.gorsel && !resimYok
        ? <Image source={{ uri: k.gorsel }} style={st.kucukResim} onError={() => setResimYok(true)} />
        : null}
      <View style={{ flex: 1 }}>
        <Text style={[st.satirBaslik, k.vurgu && { color: AMBER }]} numberOfLines={2}>{k.baslik}</Text>
        {!!k.alt && <Text style={st.satirAlt} numberOfLines={2}>{k.alt}</Text>}
      </View>
      {onPress && <Text style={st.ok}>›</Text>}
    </Pressable>
  );
}

/** Yayın: Kadran Gazetesi (kendi tasarımımız, başlıklar kaynağıyla) + gazetenin kendi arşivinde o günkü sayfa */
function GazeteSayfasi({ k, onPress }: { k: Kayit; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const g = k.gazete!;
  const [, mm, dd] = k.tarih!.split('-').map(Number);
  return (
    <View>
      <Pressable onPress={onPress} style={{ borderRadius: 14, overflow: 'hidden' }}>
        <KadranGazetesi year={k.y} month={mm} day={dd} icerik={{ manset: g.basliklar[0], basliklar: g.basliklar }} genislik={Math.min(width, 560) - 36} kaynak={g.kaynak} />
      </Pressable>
      {!!g.link && (
        <Pressable onPress={() => Linking.openURL(g.link!).catch(() => {})} hitSlop={6} style={{ paddingVertical: 8 }}>
          <Text style={[st.daha, { paddingVertical: 0 }]}>{g.ad} gazetesinin o günkü ön sayfası, kendi arşivinde ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Gazete kapağı (yükleyici yalnızca inen sayfaları verir); sonradan hata verirse gizlenir */
function GazeteKapak({ k, onPress }: { k: Kayit; onPress: () => void }) {
  const [yok, setYok] = useState(false);
  if (yok) return null;
  return (
    <Pressable onPress={onPress} style={st.kapak}>
      <Image source={{ uri: k.gorsel! }} style={{ width: '100%', height: '210%' }} resizeMode="cover" onError={() => setYok(true)} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  page: { padding: 18, paddingBottom: 140 },
  h1: { fontFamily: F.serif, color: C.text, fontSize: 44, marginTop: 6, marginBottom: 4 },
  p: { fontFamily: F.r, color: C.sub, fontSize: 16, lineHeight: 23 },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  kartKap: { width: '47.5%' },
  kart: { flex: 1, backgroundColor: C.card, borderRadius: 22, padding: 16, minHeight: 132, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  kartIkon: { fontSize: 28 },
  kartAd: { fontFamily: F.b, color: C.text, fontSize: 18, marginTop: 12 },
  kartAlt: { fontFamily: F.r, color: C.faint, fontSize: 13, lineHeight: 17, marginTop: 4 },
  geri: { alignSelf: 'flex-start', paddingVertical: 6 },
  geriText: { fontFamily: F.sb, color: AMBER, fontSize: 15 },
  seritKap: { backgroundColor: C.bg, marginHorizontal: -18, paddingHorizontal: 18, marginTop: 8 },
  cip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  cipAktif: { backgroundColor: AMBER, borderColor: AMBER },
  cipText: { fontFamily: F.sb, color: C.text, fontSize: 14 },
  yil: { marginTop: 22 },
  yilNo: { fontFamily: F.serif, color: C.text, fontSize: 30, marginBottom: 6 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  kucukResim: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.card2 },
  satirBaslik: { fontFamily: F.sb, color: C.text, fontSize: 15.5, lineHeight: 20 },
  satirAlt: { fontFamily: F.r, color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 2 },
  ok: { fontFamily: F.r, color: C.faint, fontSize: 22 },
  daha: { fontFamily: F.sb, color: AMBER, fontSize: 14, paddingVertical: 8 },
  kapak: { width: '100%', aspectRatio: 1.25, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card2 },
  kaynak: { fontFamily: F.r, color: C.faint, fontSize: 12, marginTop: 28 },
  fiyatSatir: { flexDirection: 'row', gap: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, alignItems: 'baseline' },
  fiyatYil: { fontFamily: F.serif, color: C.text, fontSize: 26, width: 64 },
});
