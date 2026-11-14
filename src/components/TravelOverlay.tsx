import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { AYLAR } from '../data';
import { EraTheme, themeForYear } from '../theme';

const { width: W, height: H } = Dimensions.get('window');
const DURATION = 2800;

const KAR = [
  require('../../assets/fx/kar0.png'), require('../../assets/fx/kar1.png'),
  require('../../assets/fx/kar2.png'), require('../../assets/fx/kar3.png'),
];
const SES = {
  tv: require('../../assets/fx/parazit.wav'),
  vhs: require('../../assets/fx/geri_sarma.wav'),
  modem: require('../../assets/fx/modem.wav'),
  modern: require('../../assets/fx/vuus.wav'),
};

type Mode = 'tv' | 'vhs' | 'modem' | 'flat' | 'modern';
function modeFor(year: number): Mode {
  if (year < 1990) return 'tv';
  if (year < 2000) return 'vhs';
  if (year < 2010) return 'modem';
  if (year < 2020) return 'flat';
  return 'modern';
}
const SES_OF: Record<Mode, number> = { tv: SES.tv, vhs: SES.vhs, modem: SES.modem, flat: SES.modern, modern: SES.modern };

/** Yolculuğu dönemlere böl: bugünden hedefe, geçilen her on yıl ayrı bir parça. */
interface Segment { mode: Mode; from: number; to: number; ms: number; last: boolean }
function plan(fromYear: number, toYear: number): Segment[] {
  const segs: Segment[] = [];
  let y = fromYear;
  while (true) {
    const decadeStart = Math.floor(y / 10) * 10;
    const last = toYear >= decadeStart;
    const end = last ? toYear : decadeStart;
    segs.push({ mode: modeFor(y), from: y, to: end, ms: 0, last });
    if (last) break;
    y = decadeStart - 1;
  }
  // ara dönemler kısa ve hızlı, varılan dönem daha uzun
  const ara = segs.length > 3 ? 700 : 900;
  segs.forEach((sg) => { sg.ms = sg.last ? 1700 : ara; });
  return segs;
}

/**
 * Işınlanma: bugünden geriye doğru akar ve geçtiği her on yılı kendi diliyle gösterir.
 *  2020'ler → karanlık, modern tarama
 *  2010'lar → düz, açık renk akıllı telefon yüklemesi
 *  2000'ler → çevirmeli internet bağlantı penceresi + modem sesi
 *  90'lar   → VCR mavi ekranı, "◀◀ GERİ SAR", bant bozulmaları
 *  80'ler   → tüplü TV karlanması; varışta tüp açılır
 * Yıl sayacı hiç durmadan akar, her yılda telefon "tık", her dönem geçişinde güçlü titreşim.
 */
export function TravelOverlay({
  fromYear, to, onDone,
}: { fromYear: number; to: { year: number; month: number; day: number }; onDone: () => void }) {
  const segs = useMemo(() => plan(fromYear, to.year), []);
  const target = themeForYear(to.year);
  const finale = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current; // ModernMode renk geçişi için
  const [seg, setSeg] = useState(0);
  const [p, setP] = useState(0);
  const [shown, setShown] = useState(fromYear);
  const lastYear = useRef(fromYear);
  const lastSeg = useRef(-1);

  useEffect(() => {
    // her dönemin sesini önceden hazırla
    const players: Partial<Record<Mode, ReturnType<typeof createAudioPlayer>>> = {};
    for (const sg of segs) {
      if (players[sg.mode]) continue;
      try { players[sg.mode] = createAudioPlayer(SES_OF[sg.mode]); players[sg.mode]!.volume = 0.55; } catch { /* sessiz */ }
    }
    const total = segs.reduce((a, b) => a + b.ms, 0);
    const start = Date.now();
    let raf = 0;
    let bitti = false;

    const tick = () => {
      const el = Date.now() - start;
      let acc = 0, i = 0;
      while (i < segs.length - 1 && el > acc + segs[i].ms) { acc += segs[i].ms; i++; }
      const sg = segs[i];
      let lt = Math.min(1, (el - acc) / sg.ms);
      if (sg.last) lt = 1 - Math.pow(1 - lt, 3); // varışta yavaşla

      if (i !== lastSeg.current) {
        const onceki = lastSeg.current >= 0 ? segs[lastSeg.current].mode : null;
        if (onceki && onceki !== sg.mode) { try { players[onceki]?.pause(); } catch { /* */ } }
        if (onceki !== sg.mode) { try { players[sg.mode]?.seekTo(0); players[sg.mode]?.play(); } catch { /* */ } }
        if (lastSeg.current >= 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        lastSeg.current = i;
        setSeg(i);
      }
      setP(lt);
      progress.setValue(lt);
      const y = Math.round(sg.from + (sg.to - sg.from) * lt);
      if (y !== lastYear.current) {
        lastYear.current = y;
        setShown(y);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      if (el >= total) {
        if (!bitti) {
          bitti = true;
          Animated.timing(finale, { toValue: 1, duration: sg.mode === 'tv' ? 420 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: false })
            .start(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onDone();
            });
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      for (const pl of Object.values(players)) { try { pl?.remove(); } catch { /* */ } }
    };
  }, []);

  const cur = segs[seg];
  const props = { shown, p, to, target, finale: cur.last ? finale : ZERO, progress, last: cur.last };
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10, backgroundColor: '#000' }]}>
      {cur.mode === 'tv' && <TvMode {...props} />}
      {cur.mode === 'vhs' && <VhsMode {...props} />}
      {cur.mode === 'modem' && <ModemMode {...props} />}
      {cur.mode === 'flat' && <FlatMode {...props} />}
      {cur.mode === 'modern' && <ModernMode {...props} />}
      <Text style={st.era}>{themeForYear(shown).label}</Text>
    </View>
  );
}
const ZERO = new Animated.Value(0);

interface ModeProps {
  shown: number; p: number; to: { year: number; month: number; day: number };
  target: EraTheme; finale: Animated.Value; progress: Animated.Value; last: boolean;
}

/** Ekranın sürekli değişen gürültü karesi */
function useNoiseFrame(ms = 60) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % KAR.length), ms);
    return () => clearInterval(id);
  }, []);
  return KAR[i];
}

/* ---------------- 80'ler: tüplü TV ---------------- */
function TvMode({ shown, p, to, target, finale }: ModeProps) {
  const noise = useNoiseFrame(55);
  const roll = (p * 2.3) % 1;
  // sonda tüp açılır: ortadan beyaz çizgi büyür, dönemin kâğıdı görünür
  const lineScale = finale.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.004, 0.004, 1] });
  const lineOpacity = finale.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <Image source={noise} style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: 0.85 - p * 0.45 }]} resizeMode="stretch" />
      <View style={[st.rollBar, { top: roll * H - 60 }]} />
      <View style={st.center}>
        <View style={st.tvOsd}>
          <Text style={st.tvKanal}>TRT</Text>
        </View>
        <Text style={[st.tvYear, { opacity: 0.4 + p * 0.6 }]}>{shown}</Text>
        <Text style={st.tvDate}>{to.day} {AYLAR[to.month - 1]} {to.year}</Text>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: lineOpacity, transform: [{ scaleY: lineScale }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: target.paper, opacity: finale.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }]} />
      </Animated.View>
    </View>
  );
}

/* ---------------- 90'lar: VHS geri sarma ---------------- */
function VhsMode({ shown, p, to, target, finale }: ModeProps) {
  const noise = useNoiseFrame(70);
  const [jit, setJit] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setJit((Math.random() - 0.5) * 10), 80);
    return () => clearInterval(id);
  }, []);
  const bands = [0.18, 0.55, 0.82].map((b, i) => ((b + p * (1.4 + i * 0.3)) % 1) * H);
  const saniye = Math.round((1 - p) * 5400);
  const tc = `${Math.floor(saniye / 3600)}:${String(Math.floor((saniye % 3600) / 60)).padStart(2, '0')}:${String(saniye % 60).padStart(2, '0')}`;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1730B8' }]}>
      {bands.map((y, i) => (
        <Image key={i} source={noise} style={{ position: 'absolute', top: y, left: 0, width: W, height: 26 + i * 8, opacity: 0.55 }} resizeMode="stretch" />
      ))}
      <View style={[st.center, { transform: [{ translateX: jit }] }]}>
        <Text style={st.vhsOsdTop}>◀◀ GERİ SAR</Text>
        <Text style={st.vhsYear}>{shown}</Text>
        <Text style={st.vhsOsd}>{tc}</Text>
        <Text style={[st.vhsOsd, { marginTop: 22 }]}>{to.day} {AYLAR[to.month - 1].toLocaleUpperCase('tr-TR')} {to.year}</Text>
      </View>
      <Text style={st.vhsCorner}>SP</Text>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: target.paper, opacity: finale }]} />
    </View>
  );
}

/* ---------------- 2000'ler: çevirmeli bağlantı ---------------- */
const ADIMLAR = ['Numara çevriliyor…', 'Kullanıcı adı ve şifre doğrulanıyor…', 'Ağa giriş yapılıyor…', 'Bağlandı: 56,6 Kbps'];
function ModemMode({ shown, p, to, target, finale }: ModeProps) {
  const adim = Math.min(ADIMLAR.length - 1, Math.floor(p * ADIMLAR.length));
  const bloklar = Math.round(p * 18);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A6EA5', alignItems: 'center', justifyContent: 'center' }]}>
      <View style={st.win}>
        <View style={st.winTitle}>
          <Text style={st.winTitleText}>Bağlanıyor: kadran.com.tr</Text>
          <View style={st.winX}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>×</Text></View>
        </View>
        <View style={{ padding: 16 }}>
          <Text style={st.winYear}>{shown}</Text>
          <Text style={st.winText}>{to.day} {AYLAR[to.month - 1]} {to.year} tarihine bağlanılıyor</Text>
          <Text style={[st.winText, { marginTop: 12, fontWeight: '700' }]}>{ADIMLAR[adim]}</Text>
          <View style={st.bar}>
            {Array.from({ length: bloklar }, (_, i) => <View key={i} style={st.block} />)}
          </View>
          <View style={st.winBtnRow}>
            <View style={st.winBtn}><Text style={st.winBtnText}>İptal</Text></View>
          </View>
        </View>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: target.paper, opacity: finale }]} />
    </View>
  );
}

/* ---------------- 2010'lar: düz, açık, akıllı telefon ---------------- */
function FlatMode({ shown, p, to, target, finale }: ModeProps) {
  const dots = Math.floor(p * 12) % 4;
  return (
    <View style={[StyleSheet.absoluteFill, st.center, { backgroundColor: '#F3F4F6' }]}>
      <View style={st.flatCard}>
        <View style={st.flatBar}><View style={[st.flatFill, { width: `${Math.round(p * 100)}%` }]} /></View>
        <Text style={st.flatYear}>{shown}</Text>
        <Text style={st.flatText}>Yükleniyor{'.'.repeat(dots)}</Text>
        <Text style={st.flatSub}>{to.day} {AYLAR[to.month - 1]} {to.year}</Text>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: target.paper, opacity: finale }]} />
    </View>
  );
}

/* ---------------- 2020'ler: modern ---------------- */
function ModernMode({ shown, to, target, finale, progress, last }: ModeProps) {
  const lines = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);
  const bg = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['#05070A', '#05070A', last ? target.paper : '#05070A'] });
  const color = progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: ['#FFB000', '#FFB000', last ? target.accent : '#FFB000'] });
  const scale = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.9, 1.05, 1] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.center, { backgroundColor: bg }]}>
      {lines.map((i) => <View key={i} style={[st.line, { top: (i / lines.length) * H }]} />)}
      <Text style={st.kicker}>ZAMAN YOLCULUĞU</Text>
      <Animated.Text style={[st.modYear, { color, transform: [{ scale }] }]}>{shown}</Animated.Text>
      <Text style={st.modDate}>{to.day} {AYLAR[to.month - 1]} {to.year}</Text>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: finale }]} />
    </Animated.View>
  );
}

const MONO = 'Courier';
const st = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // TV
  rollBar: { position: 'absolute', left: 0, right: 0, height: 60, backgroundColor: 'rgba(255,255,255,0.12)' },
  tvOsd: { position: 'absolute', top: 70, right: 28 },
  tvKanal: { color: '#7CFF7C', fontFamily: MONO, fontSize: 26, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  tvYear: { color: '#fff', fontFamily: 'Oswald_700Bold', fontSize: 120, letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 12 },
  tvDate: { color: '#fff', fontFamily: 'Oswald_500Medium', fontSize: 20, textShadowColor: '#000', textShadowRadius: 6 },
  // VHS
  vhsOsdTop: { position: 'absolute', top: 80, left: 28, color: '#fff', fontFamily: MONO, fontSize: 24, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 },
  vhsYear: { color: '#fff', fontFamily: MONO, fontSize: 96, fontWeight: '700', textShadowColor: '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 1 },
  vhsOsd: { color: '#fff', fontFamily: MONO, fontSize: 22, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 },
  vhsCorner: { position: 'absolute', bottom: 70, right: 28, color: '#fff', fontFamily: MONO, fontSize: 22, fontWeight: '700' },
  // Modem penceresi
  win: { width: Math.min(W - 40, 340), backgroundColor: '#ECE9D8', borderWidth: 2, borderColor: '#0A246A', borderRadius: 8, overflow: 'hidden' },
  winTitle: { backgroundColor: '#0A246A', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  winTitleText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  winX: { width: 18, height: 18, borderRadius: 3, backgroundColor: '#D8432B', alignItems: 'center', justifyContent: 'center' },
  winYear: { fontFamily: 'Nunito_900Black', fontSize: 54, color: '#0A246A', letterSpacing: -1 },
  winText: { fontSize: 14, color: '#222' },
  bar: { flexDirection: 'row', gap: 2, height: 20, borderWidth: 1, borderColor: '#7F9DB9', backgroundColor: '#fff', padding: 2, marginTop: 10 },
  block: { width: 12, backgroundColor: '#2BB42B' },
  winBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  winBtn: { borderWidth: 1, borderColor: '#003C74', borderRadius: 3, paddingHorizontal: 18, paddingVertical: 4, backgroundColor: '#F4F3EE' },
  winBtnText: { fontSize: 13, color: '#000' },
  // 2010'lar
  flatCard: { width: Math.min(W - 60, 320), backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  flatBar: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  flatFill: { height: 4, backgroundColor: '#2F5BFF' },
  flatYear: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 72, color: '#16181C', letterSpacing: -3, marginTop: 14 },
  flatText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#2F5BFF', width: 110, textAlign: 'center' },
  flatSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B7280', marginTop: 6 },
  era: { position: 'absolute', bottom: 46, alignSelf: 'center', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  // Modern
  line: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  kicker: { color: '#7D8590', letterSpacing: 4, fontWeight: '800', fontSize: 12, marginBottom: 12 },
  modYear: { fontSize: 104, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -2 },
  modDate: { color: '#7D8590', fontSize: 16, fontWeight: '600', marginTop: 8 },
});
