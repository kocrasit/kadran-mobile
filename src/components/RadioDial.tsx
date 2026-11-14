import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { themeForYear } from '../theme';
import { Bas, C, ERA_LIGHT, F } from '../ui';
import type { Moment, Song } from '../timeline';

const SES_ARAMA = require('../../assets/fx/radyo_arama.wav');
const SP = 26;            // skalada bir yıl = 26 px
const AMBER = '#FFB547';

/** 1996'ya, 1983'e, 2000'e, 1990'a */
export function yilaEki(y: number): string {
  const birler = ['', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'];
  const onlar = ['', 'a', 'ye', 'a', 'a', 'ye', 'a', 'e', 'e', 'a'];
  const e = y % 10 ? birler[y % 10] : y % 100 ? onlar[(y % 100) / 10] : 'e';
  return `${y}'${e}`;
}

/**
 * Radyo frekans düğmesi: skalada frekans yerine yıllar.
 * Skalayı ya da düğmeyi çevir → cızırtı; bir yıla oturunca o yıl bugün çalan şarkı belirir.
 */
export function RadioDial({ years, songs, moments, onTravel, onTouching, onNowPlaying, stopSignal }: {
  years: number[]; songs: Record<number, Song>; moments: Record<number, Moment[] | null>; onTravel: (y: number) => void;
  onTouching?: (on: boolean) => void;
  /** Şimdi çalan şarkıyı dışarı bildirir (alttaki mini çubuk için) */
  onNowPlaying?: (s: (Song & { year: number }) | null) => void;
  /** Değiştikçe radyo susar (mini çubuktaki durdur düğmesi) */
  stopSignal?: number;
}) {
  const [oynat, setOynat] = useState<{ y: number; i: number } | null>(null); // hangi yılın kaçıncı adayı çalıyor (i=-1: hiçbiri çalınamadı)
  const acik = useRef(false); // radyo bir kez açıldıysa her yeni yılda kendiliğinden çalar
  const [winW, setWinW] = useState(340);
  const lo = Math.min(...years), hi = Math.max(...years.filter((y) => y < new Date().getFullYear()), lo);
  const yearF = useSharedValue(lo);
  const [shown, setShown] = useState(hi);
  const [arar, setArar] = useState(false);
  const start = useRef(hi);
  const last = useRef(hi);
  const ses = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    try { ses.current = createAudioPlayer(SES_ARAMA); ses.current.volume = 0.22; ses.current.loop = true; } catch { /* sessiz */ }
    // açılışta ibre 1980'den son yıla doğru bir tarar
    yearF.value = withTiming(hi, { duration: 1600, easing: Easing.out(Easing.cubic) });
    return () => { try { ses.current?.remove(); } catch { /* */ } };
  }, [hi]);

  const songsRef = useRef(songs);
  songsRef.current = songs;
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  const pan = useMemo(() => PanResponder.create({
    // radyonun camına/düğmesine değdiği an dokunuş radyonundur; sayfa kaymaz
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      onTouching?.(true);
      setOynat(null);
      start.current = Math.round(yearF.value);
      setArar(true);
      try { ses.current?.seekTo(Math.random() * 4); ses.current?.play(); } catch { /* */ }
    },
    onPanResponderMove: (_, g) => {
      const v = clamp(start.current - g.dx / SP);
      yearF.value = v;
      const y = Math.round(v);
      if (y !== last.current) { last.current = y; setShown(y); Haptics.selectionAsync().catch(() => {}); }
    },
    onPanResponderRelease: () => {
      const y = Math.round(yearF.value);
      yearF.value = withSpring(y, { damping: 16, stiffness: 180 });
      setShown(y); setArar(false);
      if (acik.current) setTimeout(() => setOynat(songsRef.current[y]?.adaylar?.length ? { y, i: 0 } : null), 350);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setTimeout(() => { try { ses.current?.pause(); } catch { /* */ } }, 180);
      onTouching?.(false);
    },
    onPanResponderTerminate: () => { setArar(false); onTouching?.(false); try { ses.current?.pause(); } catch { /* */ } },
  }), [lo, hi]);

  const scale = useAnimatedStyle(() => ({ transform: [{ translateX: winW / 2 - (yearF.value - lo) * SP }] }));
  const knob = useAnimatedStyle(() => ({ transform: [{ rotate: `${(yearF.value - lo) * 18}deg` }] }));

  const t = themeForYear(shown);
  const [c1] = ERA_LIGHT[t.key];
  const adaylar = songs[shown]?.adaylar ?? [];
  const caliyor = !arar && oynat && oynat.y === shown && oynat.i >= 0 ? adaylar[oynat.i] : null;
  const calinamadi = !arar && oynat && oynat.y === shown && oynat.i < 0;
  const song = caliyor ?? songs[shown];
  useEffect(() => { onNowPlaying?.(caliyor ? { ...caliyor, year: shown } : null); }, [caliyor?.yt, shown]);
  const ilkSinyal = useRef(stopSignal);
  useEffect(() => { if (stopSignal !== ilkSinyal.current) { acik.current = false; setOynat(null); } }, [stopSignal]);
  const yedek = (moments[shown] ?? [])[0];
  const ticks = [];
  for (let y = lo; y <= hi; y++) ticks.push(y);

  return (
    <View style={st.wrap}>
      {/* skala camı */}
      <View style={st.panel}>
        <View style={st.panelTop}>
          <Text style={st.brand}>KADRAN FM</Text>
          <Text style={st.band}>YIL · {lo}–{hi}</Text>
        </View>
        <View style={st.glass} onLayout={(e) => setWinW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
          <LinearGradient colors={['#150C02', '#3E2708', '#150C02']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <Animated.View style={[st.scale, scale]}>
            {ticks.map((y) => {
              const major = y % 5 === 0;
              return (
                <View key={y} style={[st.tickBox, { left: (y - lo) * SP - SP / 2 }]}>
                  <Text style={[st.tickLabel, { opacity: major ? 1 : 0.45, fontSize: major ? 13 : 10 }]}>{major ? y : String(y).slice(2)}</Text>
                  <View style={[st.tick, { height: major ? 22 : 12, opacity: major ? 1 : 0.6 }]} />
                  <View style={[st.tickHalf, { left: SP / 2 + SP / 2 - 0.5 }]} />
                </View>
              );
            })}
          </Animated.View>
          {/* kenar gölgeleri ve ibre */}
          <LinearGradient colors={['#0B0703', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.fade, { left: 0 }]} />
          <LinearGradient colors={['transparent', '#0B0703']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.fade, { right: 0 }]} />
          <View style={[st.needle, { left: winW / 2 - 1 }]} />
          <View style={st.glare} />
        </View>
      </View>

      {/* şimdi çalıyor */}
      <View style={st.now}>
        {arar ? (
          <>
            <Text style={[st.kicker, { color: c1 }]}>{shown} · ARANIYOR</Text>
            <Text style={[st.title, { opacity: 0.5 }]}>· · · · · ·</Text>
            <Text style={st.artist}> </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {song?.image ? <Kapak uri={song.image} c1={c1} /> : <View style={[st.cover, { backgroundColor: c1 + '33', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 24 }}>📻</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={[st.kicker, { color: c1 }]}>{shown} · {caliyor ? 'ŞİMDİ ÇALIYOR' : song ? 'BUGÜN RADYODA' : 'O GÜN'}</Text>
              <Text style={st.title} numberOfLines={2}>{song ? song.title.replace(/\s*\((?:albüm|album|single|şarkı)[^)]*\)/i, '') : yedek?.text ?? 'Bu frekansta yayın yok'}</Text>
              <Text style={st.artist} numberOfLines={1}>{song ? song.artist : ' '}</Text>
            </View>
            {adaylar.length > 0 && !caliyor && (
              <Bas onPress={() => { acik.current = true; setOynat({ y: shown, i: 0 }); }} style={[st.play, { backgroundColor: c1 }]}><Text style={st.playText}>▶</Text></Bas>
            )}
          </View>
        )}
        {calinamadi && (
          <Pressable onPress={() => songs[shown]?.yt && Linking.openURL(`https://www.youtube.com/watch?v=${songs[shown].yt}`)} style={st.nope}>
            <Text style={st.nopeText}>Bu yılın şarkıları uygulama içinde çalınamıyor (sahibi izin vermemiş). YouTube'da dinle ↗</Text>
          </Pressable>
        )}
        {caliyor?.yt && oynat && (
          <View style={st.player}>
            <WebView
              key={`${oynat.y}-${oynat.i}`}
              style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              onMessage={(e) => {
                if (!e.nativeEvent.data.startsWith('err')) return;
                // çalınamadı → sıradaki şarkı
                setOynat((o) => (o && o.y === shown ? { y: o.y, i: o.i + 1 < adaylar.length ? o.i + 1 : -1 } : o));
              }}
              source={{ baseUrl: 'https://kadran.app', html: oynatici(caliyor.yt) }}
            />
            <View style={st.playerBar}>
              <Pressable onPress={() => { acik.current = false; setOynat(null); }} hitSlop={10}><Text style={st.playerBtn}>■  Radyoyu kapat</Text></Pressable>
              {adaylar.length > 1 && <Pressable onPress={() => setOynat((o) => (o ? { y: o.y, i: (o.i + 1) % adaylar.length } : o))} hitSlop={10}><Text style={st.playerBtn}>Sıradaki ›</Text></Pressable>}
              <Pressable onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${caliyor.yt}`)} hitSlop={10}><Text style={st.playerBtn}>YouTube ↗</Text></Pressable>
            </View>
          </View>
        )}
      </View>

      {/* düğme + ışınlan */}
      <View style={st.controls}>
        <Animated.View style={[st.knob, knob]} {...pan.panHandlers}>
          <LinearGradient colors={['#3A3D44', '#16171B']} style={[StyleSheet.absoluteFill, { borderRadius: 48 }]} />
          {Array.from({ length: 24 }, (_, k) => (
            <View key={k} style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: `${k * 15}deg` }] }]}>
              <View style={{ width: 2, height: 9, marginTop: 3, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>
          ))}
          <View style={st.knobCap}><View style={st.knobDot} /></View>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Bas onPress={() => onTravel(shown)} style={[st.go, { backgroundColor: c1 }]} disabled={arar}>
            <Text style={st.goText}>{yilaEki(shown)} ışınlan</Text>
            <Text style={st.goSub}>{new Date().getFullYear() - shown} yıl önce · {t.label}</Text>
          </Bas>
        </View>
      </View>
      <Text style={st.hint}>Skalayı ya da düğmeyi çevir</Text>
    </View>
  );
}

/** YouTube'un resmi oynatıcısı; video gömülmeye kapalıysa hata kodunu uygulamaya bildirir. */
export function oynatici(id: string, start = 0) {
  return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}#p{width:100%;height:100%}</style></head>
<body><div id="p"></div><script src="https://www.youtube.com/iframe_api"></script><script>
function onYouTubeIframeAPIReady(){ new YT.Player('p',{ width:'100%', height:'100%', videoId:'${id}', host:'https://www.youtube-nocookie.com',
  playerVars:{ autoplay:1, playsinline:1, rel:0, modestbranding:1, start:${start} },
  events:{ onReady:function(e){ e.target.playVideo(); },
           onError:function(e){ window.ReactNativeWebView.postMessage('err:'+e.data); },
           onStateChange:function(e){ if(e.data===1) window.ReactNativeWebView.postMessage('ok'); } } }); }
</script></body></html>`;
}

function Kapak({ uri, c1 }: { uri: string; c1: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <View style={[st.cover, { backgroundColor: c1 + '33', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 24 }}>📻</Text></View>;
  return <Image source={{ uri }} style={st.cover} onError={() => setBad(true)} />;
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  panel: { backgroundColor: '#121316', borderRadius: 26, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 8 },
  brand: { fontFamily: F.xb, color: C.sub, fontSize: 11, letterSpacing: 3 },
  band: { fontFamily: F.b, color: C.faint, fontSize: 11, letterSpacing: 1.5 },
  glass: { height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1A0F03' },
  glow: { position: 'absolute', left: '15%', right: '15%', top: 10, bottom: 10, borderRadius: 60, backgroundColor: 'rgba(255,170,60,0.10)' },
  scale: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 0 },
  tickBox: { position: 'absolute', top: 14, width: SP, alignItems: 'center' },
  tickLabel: { fontFamily: F.b, color: AMBER, marginBottom: 6, textShadowColor: 'rgba(255,170,60,0.7)', textShadowRadius: 6 },
  tick: { width: 1.5, backgroundColor: AMBER },
  tickHalf: { position: 'absolute', top: 34, width: 1, height: 7, backgroundColor: 'rgba(255,181,71,0.35)' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 60 },
  needle: { position: 'absolute', top: 6, bottom: 6, width: 2, borderRadius: 1, backgroundColor: '#FF3B30', shadowColor: '#FF3B30', shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 },
  glare: { position: 'absolute', left: 0, right: 0, top: 0, height: 34, backgroundColor: 'rgba(255,255,255,0.04)' },
  now: { minHeight: 96, justifyContent: 'center', paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  kicker: { fontFamily: F.b, fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  title: { fontFamily: F.serif, color: C.text, fontSize: 30, lineHeight: 33 },
  artist: { fontFamily: F.m, color: C.sub, fontSize: 15, marginTop: 2 },
  cover: { width: 68, height: 68, borderRadius: 12 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#111', fontSize: 18, marginLeft: 3 },
  player: { marginTop: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  playerBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#101114' },
  playerBtn: { fontFamily: F.sb, color: C.text, fontSize: 13 },
  nope: { marginTop: 12, backgroundColor: C.card2, borderRadius: 14, padding: 12 },
  nopeText: { fontFamily: F.m, color: C.sub, fontSize: 13, lineHeight: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  knob: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  knobCap: { position: 'absolute', left: 22, top: 22, width: 52, height: 52, borderRadius: 26, backgroundColor: '#24262B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  knobDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER, marginTop: 6 },
  go: { borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18 },
  goText: { fontFamily: F.b, color: '#111', fontSize: 18 },
  goSub: { fontFamily: F.m, color: 'rgba(17,17,17,0.7)', fontSize: 13, marginTop: 2 },
  hint: { fontFamily: F.m, color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
