import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Group, Image as SkImage, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { AYLAR } from '../data';
import { themeForYear } from '../theme';
import { TUNNEL_SKSL } from '../fx/tunnel.sksl';

const EFFECT = Skia.RuntimeEffect.Make(TUNNEL_SKSL);
const SES_TUNEL = require('../../assets/fx/tunel.wav');
const SES_VARIS = require('../../assets/fx/varis.wav');

export interface Memory { year: number; uri: string }

/** Yıl → sürekli dönem değeri (shader için): 2024=0, 2014=1, 2004=2, 1994=3, 1984=4 */
const eraOf = (y: number) => Math.max(0, Math.min(4.3, (2024 - y) / 10));
const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Zaman Tüneli: ekran kartında çizilen hiper-uzay tüneli.
 * Bugünden hedef yıla akar; renk ve doku dönemden döneme kayar (shader içinde),
 * o yılların görselleri yanından uçup geçer, sayaç hızla renk ayrışmasına uğrar,
 * varışta ışık patlaması ve derin bir "bum".
 */
export function TimeTunnel({ fromYear, to, memories, onDone }: {
  fromYear: number; to: { year: number; month: number; day: number }; memories: Memory[]; onDone: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const time = useSharedValue(0);
  const speed = useSharedValue(0);
  const era = useSharedValue(eraOf(fromYear));
  const flash = useSharedValue(0);
  const yearF = useSharedValue(fromYear);
  const [shown, setShown] = useState(fromYear);
  const [spd, setSpd] = useState(0);
  const lastYear = useRef(fromYear);

  const span = Math.abs(fromYear - to.year);
  const total = 1700 + Math.min(span, 46) * 75; // en uzak yolculuk ~5 sn

  const uniforms = useDerivedValue(() => ({
    res: [W, H], t: time.value, speed: speed.value, era: era.value, flash: flash.value,
  }));

  const mems = useMemo(() => {
    const lo = Math.min(fromYear, to.year), hi = Math.max(fromYear, to.year);
    const seen = new Set<number>();
    return memories.filter((m) => m.year > lo && m.year <= hi && !seen.has(m.year) && seen.add(m.year)).slice(0, 14);
  }, []);

  useEffect(() => {
    let tunel: ReturnType<typeof createAudioPlayer> | null = null;
    let varis: ReturnType<typeof createAudioPlayer> | null = null;
    try { tunel = createAudioPlayer(SES_TUNEL); tunel.volume = 0.7; tunel.play(); } catch { /* sessiz */ }
    try { varis = createAudioPlayer(SES_VARIS); varis.volume = 0.9; } catch { /* sessiz */ }

    const start = Date.now();
    let raf = 0, done = false, lastEra = Math.floor(eraOf(fromYear) + 0.5);
    const tick = () => {
      const el = Date.now() - start;
      const P = Math.min(1, el / total);
      time.value = el / 1000;
      const sp = smooth(0, 0.18, P) * (1 - 0.92 * smooth(0.7, 1, P));
      speed.value = sp;
      const yf = fromYear + (to.year - fromYear) * easeInOut(P);
      yearF.value = yf;
      era.value = eraOf(yf);
      const y = Math.round(yf);
      if (y !== lastYear.current) {
        lastYear.current = y;
        setShown(y);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const e = Math.floor(eraOf(yf) + 0.5);
      if (e !== lastEra) { lastEra = e; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }
      setSpd(sp);

      if (P >= 1) {
        const fe = el - total;
        if (!done) {
          done = true;
          try { tunel?.pause(); varis?.play(); } catch { /* */ }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        flash.value = Math.min(1, fe / 260);
        if (fe > 320) { onDone(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setTimeout(() => { try { tunel?.remove(); varis?.remove(); } catch { /* */ } }, 2500);
    };
  }, []);

  const tgt = themeForYear(to.year);
  const ab = 1 + spd * 7; // kromatik sapma (px)
  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>{EFFECT && <Shader source={EFFECT} uniforms={uniforms} />}</Fill>
        {mems.map((m, i) => (
          <FlyingMemory key={m.year} m={m} i={i} yearF={yearF} W={W} H={H} />
        ))}
      </Canvas>

      <View style={st.center} pointerEvents="none">
        <View>
          <Text style={[st.year, st.abs, { color: 'rgba(255,40,80,0.75)', transform: [{ translateX: -ab }] }]}>{shown}</Text>
          <Text style={[st.year, st.abs, { color: 'rgba(40,180,255,0.75)', transform: [{ translateX: ab }] }]}>{shown}</Text>
          <Text style={[st.year, { color: '#FFFFFF' }]}>{shown}</Text>
        </View>
        <Text style={st.era}>{themeForYear(shown).label}</Text>
      </View>
      <View style={st.bottom} pointerEvents="none">
        <Text style={st.dest}>{to.day} {AYLAR[to.month - 1]} {to.year}</Text>
        <Text style={[st.destSub, { color: tgt.accent }]}>{Math.abs(fromYear - to.year)} yıl geriye</Text>
      </View>
    </View>
  );
}

/** Bir anı görseli: kendi yılına yaklaşıldığında merkezden çıkıp ekranın kenarına uçar. */
function FlyingMemory({ m, i, yearF, W, H }: { m: Memory; i: number; yearF: SharedValue<number>; W: number; H: number }) {
  const img = useImage(m.uri);
  const angle = (i * 137.5 * Math.PI) / 180;
  const size = 120;
  const transform = useDerivedValue(() => {
    const k = Math.min(1, Math.max(0, (m.year + 1.6 - yearF.value) / 2.2)); // merkezde belirir, dışarı uçar
    const dist = 30 + k * k * Math.max(W, H) * 0.75;
    const sc = 0.15 + k * k * 1.6;
    return [
      { translateX: W / 2 + Math.cos(angle) * dist },
      { translateY: H / 2 + Math.sin(angle) * dist },
      { scale: sc },
      { translateX: -size / 2 },
      { translateY: -size / 2 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const k = (m.year + 1.6 - yearF.value) / 2.2;
    return k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.9;
  });
  if (!img) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <SkImage image={img} x={0} y={0} width={size} height={size} fit="cover" />
    </Group>
  );
}

const st = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute', left: 0, top: 0 },
  year: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 112, letterSpacing: -5, textAlign: 'center' },
  era: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 2 },
  bottom: { position: 'absolute', bottom: 70, left: 0, right: 0, alignItems: 'center' },
  dest: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  destSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, marginTop: 4 },
});
