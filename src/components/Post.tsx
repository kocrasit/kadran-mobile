import { memo, useState } from 'react';
import { Image, Linking, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AYLAR } from '../data';
import { Moment } from '../timeline';
import { EraTheme, themeForYear } from '../theme';
import { C, ERA_LIGHT, F } from '../ui';
import { Afis, Forma, MuzikNesnesi, Televizyon } from './EraArt';
import { KadranGazetesi } from './KadranGazetesi';

/**
 * Akış gönderisi: Twitter düzeninde — solda hesap simgesi, sağda ad, zaman, metin, medya ve eylemler.
 * Hesaplar Kadran'ın kendi bölümleridir (Kadran Manşet, Kadran Radyo…). Gerçek bir gazete ya da kişi
 * adına konuşmaz; bilginin kaynağı gönderinin altında "Kaynak: …" diye yazılır. Sahte beğeni sayısı yoktur.
 */

/** Dönemin parlak rengi (eski çağrılar için) */
export const ERA_GLOW: Record<EraTheme['key'], string> = {
  '80s': ERA_LIGHT['80s'][0], '90s': ERA_LIGHT['90s'][0], '2000s': ERA_LIGHT['2000s'][0], '2010s': ERA_LIGHT['2010s'][0], '2020s': ERA_LIGHT['2020s'][0],
};

const HESAP: Record<Moment['kind'], { ad: string; kul: string; ikon: string }> = {
  'Gazete': { ad: 'Kadran Gazete', kul: 'kadrangazete', ikon: '🗞' },
  'Manşet': { ad: 'Kadran Manşet', kul: 'kadranmanset', ikon: '📰' },
  'Gündem': { ad: 'Kadran Gündem', kul: 'kadrangundem', ikon: '📌' },
  'Dünya': { ad: 'Kadran Dünya', kul: 'kadrandunya', ikon: '🌍' },
  'Deprem': { ad: 'Kadran Deprem', kul: 'kadrandeprem', ikon: '⚠️' },
  'Spor': { ad: 'Kadran Saha', kul: 'kadransaha', ikon: '⚽' },
  'Cüzdan': { ad: 'Kadran Piyasa', kul: 'kadranpiyasa', ikon: '💰' },
  'Radyoda': { ad: 'Kadran Radyo', kul: 'kadranradyo', ikon: '📻' },
  'Ekranda': { ad: 'Kadran Ekran', kul: 'kadranekran', ikon: '📺' },
  'Sinemada': { ad: 'Kadran Sinema', kul: 'kadransinema', ikon: '🎬' },
  'Vefat': { ad: 'Kadran Anma', kul: 'kadrananma', ikon: '🕯' },
  'Doğdu': { ad: 'Kadran', kul: 'kadran', ikon: '🎂' },
};

/** Gönderinin ana metni: bir insanın yazacağı gibi kısa bir cümle */
function metin(m: Moment): string {
  if (m.yillik && m.kind === 'Radyoda') return `O yıl plakçı vitrinlerinde: “${m.text}”${m.sub ? ` · ${m.sub}` : ''}`;
  if (m.yillik && m.kind === 'Sinemada') return `O yıl beyazperdede: ${m.text}${m.sub ? ` · yönetmen ${m.sub}` : ''}`;
  switch (m.kind) {
    case 'Radyoda': return `Radyoda şu an: “${m.text}”${m.sub ? ` · ${m.sub}` : ''}`;
    case 'Ekranda': return `Bu akşam ekranlarda: ${m.text}${m.sub && m.sub !== '—' ? ` (${m.sub.replace('Türkiye Radyo Televizyon Kurumu', 'TRT')})` : ''}`;
    case 'Sinemada': return `Vizyonda: ${m.text}${m.sub ? ` · yönetmen ${m.sub}` : ''}`;
    case 'Spor': {
      // o güne en yakın maç ileride oynanmışsa "bitti" demeyiz
      const ileri = m.sub?.match(/ · (\d+) gün sonra$/);
      const geri = m.sub?.match(/ · (\d+) gün önce$/);
      const ne = m.sub?.replace(/ · \d+ gün (sonra|önce)$/, '');
      if (ileri) return `${ileri[1] === '1' ? 'Ertesi gün' : `${ileri[1]} gün sonra`} oynanacak maç. ${ne}`;
      if (geri) return `${geri[1] === '1' ? 'Dün' : `${geri[1]} gün önce`} oynanan maç. ${ne}`;
      return m.sub && m.sub !== 'Maç sonucu' ? `Maç bitti. ${m.sub}` : 'Maç bitti.';
    }
    case 'Vefat': return `Bugün aramızdan ayrıldı: ${m.text}`;
    case 'Cüzdan': return 'O gün cebimizdeki para böyleydi:';
    case 'Deprem': {
      // "6,1 büyüklüğünde deprem" + "Sındırgı · 7 km güneydoğusu · saat 22:48"
      const [yer, ...kalan] = (m.sub ?? '').split(' · ');
      const saat = kalan.find((x) => x.startsWith('saat'));
      return `${yer ? `${yer} merkezli ` : ''}${m.text}${saat ? `, ${saat}` : ''}.`;
    }
    default: return m.text;
  }
}

export const Post = memo(PostIc, (a, b) => a.moment === b.moment && a.ago === b.ago && a.anilarim === b.anilarim && a.month === b.month && a.day === b.day);
function PostIc({ moment, month, day, ago, onTravel, anilarim = 0, onAniYaz }: {
  moment: Moment; month: number; day: number; ago: number; onTravel: () => void; last?: boolean;
  anilarim?: number; onAniYaz?: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [gizli, setGizli] = useState(false);
  const t = themeForYear(moment.year);
  const [c1, c2] = ERA_LIGHT[t.key];
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const h = HESAP[moment.kind];

  const like = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!liked) heart.value = withSequence(withSpring(1.45, { damping: 6, stiffness: 500 }), withSpring(1, { damping: 10 }));
    setLiked((v) => !v);
  };
  const share = () => Share.share({ message: `${day} ${AYLAR[month - 1]} ${moment.year}\n${metin(moment)}\n\nKadran ile zamanda yolculuk ⏳` }).catch(() => {});
  if (gizli) return null; // gazete görseli inmediyse gönderi hiç görünmez

  return (
    <Pressable onPress={onTravel} style={({ pressed }) => [st.post, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
      <View style={[st.avatar, { backgroundColor: c2 }]}><Text style={st.avatarIkon}>{h.ikon}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={st.ust}>
          <Text style={st.ad} numberOfLines={1}>{h.ad}</Text>
          <Text style={[st.zaman, { marginLeft: 6 }]} numberOfLines={1}>@kadran · {day} {AYLAR[month - 1].slice(0, 3)} {moment.year}</Text>
        </View>
        {moment.kind === 'Gündem' && moment.liste ? <Gundem m={moment} c1={c1} /> : (
          <>
            <Text style={[st.metin, !!moment.sub && (moment.kind === 'Manşet' || moment.kind === 'Dünya' || moment.kind === 'Gündem') && st.mansetMetin]}>{metin(moment)}</Text>
            {!!moment.sub && (moment.kind === 'Manşet' || moment.kind === 'Dünya' || moment.kind === 'Gündem') && <Text style={st.ozet} numberOfLines={5}>{moment.sub}</Text>}
            {!!moment.baglam && (
              <View style={st.baglam}>
                <Text style={st.baglamBas}>{moment.kind === 'Vefat' ? 'KİMDİ?' : 'NE OLDU?'}</Text>
                <Text style={st.baglamYazi} numberOfLines={5}>{moment.baglam}</Text>
              </View>
            )}
          </>
        )}
        <Medya m={moment} t={t} c1={c1} c2={c2} ay={month} gun={day} onGazeteYok={() => setGizli(true)} />
        {!!moment.kaynak && <Text style={st.kaynak}>{moment.kind === 'Gazete' ? 'Başlıklar' : 'Kaynak'}: {moment.kaynak}</Text>}
        <View style={st.eylemler}>
          {onAniYaz && (
            <Pressable onPress={onAniYaz} hitSlop={8} style={st.eylem}>
              <Text style={st.eylemIkon}>✎</Text>
              <Text style={st.eylemText}>{anilarim > 0 ? anilarim : 'Anın'}</Text>
            </Pressable>
          )}
          <Pressable onPress={onTravel} hitSlop={8} style={st.eylem}>
            <Text style={st.eylemIkon}>◷</Text>
            <Text style={st.eylemText}>O güne git</Text>
          </Pressable>
          <Pressable onPress={like} hitSlop={8} style={st.eylem}>
            <Animated.Text style={[st.eylemIkon, liked && { color: C.like }, heartStyle]}>{liked ? '♥' : '♡'}</Animated.Text>
          </Pressable>
          <Pressable onPress={share} hitSlop={8} style={st.eylem}><Text style={st.eylemIkon}>↗</Text></Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function Gundem({ m, c1 }: { m: Moment; c1: string }) {
  const [ilk, ...diger] = m.liste ?? [];
  return (
    <View>
      <Text style={st.metin}>{ilk?.t}</Text>
      {diger.length > 0 && (
        <View style={st.alinti}>
          {diger.map((x, i) => (
            <View key={i} style={[i > 0 && st.alintiAyrac]}>
              <Text style={[st.etiket, { color: x.tr ? c1 : C.faint }]}>{x.etiket}</Text>
              <Text style={st.alintiText}>{x.t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Medya({ m, t, c1, c2, ay, gun, onGazeteYok }: { m: Moment; t: EraTheme; c1: string; c2: string; ay: number; gun: number; onGazeteYok: () => void }) {
  const [bad, setBad] = useState(false);

  if (m.kind === 'Gazete' && m.gazete) return <GazeteMedya m={m} c1={c1} ay={ay} gun={gun} />;
  if (m.kind === 'Gazete') {
    // ön sayfanın üst yarısı (manşet), kâğıt rengi zeminde
    return (
      <View style={[st.medya, { aspectRatio: 1.25, backgroundColor: '#EFE7D6' }]}>
        <Image source={{ uri: m.image! }} style={{ width: '100%', height: '210%' }} resizeMode="cover" onError={onGazeteYok} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)']} style={[StyleSheet.absoluteFill, { top: '60%' }]} />
      </View>
    );
  }
  if ((m.kind === 'Manşet' || m.kind === 'Dünya' || m.kind === 'Gündem') && m.image && !bad) {
    return (
      <View style={[st.medya, { aspectRatio: 16 / 10 }]}>
        <Image source={{ uri: m.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setBad(true)} />
      </View>
    );
  }
  if (m.kind === 'Deprem' && false) {
    const mag = m.text.split(' ')[0];
    return (
      <LinearGradient colors={['#5A1410', '#1A0A08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.medya, st.kutuIc]}>
        <Text style={{ fontFamily: F.serif, color: '#FF8A70', fontSize: 64, lineHeight: 66 }}>{mag}</Text>
        <Text style={st.kutuAlt}>büyüklüğünde</Text>
      </LinearGradient>
    );
  }
  if (m.kind === 'Spor') {
    const mm = m.text.match(/^(.+?)\s+(\d+)\s*[–-]\s*(\d+)\s+(.+)$/);
    if (!mm) return <View style={[st.medya, st.kutuIc]}><Text style={st.skorAd}>{m.text}</Text></View>;
    return (
      <View style={[st.medya, { padding: 14, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
        {[[mm[1], mm[2]], [mm[4], mm[3]]].map(([ad, g], k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 }}>
            <Forma ad={ad} size={20} />
            <Text style={[st.skorAd, { flex: 1 }]} numberOfLines={1}>{ad}</Text>
            <Text style={[st.skor, { color: Number(g) >= Number(k ? mm[2] : mm[3]) ? C.text : C.faint }]}>{g}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (m.kind === 'Cüzdan') {
    const c = m.cuzdan ?? [];
    return (
      <LinearGradient colors={[c2 + '55', 'rgba(255,255,255,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.medya, { padding: 14 }]}>
        <View style={{ flexDirection: 'row' }}>
          {c.slice(0, 2).map((x, i) => (
            <View key={i} style={[{ flex: 1 }, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingLeft: 12 }]}>
              <Text style={st.kutuAlt}>{x.label}</Text>
              <Text style={st.para} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
              {x.kat && x.kat > 1.2 && x.kat < 1e5 ? <Text style={[st.kat, { color: c1 }]}>2026'da {x.kat.toLocaleString('tr-TR', { maximumFractionDigits: x.kat < 10 ? 1 : 0 })} kat</Text> : null}
            </View>
          ))}
        </View>
        {c.slice(2).map((x, i) => (
          <Text key={i} style={[st.kutuAlt, { marginTop: i ? 4 : 10 }]}>{x.label}: <Text style={{ color: C.text }}>{x.value}</Text>
            {x.kat && x.kat > 1.2 && x.kat < 1e5 ? <Text style={{ color: c1 }}>  · 2026'da {x.kat.toLocaleString('tr-TR', { maximumFractionDigits: x.kat < 10 ? 1 : 0 })} kat</Text> : null}</Text>
        ))}
        {m.sub && <Text style={[st.kutuAlt, { fontSize: 12, marginTop: 6, color: C.faint }]}>{m.sub}</Text>}
      </LinearGradient>
    );
  }
  // gerçek görsel yoksa çizilmiş (sahte) kapak, televizyon ya da afiş göstermeyiz
  if ((m.kind === 'Radyoda' || m.kind === 'Ekranda' || m.kind === 'Sinemada') && m.image && !bad) {
    return (
      <LinearGradient colors={[c2 + 'AA', 'rgba(255,255,255,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={[st.medya, st.sahne]}>
        {m.kind === 'Radyoda' && <MuzikNesnesi t={t} uri={m.image} title={m.text} artist={m.sub ?? m.text} size={130} />}
        {m.kind === 'Ekranda' && <Televizyon t={t} uri={m.image} program={m.text} channel={m.sub} width={210} />}
        {m.kind === 'Sinemada' && <Afis t={t} uri={m.image} title={m.text} width={110} />}
      </LinearGradient>
    );
  }
  return null;
}

/** Yayın sürümü: arşiv taraması yerine kendi gazetemiz; altında gazetenin kendi arşivine bağlantı */
function GazeteMedya({ m, c1, ay, gun }: { m: Moment; c1: string; ay: number; gun: number }) {
  const { width } = useWindowDimensions();
  const g = Math.min(width, 520) - 16 * 2 - 42 - 12;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={[st.medya, { marginTop: 0 }]}>
        <KadranGazetesi year={m.year} month={ay} day={gun} icerik={{ manset: m.gazete!.basliklar[0], basliklar: m.gazete!.basliklar }} genislik={g} />
      </View>
      {m.gazete!.link && (
        <Pressable onPress={() => Linking.openURL(m.gazete!.link!).catch(() => {})} hitSlop={6} style={{ marginTop: 8 }}>
          <Text style={[st.kaynak, { color: c1, marginTop: 0 }]}>{m.sub ?? 'Gazete'} gazetesinin o günkü ön sayfası, kendi arşivinde ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Akışta yıl ayracı */
export function YearDivider({ year, ago }: { year: number; ago: number }) {
  const t = themeForYear(year);
  const eski = year < 1980;
  const c1 = eski ? '#D9B98A' : ERA_LIGHT[t.key][0];
  const etiket = eski ? ({ 1950: "50'ler", 1960: "60'lar", 1970: "70'ler" } as Record<number, string>)[Math.floor(year / 10) * 10] : t.label;
  return (
    <View style={st.divider}>
      <Text style={[st.divYear, { color: c1 }]}>{year}</Text>
      <Text style={st.divMeta}>{ago} yıl önce · {etiket}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  post: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarIkon: { fontSize: 20 },
  ust: { flexDirection: 'row', alignItems: 'baseline' },
  ad: { fontFamily: F.b, color: C.text, fontSize: 16, flexShrink: 0 },
  zaman: { fontFamily: F.r, color: C.faint, fontSize: 15, flexShrink: 1 },
  metin: { fontFamily: F.r, color: C.text, fontSize: 17, lineHeight: 24, marginTop: 3 },
  mansetMetin: { fontFamily: F.sb, fontSize: 17, lineHeight: 24 },
  ozet: { fontFamily: F.r, color: C.sub, fontSize: 15, lineHeight: 21, marginTop: 6 },
  baglam: { marginTop: 8, borderLeftWidth: 2, borderColor: C.stroke, paddingLeft: 10 },
  baglamBas: { fontFamily: F.b, color: C.faint, fontSize: 10.5, letterSpacing: 1.2 },
  baglamYazi: { fontFamily: F.r, color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 2 },
  kaynak: { fontFamily: F.r, color: C.faint, fontSize: 12, marginTop: 8 },
  medya: { marginTop: 12, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  kutuIc: { padding: 16, alignItems: 'flex-start' },
  kutuAlt: { fontFamily: F.r, color: C.sub, fontSize: 13 },
  sahne: { height: 190, alignItems: 'center', justifyContent: 'center' },
  skorAd: { fontFamily: F.b, color: C.text, fontSize: 16 },
  skor: { fontFamily: F.serif, fontSize: 32, lineHeight: 36 },
  para: { fontFamily: F.serif, color: C.text, fontSize: 30, lineHeight: 36, marginTop: 2 },
  kat: { fontFamily: F.sb, fontSize: 13, marginTop: 2 },
  alinti: { marginTop: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, padding: 12 },
  alintiAyrac: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingTop: 10, marginTop: 10 },
  alintiText: { fontFamily: F.r, color: C.text, fontSize: 14.5, lineHeight: 20, marginTop: 2 },
  etiket: { fontFamily: F.b, fontSize: 10.5, letterSpacing: 1.4 },
  eylemler: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingRight: 24 },
  eylem: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  eylemIkon: { color: C.faint, fontSize: 17 },
  eylemText: { fontFamily: F.r, color: C.faint, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  divYear: { fontFamily: F.b, fontSize: 20 },
  divMeta: { fontFamily: F.r, color: C.faint, fontSize: 14 },
});
