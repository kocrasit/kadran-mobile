import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeInUp, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  gorsel, AYLAR, DayData, Ek, cikmisMi, cleanTitle, dizilerOnAir, enYakinMacGunu, fetchDay, fetchEkForYear, formatGold, formatTL, imageUrl,
  isNewsy, isoOf, looksTurkish, sortSports, weekdayOf, gazeteUrl, iyiOlay, gununOlaylari, ligAdi,
} from '../data';
import { themeForYear } from '../theme';
import { GAZETE_TARAMA } from '../ayarlar';
import { haberleriTopla } from '../haberler';
import { C, ERA_LIGHT, F, Bas } from '../ui';
import { Forma, kanalKisa, sigdir } from './EraArt';
import { Blur, Canvas, Circle } from '@shopify/react-native-skia';

/** Görsel; yüklenemezse yedeği gösterir */
function Gorsel({ uri, style, yedek }: { uri?: string | null; style: any; yedek?: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  if (!uri || bad) return <>{yedek ?? null}</>;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setBad(true)} />;
}

export type Slide =
  | { k: 'kapak' }
  | { k: 'gazete'; iso: string; paper: string; pages: number }
  | { k: 'manset'; title: string; image?: string | null; tr: boolean }
  | { k: 'deprem'; m: number; yer: string; saat: string }
  | { k: 'sarki'; title: string; artist: string; image?: string | null; yt?: string }
  | { k: 'dizi'; program: string; channel?: string; image?: string | null }
  | { k: 'fiyat'; items: { label: string; value: string; kat?: number }[] }
  | { k: 'mac'; home: string; away: string; hs: string; as: string; note: string }
  | { k: 'dogan'; people: { name: string; year?: number | null; image?: string | null }[] }
  | { k: 'son' };

const SON_GUN = '2026-06-25';
const SURE = 5200; // bir kartın ekranda kalma süresi (ms)

/** O günün verisinden hikâye kartlarını çıkar. */
export function buildSlides(d: DayData, ek: Ek | null, son: DayData | null, year: number): Slide[] {
  const out: Slide[] = [{ k: 'kapak' }];
  const nf = d.newspaperFront;
  if (GAZETE_TARAMA && nf && nf.provider !== 'turkiyegazetesi') out.push({ k: 'gazete', iso: d.date, paper: nf.paper ?? 'Milliyet', pages: d.newspaperPages?.count ?? 0 });
  const haberler = haberleriTopla(d, ek);
  const lead = haberler.find((h) => h.scope === 'TR' && h.img) ?? haberler.find((h) => h.scope === 'TR') ?? haberler[0];
  if (lead) out.push({ k: 'manset', title: lead.title, image: lead.img ?? null, tr: lead.scope === 'TR' });
  const dep = ek?.gundem?.deprem[d.date]?.[0];
  if (dep && dep.m >= 5) out.push({ k: 'deprem', m: dep.m, yer: dep.yer, saat: dep.saat });

  const m = d.music?.find((x) => cikmisMi(x.note, d.date));
  if (m) out.push({ k: 'sarki', title: m.title, artist: m.artist, image: imageUrl(m.image, [m.title, m.artist]), yt: m.youtubeId ?? undefined });

  const onAir = dizilerOnAir(ek?.diziler ?? [], d.date)[0];
  const tv = onAir ? { program: onAir[0], channel: onAir[1] ?? undefined, image: undefined } : d.tv?.[0];
  if (tv) out.push({ k: 'dizi', program: tv.program.replace(/\s*—.*$/, ''), channel: tv.channel, image: imageUrl(tv.image, [tv.program]) });

  const e = d.economy ?? {};
  const items: { label: string; value: string; kat?: number }[] = [];
  if (e.usdTry) items.push({ label: 'Dolar', value: formatTL(e.usdTry.value, year), kat: son?.economy?.usdTry ? son.economy.usdTry.value / e.usdTry.value : undefined });
  if (e.goldGram) {
    const yeni = year < 2005 ? e.goldGram.value / 1e6 : e.goldGram.value;
    items.push({ label: 'Gram altın', value: formatGold(e.goldGram.value, year), kat: son?.economy?.goldGram ? son.economy.goldGram.value / yeni : undefined });
  }
  if (items.length) out.push({ k: 'fiyat', items });

  const [, mm, dd] = d.date.split('-').map(Number);
  const yakin = enYakinMacGunu(ek?.maclar ?? null, d.date);
  const lig = yakin?.maclar?.find((x) => /galatasaray|fenerbah|beşiktaş|trabzon/i.test(x[0] + x[1])) ?? yakin?.maclar?.[0];
  const sport = sortSports(d.sports, dd, mm, year).matches[0];
  if (lig && yakin) out.push({ k: 'mac', home: lig[0], away: lig[1], hs: String(lig[2]), as: String(lig[3]), note: yakin.fark === 0 ? `Bugün oynandı · ${ligAdi(d.date)}` : `${Math.abs(yakin.fark)} gün ${yakin.fark > 0 ? 'sonra' : 'önce'} · ${ligAdi(d.date)}` });
  else if (sport) out.push({ k: 'mac', home: sport.home, away: sport.away, hs: sport.hs, as: sport.as, note: sport.detail ?? 'Maç sonucu' });

  const wdp = (ek?.wd?.dogum[d.date.slice(5)] ?? []).slice(0, 3).map((k) => ({ name: k.n, year: Number(k.t.slice(0, 4)), image: gorsel(k.img) }));
  const tr = (d.notableBirths ?? []).filter((p) => /Türk/.test(p.field ?? ''));
  const eski = [...tr, ...(d.notableBirths ?? []).filter((p) => !tr.includes(p))].map((p) => ({ name: p.name, year: p.bornYear, image: imageUrl(p.image, [p.name]) }));
  const people = [...wdp, ...eski].filter((p, i, a) => a.findIndex((x) => x.name === p.name) === i && !((p.year ?? 0) > year)).slice(0, 3);
  if (people.length) out.push({ k: 'dogan', people });

  out.push({ k: 'son' });
  return out;
}

/**
 * Hikâye modu: bir günün en güzel anları tam ekran kartlarla.
 * Sağa dokun → ileri, sola dokun → geri, basılı tut → durdur.
 */
export function StoryViewer({ year, month, day, thisYear, onClose, onOpenPaper }: {
  year: number; month: number; day: number; thisYear: number; onClose: () => void; onOpenPaper: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const iso = isoOf(year, month, day);
  const t = themeForYear(year);
  const [c1, c2] = ERA_LIGHT[t.key];
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [err, setErr] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const prog = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);
  const kalan = useRef(SURE);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchDay(iso), fetchEkForYear(year), fetchDay(SON_GUN).catch(() => null)])
      .then(([d, e, s]) => alive && setSlides(buildSlides(d, e, s, year)))
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [iso]);

  const go = (n: number) => {
    if (!slides) return;
    if (n < 0) n = 0;
    if (n >= slides.length) { onOpenPaper(); return; }
    Haptics.selectionAsync().catch(() => {});
    setI(n);
  };

  // süre çubuğu + otomatik ilerleme
  useEffect(() => {
    if (!slides) return;
    if (timer.current) clearTimeout(timer.current);
    if (paused) { cancelAnimation(prog); return; }
    const last = i === slides.length - 1;
    if (kalan.current === SURE) prog.value = 0;
    if (last) { prog.value = withTiming(1, { duration: 400 }); return; }
    started.current = Date.now();
    prog.value = withTiming(1, { duration: kalan.current, easing: Easing.linear });
    timer.current = setTimeout(() => { kalan.current = SURE; go(i + 1); }, kalan.current);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, slides, paused]);

  useEffect(() => { kalan.current = SURE; }, [i]);

  const pause = () => { kalan.current = Math.max(300, kalan.current - (Date.now() - started.current)); setPaused(true); };
  const resume = () => setPaused(false);

  const barStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));
  const s = slides?.[i];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      {/* dönem ışığı */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={W * 0.15} cy={H * 0.12} r={W * 0.55} color={c2} opacity={0.75}><Blur blur={90} /></Circle>
        <Circle cx={W * 0.95} cy={H * 0.3} r={W * 0.45} color={c1} opacity={0.35}><Blur blur={100} /></Circle>
        <Circle cx={W * 0.3} cy={H * 1.05} r={W * 0.5} color={c2} opacity={0.3}><Blur blur={110} /></Circle>
      </Canvas>

      {!slides && !err && <ActivityIndicator color={c1} style={{ marginTop: H * 0.45 }} />}
      {err && <Text style={[st.sub, { marginTop: H * 0.4, textAlign: 'center' }]}>Bu güne ulaşılamadı.</Text>}

      {slides && s && (
        <>
          {/* dokunma alanları */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
            <Pressable style={{ flex: 1 }} onPress={() => go(i - 1)} onLongPress={pause} onPressOut={() => paused && resume()} delayLongPress={220} />
            <Pressable style={{ flex: 2 }} onPress={() => go(i + 1)} onLongPress={pause} onPressOut={() => paused && resume()} delayLongPress={220} />
          </View>

          <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: 58, paddingHorizontal: 22, paddingBottom: 40 }]}>
            {/* ilerleme çubukları */}
            <View style={{ flexDirection: 'row', gap: 4 }} pointerEvents="none">
              {slides.map((_, k) => (
                <View key={k} style={st.track}>
                  {k < i && <View style={[st.fill, { width: '100%' }]} />}
                  {k === i && <Animated.View style={[st.fill, barStyle]} />}
                </View>
              ))}
            </View>
            <View style={st.top} pointerEvents="box-none">
              <Text style={st.topText}>{day} {AYLAR[month - 1]} {year}</Text>
              <Pressable onPress={onClose} hitSlop={14}><Text style={st.close}>✕</Text></Pressable>
            </View>

            <View style={{ flex: 1, justifyContent: 'center' }} pointerEvents="box-none" key={i}>
              <SlideView s={s} year={year} month={month} day={day} thisYear={thisYear} c1={c1} W={W} onOpenPaper={onOpenPaper} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function SlideView({ s, year, month, day, thisYear, c1, W, onOpenPaper }: {
  s: Slide; year: number; month: number; day: number; thisYear: number; c1: string; W: number; onOpenPaper: () => void;
}) {
  const t = themeForYear(year);
  const iso = isoOf(year, month, day);
  switch (s.k) {
    case 'kapak':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(600)} style={st.kicker}>{thisYear - year} YIL ÖNCE BUGÜN</Animated.Text>
          <Animated.Text entering={ZoomIn.springify().damping(14)} style={[st.giant, { color: c1 }]}>{year}</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(250).duration(600)} style={st.big}>{day} {AYLAR[month - 1]}, {weekdayOf(iso)}</Animated.Text>
          <Animated.Text entering={FadeIn.delay(600).duration(800)} style={[st.sub, { marginTop: 18 }]}>{t.label}. Hazırsan o güne bir bakalım.</Animated.Text>
        </View>
      );
    case 'gazete':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>O SABAH GAZETE BAYİİNDE</Animated.Text>
          <Animated.View entering={ZoomIn.springify().damping(16)} style={st.newspaper}>
            <ActivityIndicator color="#999" style={StyleSheet.absoluteFill} />
            <Gorsel uri={gazeteUrl(s.iso)} style={StyleSheet.absoluteFill} yedek={
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontFamily: F.serif, color: '#333', fontSize: 34 }}>{s.paper}</Text>
              </View>} />
          </Animated.View>
          <Animated.Text entering={FadeInUp.delay(200)} style={[st.big, { marginTop: 18 }]}>{s.paper}</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(300)} style={st.sub}>{s.pages > 1 ? `${s.pages} sayfa · tamamı gazetede` : 'O günün ön sayfası'}</Animated.Text>
        </View>
      );
    case 'deprem':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>O GÜN YER SALLANDI</Animated.Text>
          <Animated.Text entering={ZoomIn.springify().damping(10)} style={[st.giant, { color: '#FF8A70' }]}>{s.m.toLocaleString('tr-TR')}</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(200)} style={st.big}>büyüklüğünde deprem</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(320)} style={[st.sub, { marginTop: 6 }]}>{s.yer} · saat {s.saat}</Animated.Text>
        </View>
      );
    case 'manset': {
      const fs = sigdir(s.title, W - 44, s.title.length > 80 ? 30 : s.title.length > 45 ? 38 : 46, 0.46);
      return (
        <View pointerEvents="none">
          {s.image && <Animated.View entering={FadeIn.duration(500)}><Gorsel uri={s.image} style={st.photo} /></Animated.View>}
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>{s.tr ? 'GÜNÜN MANŞETİ' : 'DÜNYADA BUGÜN'}</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(120).duration(600)} style={[st.headline, { fontSize: fs, lineHeight: fs * 1.08 }]}>“{s.title}”</Animated.Text>
        </View>
      );
    }
    case 'sarki':
      return (
        <View style={{ alignItems: 'center' }} pointerEvents="box-none">
          <Animated.Text entering={FadeInDown.duration(500)} style={[st.kicker, { alignSelf: 'flex-start' }]}>RADYODA BU ÇALIYORDU</Animated.Text>
          <Animated.View entering={ZoomIn.springify().damping(15)}><Plak uri={s.image} size={W * 0.72} c1={c1} /></Animated.View>
          <Animated.Text entering={FadeInUp.delay(200)} style={[st.big, { textAlign: 'center', marginTop: 26 }]}>{s.title}</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(300)} style={[st.sub, { textAlign: 'center' }]}>{s.artist}</Animated.Text>
          {s.yt && (
            <Animated.View entering={FadeIn.delay(500)}>
              <Bas onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${s.yt}`)} style={[st.pill, { backgroundColor: c1 }]}>
                <Text style={st.pillText}>▶  Dinle</Text>
              </Bas>
            </Animated.View>
          )}
        </View>
      );
    case 'dizi':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>BU AKŞAM EKRANDA</Animated.Text>
          <Animated.View entering={ZoomIn.springify().damping(16)} style={[st.tv, { borderColor: c1 + '55' }]}>
            <Gorsel uri={s.image} style={StyleSheet.absoluteFill} yedek={
              <LinearGradient colors={[c1, '#1A1020']} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
                <Text style={{ fontFamily: F.serif, color: '#fff', fontSize: 40, textAlign: 'center' }}>{s.program}</Text>
              </LinearGradient>} />
            <View style={st.scan} />
            {!!kanalKisa(s.channel) && <Text style={st.bug}>{kanalKisa(s.channel)}</Text>}
          </Animated.View>
          <Animated.Text entering={FadeInUp.delay(200)} style={[st.headline, { fontSize: 44, lineHeight: 48, marginTop: 22 }]}>{s.program}</Animated.Text>
          {s.channel && s.channel !== '—' && <Animated.Text entering={FadeInUp.delay(300)} style={st.sub}>{s.channel.replace('Türkiye Radyo Televizyon Kurumu', 'TRT')}</Animated.Text>}
        </View>
      );
    case 'fiyat':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>O GÜN CÜZDANDA</Animated.Text>
          {s.items.map((x, k) => (
            <Animated.View key={k} entering={FadeInUp.delay(150 + k * 220).duration(600)} style={{ marginTop: k ? 30 : 8 }}>
              <Text style={st.sub}>{x.label}</Text>
              <Sayac text={x.value} style={[st.money, { color: k === 0 ? C.text : c1 }]} delay={250 + k * 220} />
              {x.kat && x.kat > 1.2 && <Text style={st.katText}>2026'da <Text style={{ color: c1 }}>{x.kat.toLocaleString('tr-TR', { maximumFractionDigits: x.kat < 10 ? 1 : 0 })} kat</Text> fazlası</Text>}
            </Animated.View>
          ))}
          {year < 2005 && <Animated.Text entering={FadeIn.delay(900)} style={[st.sub, { fontSize: 13, marginTop: 26 }]}>2005'te liradan altı sıfır atıldı; karşılaştırma yeni TL ile.</Animated.Text>}
        </View>
      );
    case 'mac':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>SAHADA</Animated.Text>
          <Animated.View entering={ZoomIn.springify().damping(15)} style={st.board}>
            {[s.home, s.away].map((ad, k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: k ? StyleSheet.hairlineWidth : 0, borderColor: C.stroke }}>
                <Forma ad={ad} size={30} />
                <Text style={[st.big, { flex: 1, fontSize: 26 }]} numberOfLines={1}>{ad}</Text>
                <Text style={[st.score, { color: k === 0 ? (Number(s.hs) >= Number(s.as) ? c1 : C.sub) : (Number(s.as) >= Number(s.hs) ? c1 : C.sub) }]}>{k === 0 ? s.hs : s.as}</Text>
              </View>
            ))}
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(400)} style={[st.sub, { marginTop: 14 }]}>{s.note}</Animated.Text>
        </View>
      );
    case 'dogan':
      return (
        <View pointerEvents="none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>BU GÜN DÜNYAYA GELDİLER</Animated.Text>
          {s.people.map((p, k) => (
            <Animated.View key={k} entering={FadeInUp.delay(120 + k * 160).springify().damping(16)} style={st.person}>
              <Gorsel uri={p.image} style={st.face} yedek={
                <LinearGradient colors={[c1, '#222']} style={[st.face, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontFamily: F.serif, color: '#fff', fontSize: 28 }}>{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</Text>
                </LinearGradient>} />
              <View style={{ flex: 1 }}>
                <Text style={[st.big, { fontSize: 26 }]}>{p.name}</Text>
                {!!p.year && <Text style={st.sub}>{p.year} doğumlu</Text>}
              </View>
            </Animated.View>
          ))}
        </View>
      );
    case 'son':
      return (
        <View pointerEvents="box-none">
          <Animated.Text entering={FadeInDown.duration(500)} style={st.kicker}>HİKÂYENİN SONU</Animated.Text>
          <Animated.Text entering={FadeInUp.delay(100)} style={[st.headline, { fontSize: 50, lineHeight: 54 }]}>O günün tam gazetesi seni bekliyor.</Animated.Text>
          <Animated.View entering={FadeInUp.delay(300)} style={{ gap: 12, marginTop: 30 }}>
            <Bas onPress={onOpenPaper} style={[st.cta, { backgroundColor: c1 }]}><Text style={st.ctaText}>Gazeteyi aç</Text></Bas>
            <Bas onPress={() => Share.share({ message: `${day} ${AYLAR[month - 1]} ${year} — Kadran ile o güne ışınlandım ⏳` }).catch(() => {})} style={[st.cta, st.ctaGhost]}>
              <Text style={[st.ctaText, { color: C.text }]}>Paylaş</Text>
            </Bas>
          </Animated.View>
        </View>
      );
  }
}

/** Dönen plak: kapak fotoğrafı ortadaki etikette */
function Plak({ uri, size, c1 }: { uri?: string | null; size: number; c1: string }) {
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#0B0B0C', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2E' }, a]}>
      {[0.94, 0.84, 0.74, 0.64, 0.56].map((k) => (
        <View key={k} style={{ position: 'absolute', width: size * k, height: size * k, borderRadius: size, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
      ))}
      <View style={{ position: 'absolute', width: size, height: size / 2, top: 0, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: 'rgba(255,255,255,0.035)' }} />
      <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: size, overflow: 'hidden', backgroundColor: c1, alignItems: 'center', justifyContent: 'center' }}>
        <Gorsel uri={uri} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', width: size * 0.05, height: size * 0.05, borderRadius: size, backgroundColor: '#0B0B0C' }} />
      </View>
    </Animated.View>
  );
}

/** Rakamları sayarak açan metin ("93.810 TL" → 0'dan sayar) */
function Sayac({ text, style, delay = 0 }: { text: string; style: any; delay?: number }) {
  const m = text.match(/^([\d.,]+)(.*)$/);
  const hedef = m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN;
  const ondalik = m && m[1].includes(',') ? m[1].split(',')[1].length : 0;
  const [v, setV] = useState(0);
  useEffect(() => {
    if (isNaN(hedef)) return;
    let raf = 0; const start = Date.now() + delay;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / 1100));
      setV(hedef * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (isNaN(hedef)) return <Text style={style}>{text}</Text>;
  return <Text style={style}>{v.toLocaleString('tr-TR', { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik })}{m![2]}</Text>;
}

const st = StyleSheet.create({
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  topText: { fontFamily: F.sb, color: C.text, fontSize: 14, letterSpacing: 0.3 },
  close: { color: C.text, fontSize: 20, fontFamily: F.m },
  kicker: { fontFamily: F.b, color: C.sub, fontSize: 12, letterSpacing: 2.2, marginBottom: 14 },
  giant: { fontFamily: F.serif, fontSize: 150, lineHeight: 156, letterSpacing: -4 },
  big: { fontFamily: F.b, color: C.text, fontSize: 28, lineHeight: 33, letterSpacing: -0.6 },
  sub: { fontFamily: F.r, color: C.sub, fontSize: 17, lineHeight: 24 },
  headline: { fontFamily: F.serif, color: C.text, letterSpacing: -0.5 },
  newspaper: { width: '100%', aspectRatio: 0.78, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E9E4D8', transform: [{ rotate: '-1.5deg' }], shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, marginBottom: 22 },
  pill: { marginTop: 22, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 999 },
  pillText: { fontFamily: F.b, color: '#111', fontSize: 16 },
  tv: { width: '100%', aspectRatio: 4 / 3, borderRadius: 28, overflow: 'hidden', borderWidth: 1, backgroundColor: '#111' },
  scan: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 400, borderBottomRightRadius: 400 },
  bug: { position: 'absolute', right: 14, top: 12, fontFamily: F.xb, color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  money: { fontFamily: F.serif, fontSize: 72, lineHeight: 78, letterSpacing: -1.5 },
  katText: { fontFamily: F.sb, color: C.text, fontSize: 17, marginTop: 2 },
  board: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  score: { fontFamily: F.serif, fontSize: 64, lineHeight: 68 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  face: { width: 72, height: 72, borderRadius: 36 },
  cta: { borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  ctaText: { fontFamily: F.b, color: '#111', fontSize: 17 },
});
