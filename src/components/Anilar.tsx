import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GAZETE_TARAMA } from '../ayarlar';
import { AYLAR, fetchEk, gazeteUrl, gorsel, isoOf, wpGorsel } from '../data';
import { themeForYear } from '../theme';
import { Bas, C, ERA_LIGHT, F } from '../ui';

/**
 * Anılar: bugünün tarihinde, geçmiş yıllarda çekilmiş fotoğraflar — yıl sırasıyla, kısa açıklamalarla.
 * Kaynak: veri-ek/anilar/AA-GG.json (Wikimedia Commons'ta o gün çekilmiş fotoğraflardan seçki, açıklamalar Türkçe ve kısa).
 * Kural: yüklenemeyen fotoğraf asla gösterilmez. Her fotoğraf önce arka planda indirilir; inmezse listeye hiç girmez.
 */
interface Ani { g: string; c: string; u: string; w?: number; h?: number; y?: string; l?: string; s?: string; gazete?: boolean }
const AYNI_ANDA = 3;

/** Fotoğraf gerçekten iniyor mu? (önbelleğe alır; görüntülenirken tekrar inmez) */
function indir(uri: string): Promise<boolean> {
  return Promise.race([
    Image.prefetch(uri).then((ok) => ok !== false).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
  ]);
}

const GUN_SAYISI = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Bir gün ileri/geri (yıl önemsiz; 29 Şubat dahil) */
function kaydir(m: number, d: number, n: number): { m: number; d: number } {
  d += n;
  if (d < 1) { m = m === 1 ? 12 : m - 1; d = GUN_SAYISI[m - 1]; }
  else if (d > GUN_SAYISI[m - 1]) { m = m === 12 ? 1 : m + 1; d = 1; }
  return { m, d };
}

/** Anılar: üstte gün seçici (‹ tarih ›), altında o günün fotoğrafları. Varsayılan gün bugündür. */
export function Anilar({ month, day, thisYear, onTravel }: {
  month: number; day: number; thisYear: number; onTravel: (y: number, m: number, d: number) => void;
}) {
  const [secili, setSecili] = useState({ m: month, d: day });
  const [secici, setSecici] = useState(false);
  const bugunMu = secili.m === month && secili.d === day;
  return (
    <View>
      <View style={a.gunSatir}>
        <Pressable onPress={() => setSecili((s) => kaydir(s.m, s.d, -1))} hitSlop={10} style={a.ok}><Text style={a.okText}>‹</Text></Pressable>
        <Pressable onPress={() => setSecici(true)} style={a.tarihKutu}>
          <Text style={a.tarih}>{secili.d} {AYLAR[secili.m - 1]}</Text>
          <Text style={a.tarihAlt}>{bugunMu ? 'bugün · başka gün seç ▾' : 'başka gün seç ▾'}</Text>
        </Pressable>
        <Pressable onPress={() => setSecili((s) => kaydir(s.m, s.d, 1))} hitSlop={10} style={a.ok}><Text style={a.okText}>›</Text></Pressable>
      </View>
      {!bugunMu && (
        <Pressable onPress={() => setSecili({ m: month, d: day })} style={a.bugunDon}><Text style={a.bugunDonText}>Bugüne dön</Text></Pressable>
      )}
      <AnilarListe key={`${secili.m}-${secili.d}`} month={secili.m} day={secili.d} thisYear={thisYear} onTravel={(y) => onTravel(y, secili.m, secili.d)} />
      <GunSecici acik={secici} m={secili.m} d={secili.d} onKapat={() => setSecici(false)} onSec={(m, d) => { setSecili({ m, d }); setSecici(false); }} />
    </View>
  );
}

/** Ay ve gün seçimi: üstte 12 ay, altında o ayın günleri */
function GunSecici({ acik, m, d, onKapat, onSec }: { acik: boolean; m: number; d: number; onKapat: () => void; onSec: (m: number, d: number) => void }) {
  const [ay, setAy] = useState(m);
  useEffect(() => { if (acik) setAy(m); }, [acik]);
  return (
    <Modal visible={acik} transparent animationType="fade" onRequestClose={onKapat}>
      <Pressable style={a.perde} onPress={onKapat}>
        <Pressable style={a.panel} onPress={() => {}}>
          <Text style={a.panelBaslik}>Hangi günün anıları?</Text>
          <View style={a.aylar}>
            {AYLAR.map((ad, i) => (
              <Pressable key={ad} onPress={() => setAy(i + 1)} style={[a.ayKutu, ay === i + 1 && a.secKutu]}>
                <Text style={[a.ayText, ay === i + 1 && { color: '#111' }]}>{ad.slice(0, 3)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={a.gunler}>
            {Array.from({ length: GUN_SAYISI[ay - 1] }, (_, i) => i + 1).map((g) => (
              <Pressable key={g} onPress={() => onSec(ay, g)} style={[a.gunKutu, ay === m && g === d && a.secKutu]}>
                <Text style={[a.gunText, ay === m && g === d && { color: '#111' }]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AnilarListe({ month, day, thisYear, onTravel }: {
  month: number; day: number; thisYear: number; onTravel: (y: number) => void;
}) {
  const [liste, setListe] = useState<Ani[] | null>(null);
  const [hazir, setHazir] = useState<Set<string>>(new Set());
  const [bitti, setBitti] = useState(false);

  useEffect(() => {
    let canli = true;
    setListe(null); setHazir(new Set()); setBitti(false);
    const md = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fetchEk<Ani[]>(`anilar/${md}.json`).then(async (fotolar) => {
      if (!canli) return;
      // fotoğrafın az olduğu eski yıllar için o sabahın gazetesi: her 5 yıldan biri (1980, 1985, … 2000)
      const sec = GAZETE_TARAMA ? [1980, 1985, 1990, 1995, 2000] : [];
      const gazeteler: Ani[] = sec.map((y) => ({ g: isoOf(y, month, day), c: 'O sabahın gazetesinin manşeti', u: gazeteUrl(isoOf(y, month, day)), w: 3, h: 4, gazete: true }));
      const hepsi = [...gazeteler, ...(fotolar ?? []).map((f) => ({ ...f, u: gorsel(f.u) ?? f.u }))]
        .filter((f) => f.g < isoOf(thisYear, 1, 1) || f.g <= new Date().toISOString().slice(0, 10))
        .sort((a, b) => a.g.localeCompare(b.g));
      setListe(hepsi);
      // sırayla, en fazla 3'er 3'er indir; inen görünür
      let i = 0;
      const isci = async () => {
        while (canli && i < hepsi.length) {
          const f = hepsi[i++];
          if (await indir(f.u)) canli && setHazir((s) => new Set(s).add(f.u));
        }
      };
      await Promise.all(Array.from({ length: AYNI_ANDA }, isci));
      canli && setBitti(true);
    });
    return () => { canli = false; };
  }, [month, day]);

  const gorunen = (liste ?? []).filter((f) => hazir.has(f.u));
  if (liste === null || (!gorunen.length && !bitti)) {
    return (
      <View style={a.bos}>
        <ActivityIndicator color={C.faint} />
        <Text style={a.bosText}>Anılar yükleniyor…</Text>
      </View>
    );
  }
  return (
    <View>
      {gorunen.length ? (
        <Fotolar gorunen={gorunen} bitti={bitti} thisYear={thisYear} onTravel={onTravel} onHata={(u) => setHazir((s) => { const n = new Set(s); n.delete(u); return n; })} />
      ) : <View style={a.bos}><Text style={a.bosText}>Bu güne ait fotoğraf bulunamadı.</Text></View>}
      <Aletler />
    </View>
  );
}

function Fotolar({ gorunen, bitti, thisYear, onTravel, onHata }: {
  gorunen: Ani[]; bitti: boolean; thisYear: number; onTravel: (y: number) => void; onHata: (u: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: 14, gap: 22, marginTop: 8 }}>
      {gorunen.map((f) => (
        <AniKart key={f.u} f={f} thisYear={thisYear} onTravel={onTravel}
          onHata={() => onHata(f.u)} />
      ))}
      {!bitti && <ActivityIndicator color={C.faint} style={{ marginVertical: 10 }} />}
    </View>
  );
}

/* ---------------- O yıllarda elimizde: dönemin aletleri ---------------- */
interface Alet { a: string; n: string; wp: string; wl: string; b: number; s?: number }
const ON_YILLAR: [number, string][] = [[1980, "80'ler"], [1990, "90'lar"], [2000, "2000'ler"], [2010, "2010'lar"], [2020, "2020'ler"]];

/** Anıların sonunda: her on yılda evlere giren aletler. Görseli inmeyen alet gösterilmez. */
function Aletler() {
  const [liste, setListe] = useState<(Alet & { u: string })[]>([]);
  const [hazir, setHazir] = useState<Set<string>>(new Set());
  useEffect(() => {
    let canli = true;
    fetchEk<Alet[]>('aletler.json').then(async (l) => {
      if (!canli || !l) return;
      const hepsi = l.map((x) => ({ ...x, u: wpGorsel(x.wp, x.wl) }));
      setListe(hepsi);
      let i = 0;
      const isci = async () => {
        while (canli && i < hepsi.length) {
          const x = hepsi[i++];
          if (await indir(x.u)) canli && setHazir((s) => new Set(s).add(x.u));
        }
      };
      await Promise.all(Array.from({ length: AYNI_ANDA }, isci));
    });
    return () => { canli = false; };
  }, []);
  const gorunen = liste.filter((x) => hazir.has(x.u));
  if (!gorunen.length) return null;
  return (
    <View style={{ marginTop: 34 }}>
      <Text style={a.aletBaslik}>O yıllarda elimizde</Text>
      <Text style={a.aletAlt}>Hangi on yılda neler kullanıyorduk</Text>
      {ON_YILLAR.map(([on, ad]) => {
        const grup = gorunen.filter((x) => x.b >= on && x.b < on + 10);
        if (!grup.length) return null;
        const [c1] = ERA_LIGHT[themeForYear(on + 5).key];
        return (
          <View key={on} style={{ marginTop: 18 }}>
            <Text style={[a.onYil, { color: c1 }]}>{ad}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
              {grup.map((x) => (
                <Animated.View key={x.wp} entering={FadeInDown.duration(300)} style={a.aletKart}>
                  <View style={a.aletFoto}>
                    <Image source={{ uri: x.u }} style={{ width: '100%', height: '100%' }} resizeMode="contain"
                      onError={() => setHazir((s) => { const n = new Set(s); n.delete(x.u); return n; })} />
                  </View>
                  <Text style={a.aletAd} numberOfLines={1}>{x.a}</Text>
                  <Text style={a.aletNot} numberOfLines={2}>{x.n}</Text>
                  <Text style={[a.aletYil, { color: c1 }]}>{x.b}{x.s ? `–${x.s}` : ' →'}</Text>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function AniKart({ f, thisYear, onTravel, onHata }: { f: Ani; thisYear: number; onTravel: (y: number) => void; onHata: () => void }) {
  const { width } = useWindowDimensions();
  const y = Number(f.g.slice(0, 4));
  const [c1] = ERA_LIGHT[themeForYear(y).key];
  const oran = Math.min(1.25, Math.max(0.62, (f.h ?? 3) / (f.w ?? 4)));
  const w = Math.min(width, 520) - 28;
  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      <Bas onPress={() => onTravel(y)} style={a.kart}>
        {f.gazete ? (
          // gazetenin sadece üst kısmı (manşet)
          <View style={{ width: w, height: w * 0.62, overflow: 'hidden', backgroundColor: '#EFE7D6' }}>
            <Image source={{ uri: f.u }} style={{ width: w, height: w * 1.38 }} resizeMode="cover" onError={onHata} />
          </View>
        ) : (
          <Image source={{ uri: f.u }} style={{ width: w, height: w * oran, backgroundColor: C.card2 }} resizeMode="cover" onError={onHata} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={a.golge} pointerEvents="none" />
        <View style={a.yilKutu}>
          <Text style={[a.yil, { color: c1 }]}>{y}</Text>
          <Text style={a.once}>{thisYear - y} yıl önce</Text>
        </View>
      </Bas>
      <Text style={a.aciklama}>{f.c}</Text>
      {!f.gazete && !!f.y && <Text style={a.kredi} numberOfLines={1}>📷 {/https?:|www\.|\.com/i.test(f.y) ? 'Wikimedia Commons kullanıcısı' : f.y}{f.l ? ` · ${f.l}` : ''} · Wikimedia Commons</Text>}
    </Animated.View>
  );
}

const a = StyleSheet.create({
  gunSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 14, marginTop: 4, marginBottom: 6, backgroundColor: C.card, borderRadius: 20, padding: 6 },
  ok: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  okText: { fontFamily: F.b, color: C.text, fontSize: 26, marginTop: -3 },
  tarihKutu: { flex: 1, alignItems: 'center' },
  tarih: { fontFamily: F.serif, color: C.text, fontSize: 26, lineHeight: 30 },
  tarihAlt: { fontFamily: F.m, color: C.amber, fontSize: 11.5 },
  bugunDon: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,176,0,0.14)', marginBottom: 6 },
  bugunDonText: { fontFamily: F.b, color: C.amber, fontSize: 12.5 },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 18 },
  panel: { backgroundColor: C.card2, borderRadius: 24, padding: 16, maxWidth: 440, width: '100%', alignSelf: 'center' },
  panelBaslik: { fontFamily: F.serif, color: C.text, fontSize: 24, marginBottom: 12 },
  aylar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ayKutu: { width: '15%', flexGrow: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center' },
  ayText: { fontFamily: F.b, color: C.sub, fontSize: 13 },
  secKutu: { backgroundColor: C.amber },
  gunler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  gunKutu: { width: '12.4%', aspectRatio: 1, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  gunText: { fontFamily: F.sb, color: C.text, fontSize: 14 },
  aletBaslik: { fontFamily: F.serif, color: C.text, fontSize: 30, paddingHorizontal: 22 },
  aletAlt: { fontFamily: F.r, color: C.sub, fontSize: 13, paddingHorizontal: 22, marginTop: 2 },
  onYil: { fontFamily: F.serif, fontSize: 24, paddingHorizontal: 22, marginBottom: 8 },
  aletKart: { width: 150, backgroundColor: C.card, borderRadius: 18, padding: 10 },
  aletFoto: { width: '100%', height: 110, borderRadius: 12, backgroundColor: '#F2EEE6', overflow: 'hidden', padding: 6 },
  aletAd: { fontFamily: F.b, color: C.text, fontSize: 14, marginTop: 8 },
  aletNot: { fontFamily: F.r, color: C.sub, fontSize: 12, marginTop: 2, minHeight: 30 },
  aletYil: { fontFamily: F.b, fontSize: 12, marginTop: 4 },
  bos: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  bosText: { fontFamily: F.r, color: C.faint, fontSize: 14 },
  kart: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.card },
  golge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  yilKutu: { position: 'absolute', left: 16, bottom: 12, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  yil: { fontFamily: F.serif, fontSize: 38, lineHeight: 40, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  once: { fontFamily: F.b, color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  aciklama: { fontFamily: F.sb, color: C.text, fontSize: 16, marginTop: 10, marginHorizontal: 4 },
  kredi: { fontFamily: F.r, color: C.faint, fontSize: 11, marginTop: 3, marginHorizontal: 4 },
});
