import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { AYLAR } from '../data';
import { EraTheme, themeForYear } from '../theme';

/** Yolculuk müziği: Pixabay telifsiz parça ("Infinite Echo" keman, AudioLibrary), 51,1. saniyeden 15 sn kesit; zirve kesitin 9. saniyesinde */
const SES_MUZIK = require('../../assets/fx/yolculuk_muzik.m4a');
const SES_VARIS = require('../../assets/fx/varis.wav');
const AMBER = '#FFB000';
const STEP = 12; // bir yıl = kadranda 12 derece

export interface PageMemory { year: number; text: string; image?: string | null }

const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
/** Yolculuk profili: kısa hızlanma, sabit hız (her on yıl eşit süre alır), uzun yavaşlama */
const TA = 0.12, TD = 0.28, VMAX = 1 / (1 - TA / 2 - TD / 2);
const travel = (x: number) => {
  if (x <= TA) return (VMAX * x * x) / (2 * TA);
  if (x <= 1 - TD) return VMAX * (TA / 2 + (x - TA));
  const u = 1 - x;
  return 1 - (VMAX * u * u) / (2 * TD);
};

/** Dönem renkleri (kadran halkası, ışık) — yıl ilerledikçe birbirine akar */
const ERA_STOPS = [1984, 1994, 2004, 2014, 2024];
const ERA_COLORS = ['#FF8A2A', '#FF3FA4', '#48E0C8', '#5B8CFF', '#FFB000'];

/**
 * Zaman Makinesi: kadran geriye döner, arkasından o yılların gazeteleri uçar.
 * Varışta ibre hedef yılda durur, kadran büyüyerek kaybolur, gazete açılır.
 */
export function TimeMachine({ fromYear, to, pages, onDone }: {
  fromYear: number; to: { year: number; month: number; day: number }; pages: PageMemory[]; onDone: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const yearF = useSharedValue(fromYear);
  const arrive = useSharedValue(0);
  const [shown, setShown] = useState(fromYear);
  const lastYear = useRef(fromYear);

  const span = Math.abs(fromYear - to.year);
  // 2020'lere 3 sn; geriye her on yıl +0,3 sn (80'lere ~4,2 sn). Dokununca atlanır.
  const decades = Math.max(0, Math.floor(fromYear / 10) - Math.floor(to.year / 10));
  // kısa tutuyoruz: uzun ışınlanma bekletiyordu (eskiden 3 sn + on yıl başına 0,3 sn)
  const total = 1300 + decades * 120;
  const skip = useRef<() => void>(() => {});
  const size = Math.min(W * 0.86, 360);

  // geçilen her yıl için bir gazete kartı (yoksa sade kart)
  const cards = useMemo(() => {
    const byYear = new Map<number, PageMemory>();
    for (const p of pages) if (!byYear.has(p.year)) byYear.set(p.year, p);
    const out: PageMemory[] = [];
    for (let y = fromYear - 1; y >= to.year; y--) out.push(byYear.get(y) ?? { year: y, text: '' });
    return out;
  }, []);

  useEffect(() => {
    type P = ReturnType<typeof createAudioPlayer>;
    let muzik: P | null = null, varis: P | null = null;
    // müzik kesitinde kemanın zirvesi 9. saniyede: varış anına denk gelecek yerden başlat
    const NAKARAT = 9;
    try { muzik = createAudioPlayer(SES_MUZIK); muzik.volume = 1; muzik.seekTo(Math.max(0, NAKARAT - total / 1000)); muzik.play(); } catch { /* sessiz */ }
    try { varis = createAudioPlayer(SES_VARIS); varis.volume = 0.55; } catch { /* sessiz */ }

    const start = Date.now();
    let atla = 0;
    skip.current = () => {
      const el = Date.now() - start + atla;
      if (el < total - 400) { atla += total - 400 - el; try { muzik?.seekTo(NAKARAT - 0.4); } catch { /* */ } }
    };
    let raf = 0, done = false, lastDecade = Math.floor(fromYear / 10);
    const tick = () => {
      const el = Date.now() - start + atla;
      const P = Math.min(1, el / total);
      const yf = fromYear + (to.year - fromYear) * travel(P);
      yearF.value = yf;
      const y = Math.round(yf);
      if (y !== lastYear.current) {
        lastYear.current = y;
        setShown(y);
        Haptics.selectionAsync().catch(() => {});
      }
      const dec = Math.floor(yf / 10);
      if (dec !== lastDecade) { lastDecade = dec; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }

      if (P >= 1) {
        if (!done) {
          done = true;
          try { varis?.play(); } catch { /* */ }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }
        const fe = el - total;
        arrive.value = smooth(180, 620, fe);
        try { if (muzik) muzik.volume = Math.max(0, 1 - fe / 640); } catch { /* */ }
        if (fe > 640) { try { muzik?.pause(); } catch { /* */ } onDone(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setTimeout(() => { try { muzik?.pause(); muzik?.remove(); varis?.remove(); } catch { /* */ } }, 3000);
    };
  }, []);

  const target = themeForYear(to.year);
  const era = themeForYear(shown);

  const glowColors = useDerivedValue(() => {
    const c = interpolateColor(yearF.value, ERA_STOPS, ERA_COLORS);
    return [c, 'rgba(0,0,0,0)'];
  });
  const glowOpacity = useDerivedValue(() => 0.38 + 0.12 * Math.sin(yearF.value * 2.1));
  const dialStyle = useAnimatedStyle(() => ({
    opacity: 1 - arrive.value,
    transform: [{ scale: 1 + arrive.value * 1.6 }],
  }));
  const paperStyle = useAnimatedStyle(() => ({ opacity: arrive.value }));

  return (
    <Pressable onPress={() => skip.current()} style={[StyleSheet.absoluteFill, { backgroundColor: '#050607', overflow: 'hidden' }]}>
      {/* dönem ışığı */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={W / 2} cy={H / 2} r={Math.max(W, H) * 0.62} opacity={glowOpacity}>
          <RadialGradient c={vec(W / 2, H / 2)} r={Math.max(W, H) * 0.62} colors={glowColors} />
        </Circle>
      </Canvas>

      {/* arkadan uçan gazeteler */}
      {cards.map((c, i) => <FlyingPage key={c.year} c={c} i={i} yearF={yearF} W={W} H={H} />)}

      {/* kadran */}
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, dialStyle]} pointerEvents="none">
        <Dial size={size} yearF={yearF} fromYear={fromYear} toYear={to.year} />
        <View style={[st.center, { width: size, height: size }]}>
          <Text style={[st.kicker]}>{to.day} {AYLAR[to.month - 1]}</Text>
          <Text style={[st.year, { fontFamily: era.head, letterSpacing: era.headUpper ? 1 : -4 }]}>{shown}</Text>
          <Text style={[st.eraLabel, { color: era.key === '2020s' ? AMBER : eraColor(era) }]}>{era.label}</Text>
        </View>
      </Animated.View>

      <View style={st.bottom} pointerEvents="none">
        <Text style={st.dest}>{span} yıl geriye</Text>
        <Text style={st.skipHint}>Atlamak için dokun</Text>
      </View>

      {/* varış: dönemin kâğıdı */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: target.paper }, paperStyle]} pointerEvents="none" />
    </Pressable>
  );
}

function eraColor(t: EraTheme) {
  return ({ '80s': '#FF8A2A', '90s': '#FF3FA4', '2000s': '#48E0C8', '2010s': '#5B8CFF', '2020s': AMBER } as const)[t.key];
}

/* ---------------- Kadran: halka geriye döner, ibre sabit ---------------- */

function Dial({ size, yearF, fromYear, toYear }: { size: number; yearF: SharedValue<number>; fromYear: number; toYear: number }) {
  const R = size / 2;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = toYear - 15; y <= fromYear + 15; y++) out.push(y);
    return out;
  }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${-(yearF.value - fromYear) * STEP}deg` }] }));
  const rimColor = useAnimatedStyle(() => ({ borderColor: interpolateColor(yearF.value, ERA_STOPS, ERA_COLORS) }));

  return (
    <View style={{ width: size, height: size }}>
      <View style={[st.face, { width: size, height: size, borderRadius: R }]} />
      <Animated.View style={[st.rim, { width: size, height: size, borderRadius: R }, rimColor]} />
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        {years.map((y) => <Tick key={y} y={y} R={R} fromYear={fromYear} yearF={yearF} />)}
      </Animated.View>
      {/* sabit ibre */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
        <View style={st.needle} />
      </View>
      <View style={[st.inner, { width: size - 96, height: size - 96, borderRadius: (size - 96) / 2, left: 48, top: 48 }]} />
    </View>
  );
}

function Tick({ y, R, fromYear, yearF }: { y: number; R: number; fromYear: number; yearF: SharedValue<number> }) {
  const deg = (y - fromYear) * STEP;
  const major = y % 5 === 0;
  // halkanın yalnızca üst yarısı görünür; ibreye yaklaştıkça parlar
  const vis = useAnimatedStyle(() => {
    const d = Math.abs(y - yearF.value) * STEP;
    return { opacity: interpolate(d, [0, 20, 100, 125], [1, 0.85, 0.2, 0], 'clamp') };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: `${deg}deg` }] }, vis]}>
      <View style={{ marginTop: 10, width: major ? 3 : 1.5, height: major ? 22 : 12, backgroundColor: major ? '#F2F4F7' : '#6B7480', borderRadius: 2 }} />
      {major && <Text style={st.tickLabel}>{y}</Text>}
    </Animated.View>
  );
}

/* ---------------- Arkadan uçan gazete sayfası ---------------- */

function FlyingPage({ c, i, yearF, W, H }: { c: PageMemory; i: number; yearF: SharedValue<number>; W: number; H: number }) {
  const t = themeForYear(c.year);
  const ang = ((i * 137.5) % 360) * (Math.PI / 180);
  const dx = Math.cos(ang), dy = Math.sin(ang) * 1.25;
  const style = useAnimatedStyle(() => {
    const k = (c.year + 2.6 - yearF.value) / 3.8; // kendi yılına 2,6 yıl kala doğar, ~1 yıl sonra kaybolur
    if (k <= 0 || k >= 1) return { opacity: 0, transform: [{ scale: 0.2 }] };
    const dist = Math.pow(k, 1.4) * Math.max(W, H) * 0.6;
    return {
      opacity: Math.min(1, k * 4) * (1 - smoothW(0.75, 1, k)),
      transform: [
        { translateX: dx * dist },
        { translateY: dy * dist },
        { rotate: `${(dx * 14) * k}deg` },
        { scale: 0.4 + k * 1.0 },
      ],
    };
  });
  return (
    <Animated.View style={[st.pageWrap, { left: W / 2 - 95, top: H / 2 - 125 }, style]} pointerEvents="none">
      <View style={[st.page, { backgroundColor: t.paper, borderRadius: Math.min(t.radius, 10) }]}>
        <PageMasthead t={t} />
        <Text style={[st.pageYear, { color: t.key === '80s' || t.key === '90s' ? t.accent : t.ink, fontFamily: t.head }]}>{c.year}</Text>
        {!!c.text && (
          <Text numberOfLines={3} style={[st.pageText, { color: t.ink, fontFamily: t.bodyBold }]}>
            {t.headUpper ? c.text.toLocaleUpperCase('tr-TR') : c.text}
          </Text>
        )}
        {c.image ? <Image source={{ uri: c.image }} style={st.pageImg} /> : <View style={[st.pageImg, { backgroundColor: t.surface }]} />}
      </View>
    </Animated.View>
  );
}

// worklet içinde kullanılabilen smoothstep
function smoothW(a: number, b: number, x: number) {
  'worklet';
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function PageMasthead({ t }: { t: EraTheme }) {
  switch (t.key) {
    case '80s': return <Text style={[st.mh, { fontFamily: t.head, color: t.ink, borderBottomWidth: 2, borderColor: t.ink, letterSpacing: 3 }]}>KADRAN</Text>;
    case '90s': return <View style={{ backgroundColor: t.accent, marginHorizontal: -8, marginTop: -8, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={[st.mh, { fontFamily: t.head, color: '#fff', fontStyle: 'italic', textAlign: 'left' }]}>Kadran</Text></View>;
    case '2000s': return <Text style={[st.mh, { fontFamily: t.head, color: t.accent, textAlign: 'left' }]}>kadran<Text style={{ color: t.accent2 }}>.com.tr</Text></Text>;
    default: return <Text style={[st.mh, { fontFamily: t.head, color: t.ink, textAlign: 'left' }]}>kadran</Text>;
  }
}

const st = StyleSheet.create({
  glow: { position: 'absolute' },
  face: { position: 'absolute', backgroundColor: '#0D0F12' },
  rim: { position: 'absolute', borderWidth: 2 },
  inner: { position: 'absolute', backgroundColor: '#07080A', borderWidth: 1, borderColor: '#1C2027' },
  needle: { marginTop: -6, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: AMBER },
  tickLabel: { marginTop: 4, color: '#C9D1D9', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12 },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: '#8B94A1', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14 },
  year: { color: '#F7F7F7', fontSize: 78, lineHeight: 92 },
  eraLabel: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, letterSpacing: 1 },
  bottom: { position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center' },
  dest: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  skipHint: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.32)', marginTop: 8 },
  pageWrap: { position: 'absolute', width: 190, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  page: { padding: 8, overflow: 'hidden' },
  mh: { fontSize: 15, textAlign: 'center', paddingBottom: 2 },
  pageYear: { fontSize: 26, lineHeight: 30, marginTop: 4 },
  pageText: { fontSize: 12, lineHeight: 15, marginTop: 2 },
  pageImg: { width: '100%', height: 90, marginTop: 6, borderRadius: 4 },
});
