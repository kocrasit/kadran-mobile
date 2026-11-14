import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Haptics from 'expo-haptics';
import { AYLAR, isoOf, weekdayOf } from '../data';
import { themeForYear } from '../theme';
import { Bas, C, ERA_LIGHT, F } from '../ui';
import { Ozet, Sarki, useOzet } from '../gunler';
import { oynatici } from './RadioDial';
import { KadranGazetesi } from './KadranGazetesi';

export type Sablon = 'polaroid' | 'plak' | 'gazete' | 'radyo';
export interface PaylasHedef { year: number; month: number; day: number; baslik: string; ikon: string; foto?: string | null; sablon?: Sablon }
const SABLONLAR: { k: Sablon; ad: string }[] = [{ k: 'polaroid', ad: 'Polaroid' }, { k: 'plak', ad: '🎵 Şarkı' }, { k: 'gazete', ad: 'Gazete' }, { k: 'radyo', ad: 'Radyo' }];
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const W = 300, H = 533; // ekranda; paylaşırken 1080×1920 çekilir

/** Instagram hikâyesi boyutunda (9:16) "o gün" kartı: şablon seç, fotoğraf ekle, paylaş ya da kaydet. */
export function PaylasKart({ hedef, onKapat, onFotoEkle }: {
  hedef: PaylasHedef | null; onKapat: () => void; onFotoEkle?: () => Promise<string | null>;
}) {
  return (
    <Modal visible={!!hedef} animationType="slide" presentationStyle="fullScreen" onRequestClose={onKapat}>
      {hedef && <Icerik hedef={hedef} onKapat={onKapat} onFotoEkle={onFotoEkle} />}
    </Modal>
  );
}

function Icerik({ hedef, onKapat, onFotoEkle }: { hedef: PaylasHedef; onKapat: () => void; onFotoEkle?: () => Promise<string | null> }) {
  const ozHam = useOzet(hedef);
  // kartın şarkısı: kişi seçmediyse o günün ilk şarkısı; null = şarkısız
  const [secilen, setSecilen] = useState<Sarki | null | undefined>(undefined);
  const sarki = secilen === undefined ? ozHam?.sarki ?? null : secilen;
  const oz: Ozet | null | undefined = ozHam === undefined ? undefined : { ...(ozHam ?? {}), sarki: sarki ?? undefined };
  const [dinlenen, setDinlenen] = useState<string | null>(null);
  const [ipucu, setIpucu] = useState<string | null>(null);
  const shot = useRef<any>(null);
  const [foto, setFoto] = useState<string | null>(hedef.foto ?? null);
  const [sablon, setSablon] = useState<Sablon>(hedef.sablon ?? 'polaroid');
  const [mesgul, setMesgul] = useState<'paylas' | 'kaydet' | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const t = themeForYear(hedef.year);
  const renk = ERA_LIGHT[t.key];

  const metin = () => [
    `${hedef.ikon} ${hedef.baslik}: ${hedef.day} ${AYLAR[hedef.month - 1]} ${hedef.year}`,
    kartManseti(oz) && `📰 ${kartManseti(oz)}`,
    oz?.sarki && `🎵 Radyoda: ${oz.sarki.title} · ${oz.sarki.artist}`,
    oz?.dolar && `💵 1 dolar: ${oz.dolar}`,
    'Sen hangi güne ışınlanırdın? ⏳ Kadran',
  ].filter(Boolean).join('\n');

  const cek = async (): Promise<string | null> => {
    if (Platform.OS === 'web' || !shot.current?.capture) return null;
    return shot.current.capture();
  };
  const paylas = async () => {
    setMesgul('paylas');
    setDinlenen(null);
    try {
      // Instagram dışarıdan müzik eklemeye izin vermiyor: şarkının adını kopyalıyoruz, kişi Müzik çıkartmasına yapıştırıyor.
      if (sarki) {
        await Clipboard.setStringAsync(`${sarki.title} ${sarki.artist}`).catch(() => {});
        setIpucu(`“${sarki.title}” kopyalandı`);
        await bekle(1600);
      }
      const uri = await cek();
      if (uri && (await Sharing.isAvailableAsync())) {
        // Expo Go'da paylaşım menüsü açılır: Instagram → Hikâye. Yayın sürümünde doğrudan hikâye ekranı (Facebook App ID ile).
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Instagram hikâyende paylaş', UTI: 'public.png' });
      } else await Share.share({ message: metin() });
    } catch { await Share.share({ message: metin() }).catch(() => {}); } finally { setMesgul(null); setTimeout(() => setIpucu(null), 400); }
  };
  const kaydet = async () => {
    setMesgul('kaydet');
    try {
      const izin = await MediaLibrary.requestPermissionsAsync(true);
      const uri = await cek();
      if (izin.granted && uri) {
        await MediaLibrary.saveToLibraryAsync(uri);
        setKaydedildi(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {} finally { setMesgul(null); }
  };
  const fotoEkle = async () => { const u = await onFotoEkle?.(); if (u) setFoto(u); };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 56, paddingBottom: 40 }}>
        <View style={k.ust}>
          <Pressable onPress={onKapat} hitSlop={12} style={k.kapat}><Text style={{ color: '#fff', fontSize: 16, fontFamily: F.b }}>✕</Text></Pressable>
          <Text style={k.ustBaslik}>Paylaşım kartı</Text>
          <View style={{ width: 36 }} />
        </View>

        <Animated.View key={sablon} entering={ZoomIn.springify().damping(16)}>
          <ViewShot ref={shot} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}>
            {sablon === 'polaroid' && <Polaroid h={hedef} oz={oz} foto={foto} renk={renk} />}
            {sablon === 'plak' && <Plak h={hedef} oz={oz} foto={foto} renk={renk} />}
            {sablon === 'gazete' && <GazeteSablon h={hedef} oz={oz} foto={foto} />}
            {sablon === 'radyo' && <Radyo h={hedef} oz={oz} foto={foto} renk={renk} />}
          </ViewShot>
        </Animated.View>

        <View style={k.sablonlar}>
          {SABLONLAR.map((s) => (
            <Pressable key={s.k} onPress={() => setSablon(s.k)} style={[k.sablon, sablon === s.k && { backgroundColor: '#fff' }]}>
              <Text style={[k.sablonText, sablon === s.k && { color: '#111' }]}>{s.ad}</Text>
            </Pressable>
          ))}
        </View>

        <SarkiSecici oz={ozHam} secili={sarki} onSec={setSecilen}
          dinlenen={dinlenen} onDinle={setDinlenen} />

        <Animated.View entering={FadeIn.delay(200)} style={{ width: W, marginTop: 16, gap: 10 }}>
          <Bas onPress={paylas} style={k.insta}>
            <LinearGradient colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {mesgul === 'paylas' ? <ActivityIndicator color="#fff" /> : <Text style={k.instaText}>Instagram hikâyende paylaş</Text>}
          </Bas>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {onFotoEkle && (
              <Bas onPress={fotoEkle} style={[k.ikinci, { flex: 1 }]}>
                <Text style={k.ikinciText}>{foto ? '📷 Fotoğrafı değiştir' : '📷 Fotoğrafını ekle'}</Text>
              </Bas>
            )}
            <Bas onPress={kaydet} style={[k.ikinci, { flex: 1 }]}>
              {mesgul === 'kaydet' ? <ActivityIndicator color="#fff" /> : <Text style={k.ikinciText}>{kaydedildi ? '✓ Kaydedildi' : '⬇ Galeriye kaydet'}</Text>}
            </Bas>
          </View>
          <Text style={k.not}>{sarki
            ? `Paylaş'a basınca şarkının adı kopyalanır. Instagram → Hikâye'yi seç, sonra Müzik çıkartmasına dokunup yapıştır: “${sarki.title}” hikâyende çalsın.`
            : "Paylaş'a basınca açılan menüden Instagram'ı, sonra Hikâye'yi seç."}</Text>
        </Animated.View>
      </ScrollView>
      {ipucu && (
        <Animated.View entering={ZoomIn.springify().damping(15)} style={k.toast} pointerEvents="none">
          <Text style={{ fontSize: 26 }}>🎵</Text>
          <View style={{ flex: 1 }}>
            <Text style={k.toastBaslik}>{ipucu}</Text>
            <Text style={k.toastAlt}>Instagram'da Müzik çıkartmasına dokun, arama kutusuna yapıştır.</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/* ---------------- şarkı seçici ---------------- */
function SarkiSecici({ oz, secili, onSec, dinlenen, onDinle }: {
  oz?: Ozet | null; secili: Sarki | null; onSec: (s: Sarki | null) => void; dinlenen: string | null; onDinle: (yt: string | null) => void;
}) {
  const [yaz, setYaz] = useState(false);
  const kaydir = useRef<any>(null);
  const [ad, setAd] = useState('');
  const [sanatci, setSanatci] = useState('');
  const liste = oz?.sarkilar ?? [];
  const ayni = (a: Sarki | null, b: Sarki) => !!a && a.title === b.title && a.artist === b.artist;
  const ozel = secili && !liste.some((x) => ayni(secili, x)) ? secili : null;
  return (
    <View style={{ width: W, marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={k.secBaslik}>KARTIN ŞARKISI</Text>
        {secili && <Pressable onPress={() => onSec(null)} hitSlop={8}><Text style={k.secKaldir}>Şarkısız</Text></Pressable>}
      </View>
      <Text style={k.secAlt}>{oz === undefined ? 'O günün şarkıları yükleniyor…' : liste.length ? 'O gün radyoda çalanlar. Birini seç, ▶ ile dinle.' : 'Arşivde bu güne ait şarkı yok; kendin yazabilirsin.'}</Text>
      <ScrollView ref={kaydir} horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {[...(ozel ? [ozel] : []), ...liste].map((x, i) => {
          const sec = ayni(secili, x);
          return (
            <Pressable key={`${x.title}-${i}`} onPress={() => onSec(x)} style={[k.sarkiKutu, sec && k.sarkiSecili]}>
              <SarkiKapak uri={x.img} />
              <View style={{ flex: 1 }}>
                <Text style={[k.sarkiAd, sec && { color: '#111' }]} numberOfLines={1}>{x.title}</Text>
                <Text style={[k.sarkiSanatci, sec && { color: 'rgba(0,0,0,0.6)' }]} numberOfLines={1}>{x.artist}</Text>
              </View>
              {x.yt && (
                <Pressable onPress={() => onDinle(dinlenen === x.yt ? null : x.yt!)} hitSlop={8} style={[k.dinle, sec && { backgroundColor: '#111' }]}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>{dinlenen === x.yt ? '■' : '▶'}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
        <Pressable onPress={() => setYaz((v) => !v)} style={[k.sarkiKutu, { width: 128, justifyContent: 'center' }]}>
          <Text style={k.sarkiAd}>✏️  Başka şarkı</Text>
        </Pressable>
      </ScrollView>
      {yaz && (
        <Animated.View entering={FadeIn} style={k.yazKutu}>
          <TextInput value={ad} onChangeText={setAd} placeholder="Şarkının adı" placeholderTextColor="rgba(255,255,255,0.35)" style={k.girdi} />
          <TextInput value={sanatci} onChangeText={setSanatci} placeholder="Söyleyen" placeholderTextColor="rgba(255,255,255,0.35)" style={k.girdi} />
          <Bas disabled={!ad.trim()} onPress={() => { onSec({ title: ad.trim(), artist: sanatci.trim() }); setYaz(false); kaydir.current?.scrollTo({ x: 0, animated: true }); }} style={[k.ikinci, { opacity: ad.trim() ? 1 : 0.4 }]}>
            <Text style={k.ikinciText}>Karta koy</Text>
          </Bas>
          <Text style={k.not}>Örneğin düğününüzde çalan şarkı. Uygulamada çalınamaz ama kartta yazar; Instagram'da yine müzik olarak ekleyebilirsin.</Text>
        </Animated.View>
      )}
      {dinlenen && Platform.OS !== 'web' && (
        <View style={k.mini}>
          <WebView key={dinlenen} style={{ width: 96, height: 54, backgroundColor: '#000' }} originWhitelist={['*']} allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false} javaScriptEnabled source={{ baseUrl: 'https://kadran.app', html: oynatici(dinlenen, 30) }}
            onMessage={(e) => { if (e.nativeEvent.data.startsWith('err')) onDinle(null); }} />
          <Text style={[k.sarkiSanatci, { flex: 1 }]} numberOfLines={2}>Çalıyor: {[...liste, ...(ozel ? [ozel] : [])].find((x) => x.yt === dinlenen)?.title}</Text>
          <Pressable onPress={() => onDinle(null)} hitSlop={8}><Text style={k.secKaldir}>Durdur</Text></Pressable>
        </View>
      )}
    </View>
  );
}
function SarkiKapak({ uri }: { uri?: string | null }) {
  const [bad, setBad] = useState(false);
  if (!uri || bad) return <View style={[k.sarkiKapak, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 16 }}>🎵</Text></View>;
  return <Image source={{ uri }} style={k.sarkiKapak} onError={() => setBad(true)} />;
}

/* ---------------- şablonlar ---------------- */
/** Paylaşım kartı kutlama içindir: kötü haber manşetleri karta konmaz (gün sayfasında yine görünür). */
const KOTU = /şehit|öldü|ölü|ölüm|hayatını kaybet|saldırı|terör|PKK|bomba|patlama|deprem|kaza|facia|darbe|yaralı|cinayet|savaş|intihar|katliam|yangın|sel\b|enkaz|kaçırıl|idam|tutuklan|gözaltı/i;
const kartManseti = (oz?: Ozet | null) => (oz?.manset && !KOTU.test(oz.manset) ? oz.manset : undefined);

const tarihYaz = (h: PaylasHedef) => `${h.day} ${AYLAR[h.month - 1]} ${h.year}`;
const dolarYaz = (h: PaylasHedef, oz?: Ozet | null) => oz?.dolar ? `${h.year < 2005 ? oz.dolar.replace(/ TL$/, ' lira') : oz.dolar}` : null;

/** Paylaşım kartlarında gazete: arşiv taraması DEĞİL, o günün (iyi) başlıklarıyla kendi tasarımımız. Instagram'a gider. */
function Gazete({ h, oz, w, yuk, donus }: { h: PaylasHedef; oz?: Ozet | null; w: number; yuk: number; donus: number }) {
  const basliklar = (oz?.basliklar ?? []).filter((b) => !KOTU.test(b));
  const manset = kartManseti(oz) ?? basliklar[0];
  return (
    <View style={[{ width: w, height: yuk, overflow: 'hidden', transform: [{ rotate: `${donus}deg` }], backgroundColor: '#F2EADB' }, k.golge]}>
      <KadranGazetesi year={h.year} month={h.month} day={h.day} genislik={w} kisa
        icerik={{ manset, basliklar, sarki: oz?.sarki, dolar: oz?.dolar }} />
    </View>
  );
}

function Polaroid({ h, oz, foto, renk }: { h: PaylasHedef; oz?: Ozet | null; foto: string | null; renk: [string, string] }) {
  return (
    <View style={k.kart}>
      <LinearGradient colors={[renk[1], '#120E0C']} locations={[0, 0.75]} style={StyleSheet.absoluteFill} />
      <Text style={k.marka}>KADRAN</Text>
      <Text style={k.kicker}>{h.ikon}  {h.baslik.toLocaleUpperCase('tr-TR')}</Text>
      <View style={{ height: 268, marginTop: 14 }}>
        {foto ? (
          <>
            <View style={{ position: 'absolute', right: 2, top: 6 }}><Gazete h={h} oz={oz} w={132} yuk={180} donus={7} /></View>
            <View style={[k.polaroid, { transform: [{ rotate: '-4deg' }] }]}>
              <Image source={{ uri: foto }} style={{ width: 168, height: 190 }} resizeMode="cover" />
              <Text style={k.polaroidYazi}>{`${String(h.day).padStart(2, '0')}.${String(h.month).padStart(2, '0')}.${h.year}`}</Text>
            </View>
          </>
        ) : oz && (kartManseti(oz) || (oz.basliklar ?? []).some((b) => !KOTU.test(b))) ? (
          <View style={{ alignItems: 'center', paddingTop: 4 }}><Gazete h={h} oz={oz} w={200} yuk={256} donus={-3} /></View>
        ) : (
          <Kupur metin={h.baslik} tarih={tarihYaz(h)} />
        )}
      </View>
      <Text style={[k.tarihBuyuk, { color: renk[0] }]}>{h.day} {AYLAR[h.month - 1]}</Text>
      <Text style={k.yilSatir}>{h.year} · {weekdayOf(isoOf(h.year, h.month, h.day))}</Text>
      <View style={{ gap: 6, marginTop: 12 }}>
        {oz?.sarki && <Text style={k.bilgi} numberOfLines={1}>🎵  {oz.sarki.title} · {oz.sarki.artist}</Text>}
        {dolarYaz(h, oz) && <Text style={k.bilgi} numberOfLines={1}>💵  1 dolar {dolarYaz(h, oz)}{oz?.dolarKat && oz.dolarKat > 1.5 ? ` · 2026'da ${Math.round(oz.dolarKat).toLocaleString('tr-TR')} katı` : ''}</Text>}
      </View>
      <View style={{ flex: 1 }} />
      <Text style={k.davet}>Sen hangi güne ışınlanırdın?</Text>
    </View>
  );
}

function GazeteSablon({ h, oz, foto }: { h: PaylasHedef; oz?: Ozet | null; foto: string | null }) {
  const gorsel = foto; // arşiv taraması paylaşılmaz
  const manset = kartManseti(oz);
  return (
    <View style={[k.kart, { backgroundColor: '#F2EADB', padding: 20 }]}>
      <View style={k.gzUst}>
        <Text style={k.gzMarka}>KADRAN</Text>
        <Text style={k.gzAlt}>{tarihYaz(h).toLocaleUpperCase('tr-TR')} · {weekdayOf(isoOf(h.year, h.month, h.day)).toLocaleUpperCase('tr-TR')}</Text>
      </View>
      <Text style={k.gzEtiket}>{h.ikon} {h.baslik.toLocaleUpperCase('tr-TR')}</Text>
      <Text style={[k.gzManset, (manset?.length ?? 0) > 70 && { fontSize: 22, lineHeight: 25 }]} numberOfLines={4}>{manset ?? `${h.baslik}, ${h.year}`}</Text>
      {!manset && oz?.dizi && <Text style={k.gzAltManset}>O akşam ekranlarda “{oz.dizi}” vardı.</Text>}
      {gorsel ? (
        <View style={k.gzFotoCerceve}>
          <GzFoto uri={gorsel} />
          <Text style={k.gzFotoAlt}>{foto ? `${h.baslik} · ${h.year}` : 'O sabahın gazetesi'}</Text>
        </View>
      ) : (
        // fotoğraf yoksa o günün diğer (iyi) başlıkları
        <View style={{ marginTop: 12, gap: 8, borderTopWidth: 1, borderColor: '#2B2622', paddingTop: 10 }}>
          {(oz?.basliklar ?? []).filter((b) => !KOTU.test(b) && b !== manset).slice(0, 3).map((b, i) => (
            <Text key={i} style={k.gzKolon} numberOfLines={2}>■ {b}</Text>
          ))}
        </View>
      )}
      <View style={k.gzKolonlar}>
        {oz?.sarki && <View style={{ flex: 1 }}><Text style={k.gzKolonBaslik}>RADYODA</Text><Text style={k.gzKolon} numberOfLines={3}>{oz.sarki.title} · {oz.sarki.artist}</Text></View>}
        {dolarYaz(h, oz) && <View style={{ flex: 1 }}><Text style={k.gzKolonBaslik}>1 DOLAR</Text><Text style={k.gzKolon}>{dolarYaz(h, oz)}</Text></View>}
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[k.davet, { color: '#2B2622' }]}>Sen hangi güne ışınlanırdın?</Text>
    </View>
  );
}
function GzFoto({ uri }: { uri: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return null;
  return <Image source={{ uri }} style={{ width: '100%', height: 150 }} resizeMode="cover" onError={() => setBad(true)} />;
}

function Radyo({ h, oz, foto, renk }: { h: PaylasHedef; oz?: Ozet | null; foto: string | null; renk: [string, string] }) {
  return (
    <View style={k.kart}>
      <LinearGradient colors={[renk[1], '#0B0B0E', '#0B0B0E']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[k.isik, { backgroundColor: renk[0] }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={k.marka}>KADRAN</Text>
          <Text style={[k.kicker, { marginTop: 22 }]}>{h.ikon}  {h.baslik.toLocaleUpperCase('tr-TR')}</Text>
        </View>
        {foto && <Image source={{ uri: foto }} style={[k.yuvarlak, { borderColor: renk[0] }]} />}
      </View>
      <Text style={[k.yil, { color: renk[0] }]}>{h.year}</Text>
      <Text style={k.tarih}>{h.day} {AYLAR[h.month - 1]}, {weekdayOf(isoOf(h.year, h.month, h.day))}</Text>
      <View style={k.ayrac} />
      {oz === undefined ? <ActivityIndicator color={renk[0]} style={{ marginTop: 30 }} /> : (
        <View style={{ gap: 16 }}>
          {kartManseti(oz) && <Satir etiket="O GÜN GAZETEDE" deger={kartManseti(oz)!} serif uzun />}
          {oz?.sarki && <Satir etiket="RADYODA" deger={oz.sarki.title} alt={oz.sarki.artist} />}
          {oz?.dizi && !kartManseti(oz) && <Satir etiket="EKRANDA" deger={oz.dizi} />}
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {oz?.dolar && <View style={{ flex: 1 }}><Satir etiket={h.year < 2005 ? '1 DOLAR · ESKİ PARA' : '1 DOLAR'} deger={oz.dolar} renk={renk[0]} /></View>}
            {oz?.altin && <View style={{ flex: 1 }}><Satir etiket="GRAM ALTIN" deger={oz.altin} renk={renk[0]} /></View>}
          </View>
        </View>
      )}
      <View style={{ flex: 1 }} />
      <Text style={k.davet}>Sen hangi güne ışınlanırdın?</Text>
    </View>
  );
}

/** Plak: o günün şarkısı ortada, dönen plak, altta çalar çubuğu. Müziği hikâyede Instagram çalar. */
function Plak({ h, oz, foto, renk }: { h: PaylasHedef; oz?: Ozet | null; foto: string | null; renk: [string, string] }) {
  const s = oz?.sarki;
  const etiket = foto ?? s?.img ?? null;
  const [bad, setBad] = useState(false);
  return (
    <View style={k.kart}>
      <LinearGradient colors={[renk[1], '#0B0A0C', '#0B0A0C']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={[k.isik, { backgroundColor: renk[0], top: 40, right: -140, opacity: 0.22 }]} />
      <Text style={k.marka}>KADRAN</Text>
      <Text style={k.kicker}>{h.ikon}  {h.baslik.toLocaleUpperCase('tr-TR')}</Text>
      <View style={{ alignItems: 'center', marginTop: 22 }}>
        <View style={k.plak}>
          {[214, 186, 160, 134].map((d) => <View key={d} style={[k.oluk, { width: d, height: d, borderRadius: d / 2 }]} />)}
          <View style={k.parilti} />
          <View style={[k.plakEtiket, { backgroundColor: renk[0] }]}>
            {etiket && !bad ? <Image source={{ uri: etiket }} style={{ width: '100%', height: '100%' }} onError={() => setBad(true)} />
              : <Text style={k.plakYil}>{h.year}</Text>}
          </View>
          <View style={k.plakDelik} />
        </View>
      </View>
      <Text style={[k.etiket, { marginTop: 22 }]}>O GÜN RADYODA · {h.day} {AYLAR[h.month - 1].toLocaleUpperCase('tr-TR')} {h.year}</Text>
      {oz === undefined ? <ActivityIndicator color={renk[0]} style={{ marginTop: 20 }} /> : s ? (
        <>
          <Text style={k.plakSarki} numberOfLines={2}>{s.title}</Text>
          {!!s.artist && <Text style={[k.plakSanatci, { color: renk[0] }]} numberOfLines={1}>{s.artist}</Text>}
        </>
      ) : <Text style={k.plakSarki}>{h.baslik}</Text>}
      <View style={k.cubuk}>
        <View style={[k.cubukDolu, { backgroundColor: renk[0] }]} />
        <View style={[k.cubukTop, { backgroundColor: renk[0] }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={k.sure}>{h.year}</Text>
        <Text style={k.sure}>{new Date().getFullYear()}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={k.davet}>Sen hangi güne ışınlanırdın?</Text>
    </View>
  );
}

function Kupur({ metin, tarih }: { metin: string; tarih: string }) {
  return (
    <View style={[k.kupur, k.golge, { transform: [{ rotate: '-2deg' }] }]}>
      <Text style={k.kupurTarih}>{tarih.toLocaleUpperCase('tr-TR')}</Text>
      <Text style={k.kupurMetin} numberOfLines={6}>{metin}</Text>
    </View>
  );
}

function Satir({ etiket, deger, alt, serif, uzun, renk }: { etiket: string; deger: string; alt?: string; serif?: boolean; uzun?: boolean; renk?: string }) {
  return (
    <View>
      <Text style={k.etiket}>{etiket}</Text>
      <Text style={[serif ? k.degerSerif : k.deger, renk && { color: renk }]} numberOfLines={uzun ? 4 : 2}>{deger}</Text>
      {alt && <Text style={k.degerAlt} numberOfLines={1}>{alt}</Text>}
    </View>
  );
}

const k = StyleSheet.create({
  ust: { width: W, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  kapat: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ustBaslik: { fontFamily: F.b, color: '#fff', fontSize: 15 },
  kart: { width: W, height: H, borderRadius: 28, overflow: 'hidden', padding: 24, backgroundColor: '#0B0B0E' },
  golge: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  isik: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: -120, right: -90, opacity: 0.35 },
  marka: { fontFamily: F.xb, color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 4 },
  kicker: { fontFamily: F.b, color: 'rgba(255,255,255,0.9)', fontSize: 12, letterSpacing: 1.6, marginTop: 12 },
  polaroid: { position: 'absolute', left: 0, top: 30, backgroundColor: '#FBFAF6', padding: 9, paddingBottom: 30, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  polaroidYazi: { position: 'absolute', bottom: 7, left: 0, right: 0, textAlign: 'center', fontFamily: F.serifI, color: '#3A332C', fontSize: 16 },
  tarihBuyuk: { fontFamily: F.serif, fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  yilSatir: { fontFamily: F.b, color: C.text, fontSize: 16 },
  bilgi: { fontFamily: F.sb, color: 'rgba(255,255,255,0.88)', fontSize: 13.5 },
  davet: { fontFamily: F.serifI, color: 'rgba(255,255,255,0.85)', fontSize: 19 },
  yil: { fontFamily: F.serif, fontSize: 104, lineHeight: 108, letterSpacing: -3, marginTop: 2 },
  tarih: { fontFamily: F.b, color: C.text, fontSize: 18, marginTop: -2 },
  yuvarlak: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  ayrac: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 18 },
  etiket: { fontFamily: F.b, color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1.8 },
  deger: { fontFamily: F.sb, color: C.text, fontSize: 17, marginTop: 3, lineHeight: 21 },
  degerSerif: { fontFamily: F.serif, color: C.text, fontSize: 21, lineHeight: 24, marginTop: 3 },
  degerAlt: { fontFamily: F.r, color: C.sub, fontSize: 13, marginTop: 1 },
  kupur: { marginTop: 10, marginHorizontal: 8, backgroundColor: '#F3EBDD', padding: 18, minHeight: 210 },
  kupurTarih: { fontFamily: F.b, color: 'rgba(43,38,34,0.6)', fontSize: 10, letterSpacing: 1.6, borderBottomWidth: 1, borderColor: 'rgba(43,38,34,0.25)', paddingBottom: 6, marginBottom: 10 },
  kupurMetin: { fontFamily: F.serif, color: '#2B2622', fontSize: 24, lineHeight: 27 },
  // gazete şablonu
  gzUst: { borderBottomWidth: 2, borderTopWidth: 2, borderColor: '#2B2622', paddingVertical: 6, alignItems: 'center' },
  gzMarka: { fontFamily: F.serif, color: '#2B2622', fontSize: 40, lineHeight: 42, letterSpacing: 2 },
  gzAlt: { fontFamily: F.b, color: '#2B2622', fontSize: 9, letterSpacing: 1.4, marginTop: 2 },
  gzEtiket: { fontFamily: F.xb, color: '#8A2E1E', fontSize: 11, letterSpacing: 1.6, marginTop: 14 },
  gzManset: { fontFamily: F.serif, color: '#1E1A17', fontSize: 27, lineHeight: 30, marginTop: 4 },
  gzAltManset: { fontFamily: F.serifI, color: '#4A423A', fontSize: 15, marginTop: 4 },
  gzFotoCerceve: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(43,38,34,0.35)', padding: 4 },
  gzFotoAlt: { fontFamily: F.serifI, color: '#4A423A', fontSize: 12, marginTop: 4 },
  gzKolonlar: { flexDirection: 'row', gap: 14, marginTop: 12, borderTopWidth: 1, borderColor: 'rgba(43,38,34,0.3)', paddingTop: 10 },
  gzKolonBaslik: { fontFamily: F.xb, color: '#2B2622', fontSize: 9.5, letterSpacing: 1.6 },
  gzKolon: { fontFamily: F.serif, color: '#1E1A17', fontSize: 16, lineHeight: 19, marginTop: 2 },
  // plak şablonu
  plak: { width: 232, height: 232, borderRadius: 116, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  oluk: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.13)' },
  parilti: { position: 'absolute', width: 232, height: 232, borderRadius: 116, borderTopWidth: 10, borderLeftWidth: 4, borderColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '-30deg' }] },
  plakEtiket: { width: 92, height: 92, borderRadius: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plakYil: { fontFamily: F.serif, color: '#111', fontSize: 30 },
  plakDelik: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#0B0A0C' },
  plakSarki: { fontFamily: F.serif, color: '#fff', fontSize: 34, lineHeight: 37, marginTop: 6, letterSpacing: -0.5 },
  plakSanatci: { fontFamily: F.b, fontSize: 16, marginTop: 2 },
  cubuk: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 18, justifyContent: 'center' },
  cubukDolu: { position: 'absolute', left: 0, width: '38%', height: 3, borderRadius: 2 },
  cubukTop: { position: 'absolute', left: '36%', width: 10, height: 10, borderRadius: 5 },
  sure: { fontFamily: F.m, color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 },
  // şarkı seçici
  secBaslik: { fontFamily: F.xb, color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1.8 },
  secKaldir: { fontFamily: F.b, color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  secAlt: { fontFamily: F.r, color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 },
  sarkiKutu: { width: 210, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  sarkiSecili: { backgroundColor: '#fff' },
  sarkiKapak: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  sarkiAd: { fontFamily: F.b, color: '#fff', fontSize: 13 },
  sarkiSanatci: { fontFamily: F.r, color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  dinle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  yazKutu: { marginTop: 10, gap: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  girdi: { fontFamily: F.m, color: '#fff', fontSize: 15, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  toastBaslik: { fontFamily: F.b, color: '#111', fontSize: 15 },
  toastAlt: { fontFamily: F.r, color: '#444', fontSize: 13, marginTop: 2 },
  // düğmeler
  sablonlar: { flexDirection: 'row', gap: 8, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: 4 },
  sablon: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  sablonText: { fontFamily: F.b, color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  insta: { borderRadius: 20, paddingVertical: 17, alignItems: 'center', overflow: 'hidden' },
  instaText: { fontFamily: F.b, color: '#fff', fontSize: 17 },
  ikinci: { borderRadius: 18, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  ikinciText: { fontFamily: F.b, color: '#fff', fontSize: 13.5 },
  not: { fontFamily: F.r, color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 2 },
});
