import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AYLAR, ARSIV_BASI, GUNLER, gazeteUrl, isoOf, weekdayOf } from './src/data';
import { EraTheme, themeForYear } from './src/theme';
import { useEraFonts } from './src/fonts';
import { useTodayAcrossYears } from './src/timeline';
import { RadioDial } from './src/components/RadioDial';
import { Raflar } from './src/components/Raflar';
import { DayPaper } from './src/components/DayPaper';
import { DatePicker, YMD, clamp, MAX } from './src/components/DatePicker';
import { TimeMachine, type PageMemory } from './src/components/TimeMachine';
import { ERA_GLOW, Post, YearDivider } from './src/components/Post';
import { Gunlerim } from './src/components/Gunlerim';
import { Anilar } from './src/components/Anilar';
import { useStored } from './src/storage';
import { GAZETE_TARAMA } from './src/ayarlar';
import { OnemliGun, hatirlatmalariKur, useBildirimeDokununca } from './src/gunler';
import { StoryViewer } from './src/components/StoryViewer';
import { GlassTabBar } from './src/components/GlassTabBar';
import { Bas, C, ERA_LIGHT, F } from './src/ui';
import { Blur, Canvas, Circle } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type Tab = 'bugun' | 'kadran' | 'gunlerim' | 'raflar';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'bugun', label: 'Bugün', icon: '◉' },
  { key: 'kadran', label: 'Kadran', icon: '◷' },
  { key: 'gunlerim', label: 'Günlerim', icon: '✦' },
  { key: 'raflar', label: 'Raflar', icon: '▤' },
];
const AMBER = '#FFB000';
const BG = C.bg;

/** "14 Kasım'ı", "5 Temmuz'u", "3 Eylül'ü" */
const AY_EKI = ['’ı', '’ı', '’ı', '’ı', '’ı', '’ı', '’u', '’u', '’ü', '’i', '’ı', '’ı'];

export default function App() {
  const fontsReady = useEraFonts();
  const { width, height } = useWindowDimensions();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const thisYear = today.getFullYear();

  const { years, moments: hamMoments, songs, error } = useTodayAcrossYears(month, day, thisYear);
  // aynı sanatçı / dizi / film birkaç yılda tekrar etmesin (yeniden eskiye ilk görülen kalır)
  const moments = useMemo(() => {
    const gor = new Set<string>();
    const out: typeof hamMoments = {};
    for (const y of [...Object.keys(hamMoments)].map(Number).sort((a, b) => b - a)) {
      const l = hamMoments[y];
      out[y] = l ? l.filter((m) => {
        if (m.kind !== 'Radyoda' && m.kind !== 'Ekranda' && m.kind !== 'Sinemada') return true;
        const k = `${m.kind}:${(m.kind === 'Radyoda' ? m.sub ?? m.text : m.text).toLocaleLowerCase('tr-TR')}`;
        if (gor.has(k)) return false;
        gor.add(k); return true;
      }) : l;
    }
    return out;
  }, [hamMoments]);
  const [tab, setTabRaw] = useState<Tab>('bugun');
  // açılan sekmeler bir kez kurulur, sonra gizlenip gösterilir: sekme değiştirmek anında olur
  const [kurulu, setKurulu] = useState<Tab[]>(['bugun']);
  const setTab = (t: Tab) => {
    if (t !== 'bugun') setDurdur((n) => n + 1); // ana sayfadan çıkınca radyo susar
    if (!kurulu.includes(t)) setKurulu((k) => [...k, t]);
    setTabRaw(t);
  };
  const sekme = (t: Tab) => [{ flex: 1 }, tab !== t && { display: 'none' as const }];
  // akış parça parça: önce 8 yıl, aşağı indikçe 8'er yıl daha
  const [gorunur, setGorunur] = useState(8);
  const [dayOpen, setDayOpen] = useState(false);
  const [pick, setPick] = useState<YMD>(clamp({ year: 1999, month, day }));
  const [traveling, setTraveling] = useState(false);
  const [story, setStory] = useState<YMD | null>(null);
  const [kaydir, setKaydir] = useState(true); // radyo çevrilirken ana sayfa kaymaz
  const [calan, setCalan] = useState<{ title: string; artist: string; image?: string | null; year: number } | null>(null);
  const [durdur, setDurdur] = useState(0);
  const [asagida, setAsagida] = useState(false);
  const [akis, setAkis] = useState<'haber' | 'ani'>('haber'); // Bugün tarihte: haberler ya da anılar
  const homeScroll = useRef<any>(null);
  const [birthday, setBirthday] = useStored<YMD | null>('dogumgunu', null);
  const [saved, setSaved] = useStored<YMD[]>('kaydedilenler', []);
  const [onemli, setOnemli, onemliHazir] = useStored<OnemliGun[]>('onemliGunler', []);
  const [hatirlatma, setHatirlatma, hatHazir] = useStored<boolean>('hatirlatma', false);

  // ışınlanma animasyonu sürerken o günün gazetesini arka planda indirmeye başla
  useEffect(() => {
    if (!traveling) return;
    const iso = isoOf(pick.year, pick.month, pick.day);
    if (GAZETE_TARAMA) {
      Image.prefetch(gazeteUrl(iso, 1, true)).catch(() => {});
      Image.prefetch(gazeteUrl(iso)).catch(() => {});
    }
  }, [traveling]);

  useEffect(() => { if (onemliHazir && hatHazir) hatirlatmalariKur(hatirlatma, birthday, onemli); }, [onemliHazir, hatHazir, hatirlatma, JSON.stringify(birthday), JSON.stringify(onemli)]);
  useBildirimeDokununca((iso) => { const [y, m, d] = iso.split('-').map(Number); setTab('bugun'); setPick(clamp({ year: y, month: m, day: d })); setTraveling(true); });

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const travelTo = (v: YMD) => { setPick(clamp(v)); setTraveling(true); };
  const pages: PageMemory[] = years.flatMap((y) => (moments[y] ?? []).slice(0, 1).map((m) => ({ year: y, text: m.text, image: m.image ?? (moments[y] ?? []).find((x) => x.image)?.image })));
  const t = themeForYear(pick.year);
  const sameDay = (a: YMD, b: YMD) => a.year === b.year && a.month === b.month && a.day === b.day;
  const isSaved = saved.some((x) => sameDay(x, pick));
  const toggleSave = () => setSaved(isSaved ? saved.filter((x) => !sameDay(x, pick)) : [pick, ...saved]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      <View style={sekme('bugun')}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <ScrollView ref={homeScroll} contentContainerStyle={{ paddingBottom: 130 }} scrollEnabled={kaydir} scrollEventThrottle={100}
            onContentSizeChange={(_, h) => { if (h < height * 2.5 && gorunur < years.length) setGorunur((g) => g + 8); }}
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              const a = contentOffset.y > 560; if (a !== asagida) setAsagida(a);
              if (contentOffset.y + layoutMeasurement.height > contentSize.height - 1600 && gorunur < years.length) setGorunur((g) => g + 8);
            }}>
            {/* dönem ışığı */}
            <Canvas style={{ position: 'absolute', top: -40, left: 0, width, height: 560 }} pointerEvents="none">
              <Circle cx={width * 0.25} cy={180} r={150} color={ERA_LIGHT['2020s'][0]} opacity={0.32}><Blur blur={70} /></Circle>
              <Circle cx={width * 0.85} cy={300} r={140} color={ERA_LIGHT['90s'][1]} opacity={0.28}><Blur blur={80} /></Circle>
            </Canvas>
            <View style={h.top}>
              <Text style={h.brand}>Kadran</Text>
              <Text style={h.topMeta}>{GUNLER[today.getDay()]}</Text>
            </View>
            <View style={h.hero}>
              <Text style={h.lead}>{years.length} yılın {day} {AYLAR[month - 1]}{AY_EKI[month - 1]}</Text>
              <Text style={h.leadSub}>Radyoyu çevir, o yıl bugün ne çalıyordu dinle.</Text>
            </View>
            {years.length > 0 && <RadioDial years={years.filter((y) => y >= ARSIV_BASI)} songs={songs} moments={moments} onTravel={(y) => travelTo({ year: y, month, day })} onTouching={(on) => setKaydir(!on)} onNowPlaying={setCalan} stopSignal={durdur} />}
            <Text style={[h.section, { fontSize: 26, marginTop: 30, marginBottom: 10 }]}>Yıl yıl hikâyeler</Text>

            {/* yıl yıl hikâye halkaları */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingVertical: 6 }}>
              {years.filter((y) => y < thisYear && y >= ARSIV_BASI && (moments[y]?.length ?? 0) > 0).map((y) => {
                const [a1, a2] = ERA_LIGHT[themeForYear(y).key];
                const img = (moments[y] ?? []).find((m) => m.image)?.image;
                return (
                  <Bas key={y} onPress={() => setStory({ year: y, month, day })} style={{ alignItems: 'center', gap: 6 }}>
                    <LinearGradient colors={[a1, a2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={h.ring}>
                      <View style={h.ringIn}>
                        <Text style={[h.ringYear, { color: a1 }]}>{String(y).slice(2)}</Text>
                        {img && <RingImg uri={img} />}
                      </View>
                    </LinearGradient>
                    <Text style={h.ringLabel}>{y}</Text>
                  </Bas>
                );
              })}
            </ScrollView>

            {error && (
              <View style={{ backgroundColor: '#2A1214', borderRadius: 18, padding: 16, margin: 14 }}>
                <Text style={{ fontFamily: F.b, color: '#FFB4B4', fontSize: 16 }}>Bazı günlere ulaşılamadı</Text>
                <Text style={{ fontFamily: F.r, color: '#F2C9C9', fontSize: 13, marginTop: 4 }}>{error}</Text>
              </View>
            )}

            <View style={h.bolumSatir}>
              <Text style={[h.section, { marginTop: 0, paddingHorizontal: 0, flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>Bugün tarihte</Text>
              <View style={h.secici}>
                {([['haber', 'Haberler'], ['ani', 'Anılar']] as const).map(([k, ad]) => (
                  <Pressable key={k} onPress={() => setAkis(k)} hitSlop={6} style={[h.secim, akis === k && h.secimAktif]}>
                    <Text style={[h.secimText, akis === k && { color: '#111' }]}>{ad}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {akis === 'ani' && <Anilar month={month} day={day} thisYear={thisYear} onTravel={(y, m, d) => travelTo({ year: y, month: m, day: d })} />}
            {akis === 'haber' && years.slice(0, gorunur).map((y) => {
              const list = moments[y];
              if (!(y in moments)) {
                return <View key={y} style={h.skeleton}><ActivityIndicator color={C.faint} /><Text style={h.skelText}>{y}</Text></View>;
              }
              if (!list || !list.length) return null;
              return (
                <View key={y}>
                  <YearDivider year={y} ago={thisYear - y} />
                  {list.map((m, i) => (
                    <Post key={`${y}-${i}`} moment={m} month={month} day={day} ago={thisYear - y}
                      onTravel={() => travelTo({ year: y, month, day })} />
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>

      {kurulu.includes('kadran') && (
        <View style={sekme('kadran')}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>
            <Text style={c.title}>Hangi güne gidelim?</Text>
            {/* hedef kartı: seçilen dönemin ışığıyla */}
            <View style={c.card}>
              <LinearGradient colors={[ERA_LIGHT[t.key][1], C.card]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={c.cardKicker}>{t.label.toLocaleUpperCase('tr-TR')}</Text>
                <Text style={c.cardKicker}>{thisYear - pick.year} YIL ÖNCE</Text>
              </View>
              <Text style={[c.cardYear, { color: ERA_LIGHT[t.key][0] }]}>{pick.year}</Text>
              <Text style={c.cardDate}>{pick.day} {AYLAR[pick.month - 1]}, {weekdayOf(isoOf(pick.year, pick.month, pick.day))}</Text>
            </View>
            {/* düğme kartın hemen altında: alttaki gün ızgarasının üstüne binmez */}
            <Bas style={[c.go, { backgroundColor: ERA_GLOW[t.key], marginTop: 12 }]} onPress={() => setTraveling(true)}>
              <Text style={c.goText}>{thisYear - pick.year} yıl geriye ışınlan</Text>
            </Bas>
            {/* hızlı geçişler */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
              {birthday && (
                <Pressable onPress={() => setPick(birthday)} style={[c.chip, { borderColor: AMBER }]}>
                  <Text style={[c.chipText, { color: AMBER }]}>★ Doğduğum gün</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setPick(clamp({ year: 1950 + Math.floor(Math.random() * (MAX.y - 1950)), month: 1 + Math.floor(Math.random() * 12), day: 1 + Math.floor(Math.random() * 28) }))} style={c.chip}>
                <Text style={c.chipText}>🎲 Rastgele gün</Text>
              </Pressable>
              {[1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((d) => {
                const et = themeForYear(d);
                const renk = d < 1980 ? '#D9B98A' : ERA_GLOW[et.key];
                return (
                  <Pressable key={d} onPress={() => setPick(clamp({ year: d + 5, month: pick.month, day: pick.day }))} style={[c.chip, { borderColor: renk + '88' }]}>
                    <Text style={[c.chipText, { color: renk }]}>{d < 1980 ? ({ 1950: "50'ler", 1960: "60'lar", 1970: "70'ler" } as Record<number, string>)[d] : et.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <DatePicker value={pick} onChange={setPick} accent={ERA_GLOW[t.key]} />
          </ScrollView>
        </SafeAreaView>
        </View>
      )}

      {kurulu.includes('gunlerim') && (
        <View style={sekme('gunlerim')}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <Gunlerim
            birthday={birthday}
            setBirthday={setBirthday}
            saved={saved}
            removeSaved={(v) => setSaved(saved.filter((x) => !sameDay(x, v)))}
            onTravel={travelTo}
            today={{ year: thisYear, month, day }}
            onemli={onemli}
            setOnemli={setOnemli}
            hatirlatma={hatirlatma}
            setHatirlatma={setHatirlatma}
          />
        </SafeAreaView>
        </View>
      )}

      {kurulu.includes('raflar') && (
        <View style={sekme('raflar')}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <Raflar month={month} day={day} onTravel={(y, m, d) => travelTo({ year: y, month: m, day: d })} />
        </SafeAreaView>
        </View>
      )}

      {/* şimdi çalıyor: radyo gözden kaybolunca altta kalır */}
      {tab === 'bugun' && calan && asagida && !dayOpen && !story && !traveling && (
        <View style={h.miniWrap} pointerEvents="box-none">
          <Pressable style={h.mini} onPress={() => homeScroll.current?.scrollTo({ y: 0, animated: true })}>
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24,25,30,0.6)' }]} />
            {calan.image ? <Image source={{ uri: calan.image }} style={h.miniCover} /> : <View style={[h.miniCover, { alignItems: 'center', justifyContent: 'center', backgroundColor: ERA_LIGHT[themeForYear(calan.year).key][1] }]}><Text>📻</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={h.miniTitle} numberOfLines={1}>{calan.title.replace(/\s*\((?:albüm|album|single|şarkı)[^)]*\)/i, '')}</Text>
              <Text style={h.miniSub} numberOfLines={1}>{calan.artist} · {calan.year}</Text>
            </View>
            <Pressable onPress={() => setDurdur((n) => n + 1)} hitSlop={12} style={h.miniBtn}><Text style={{ color: C.text, fontSize: 16 }}>■</Text></Pressable>
          </Pressable>
        </View>
      )}

      {/* alt menü: yüzen buzlu cam */}
      {!dayOpen && !story && (
        <GlassTabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />
      )}

      {dayOpen && (
        <View style={StyleSheet.absoluteFill}>
          <DayScreen t={t} pick={pick} thisYear={thisYear} saved={isSaved} onSave={toggleSave} onStory={() => setStory(pick)}
            onClose={() => setDayOpen(false)} onPicker={() => { setDayOpen(false); setTab('kadran'); }} />
        </View>
      )}

      {story && (
        <StoryViewer year={story.year} month={story.month} day={story.day} thisYear={thisYear}
          onClose={() => setStory(null)}
          onOpenPaper={() => { setPick(story); setStory(null); setDayOpen(true); }} />
      )}

      {traveling && (
        <TimeMachine fromYear={thisYear} to={pick} pages={pages} onDone={() => { setDayOpen(true); setTraveling(false); }} />
      )}
    </View>
  );
}

function RingImg({ uri }: { uri: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return null;
  return <Image source={{ uri }} onError={() => setBad(true)} style={{ position: 'absolute', width: '100%', height: '100%' }} />;
}

/* ---------- Gün ekranı: üstte dev yıl, bölüm şeridi, altında o günün gazetesi ---------- */

const CHAPTERS = ['Kapak', 'Gündem', 'Cüzdan', 'Ekran & Ses', 'Saha', 'İnsanlar'];

function DayScreen({ t, pick, thisYear, saved, onSave, onClose, onPicker, onStory }: {
  t: EraTheme; pick: YMD; thisYear: number; saved: boolean; onSave: () => void; onClose: () => void; onPicker: () => void; onStory: () => void;
}) {
  const { width: W } = useWindowDimensions();
  const scroll = useRef<any>(null);
  const [pos, setPos] = useState<Record<string, number>>({});
  const [paperY, setPaperY] = useState(0);
  const [active, setActive] = useState('Kapak');
  const present = CHAPTERS.filter((c) => c in pos);
  const go = (c: string) => scroll.current?.scrollTo({ y: Math.max(0, paperY + pos[c] - 64), animated: true });
  const [c1, c2] = ERA_LIGHT[t.key];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y + 150;
          let cur = present[0] ?? 'Kapak';
          for (const c of present) if (paperY + pos[c] <= y) cur = c;
          if (cur !== active) setActive(cur);
        }}
        contentContainerStyle={{ paddingBottom: 80 }}>
        {/* kapak */}
        <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 }}>
          <Canvas style={{ position: 'absolute', top: -60, left: 0, width: W, height: 420 }} pointerEvents="none">
            <Circle cx={W * 0.2} cy={120} r={150} color={c2} opacity={0.7}><Blur blur={80} /></Circle>
            <Circle cx={W * 0.9} cy={220} r={120} color={c1} opacity={0.3}><Blur blur={90} /></Circle>
          </Canvas>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Bas onPress={onClose} style={d.glassBtn}><Text style={d.glassText}>‹  Geri</Text></Bas>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Bas onPress={onSave} style={d.glassBtn}><Text style={[d.glassText, saved && { color: c1 }]}>{saved ? '★' : '☆'}</Text></Bas>
              <Bas onPress={onPicker} style={d.glassBtn}><Text style={d.glassText}>Başka gün</Text></Bas>
            </View>
          </View>
          <Text style={d.kicker}>{thisYear - pick.year} YIL ÖNCE · {t.label.toLocaleUpperCase('tr-TR')}</Text>
          <Text style={[d.year, { color: c1 }]}>{pick.year}</Text>
          <Text style={d.date}>{pick.day} {AYLAR[pick.month - 1]}, {weekdayOf(isoOf(pick.year, pick.month, pick.day))}</Text>
          <Bas onPress={onStory} style={[d.storyBtn, { backgroundColor: c1 }]}><Text style={d.storyText}>▶  Hikâyeyi izle</Text></Bas>
        </View>

        {/* bölüm şeridi (yukarıda sabit kalır) */}
        <View style={{ backgroundColor: C.bg + 'F2', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
            {(present.length ? present : CHAPTERS.slice(0, 1)).map((c) => {
              const on = c === active;
              return (
                <Pressable key={c} onPress={() => go(c)} style={[d.chip, on && { backgroundColor: C.text }]}>
                  <Text style={[d.chipText, on && { color: C.bg }]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 16 }} onLayout={(e) => setPaperY(e.nativeEvent.layout.y + 16)}>
          <DayPaper year={pick.year} month={pick.month} day={pick.day}
            onChapter={(name, y) => setPos((p) => (p[name] === y ? p : { ...p, [name]: y }))} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const d = StyleSheet.create({
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  glassText: { fontFamily: F.sb, color: C.text, fontSize: 14 },
  kicker: { fontFamily: F.b, color: C.sub, fontSize: 11, letterSpacing: 2, marginTop: 34 },
  year: { fontFamily: F.serif, fontSize: 128, lineHeight: 134, letterSpacing: -3, marginTop: 2 },
  date: { fontFamily: F.b, color: C.text, fontSize: 22, letterSpacing: -0.4 },
  storyBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 18 },
  storyText: { fontFamily: F.b, color: '#111', fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipText: { fontFamily: F.sb, color: C.sub, fontSize: 14 },
});

const h = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, paddingTop: 10 },
  brand: { fontFamily: F.serif, color: C.text, fontSize: 30, letterSpacing: -0.5 },
  topMeta: { fontFamily: F.m, color: C.faint, fontSize: 14 },
  hero: { alignItems: 'center', paddingTop: 22, paddingBottom: 14, paddingHorizontal: 20 },
  lead: { fontFamily: F.serif, color: C.text, fontSize: 44, lineHeight: 48, textAlign: 'center', letterSpacing: -0.6 },
  leadSub: { fontFamily: F.r, color: C.sub, fontSize: 16, marginTop: 6 },
  ring: { width: 78, height: 78, borderRadius: 39, padding: 3 },
  ringIn: { flex: 1, borderRadius: 36, backgroundColor: C.bg, borderWidth: 3, borderColor: C.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ringYear: { fontFamily: F.serif, fontSize: 30 },
  ringLabel: { fontFamily: F.sb, color: C.sub, fontSize: 12 },
  section: { fontFamily: F.serif, color: C.text, fontSize: 34, paddingHorizontal: 22, marginTop: 30 },
  bolumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 22, marginTop: 30, marginBottom: 6 },
  secici: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: 3 },
  secim: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  secimAktif: { backgroundColor: AMBER },
  secimText: { fontFamily: F.b, color: C.sub, fontSize: 13 },
  miniWrap: { position: 'absolute', left: 0, right: 0, bottom: 102, alignItems: 'center' },
  mini: { width: '88%', maxWidth: 420, height: 58, borderRadius: 20, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  miniCover: { width: 42, height: 42, borderRadius: 10 },
  miniTitle: { fontFamily: F.b, color: C.text, fontSize: 15 },
  miniSub: { fontFamily: F.m, color: C.sub, fontSize: 12, marginTop: 1 },
  miniBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  skeleton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, marginHorizontal: 14 },
  skelText: { fontFamily: F.r, color: C.faint, fontSize: 13 },
});

const c = StyleSheet.create({
  title: { fontFamily: F.serif, color: C.text, fontSize: 36, marginTop: 6 },
  card: { borderRadius: 26, padding: 20, marginTop: 14, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  cardKicker: { fontFamily: F.b, color: C.sub, fontSize: 11, letterSpacing: 2 },
  cardYear: { fontFamily: F.serif, fontSize: 104, lineHeight: 110, letterSpacing: -3, marginTop: 4 },
  cardDate: { fontFamily: F.b, color: C.text, fontSize: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 100, paddingHorizontal: 18, paddingTop: 10 },
  chip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  chipText: { fontFamily: F.sb, color: C.text, fontSize: 14 },
  soon: { backgroundColor: 'rgba(255,176,0,0.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  soonText: { fontFamily: F.b, color: AMBER, fontSize: 13 },
  game: { backgroundColor: C.card, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, padding: 18, marginTop: 22 },
  gameKicker: { fontFamily: F.sb, color: C.faint, fontSize: 13 },
  clue: { backgroundColor: C.card2, borderRadius: 18, padding: 16, marginTop: 10 },
  clueLabel: { fontFamily: F.b, color: AMBER, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  clueText: { fontFamily: F.serif, color: C.text, fontSize: 24, lineHeight: 28 },
  guess: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  guessText: { fontFamily: F.serif, color: C.text, fontSize: 28 },
  go: { borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  goText: { fontFamily: F.b, color: '#111', fontSize: 17 },
});
