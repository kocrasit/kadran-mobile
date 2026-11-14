import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { DayData, gazeteUrl } from '../data';
import { Bas, C, F } from '../ui';

type Front = NonNullable<DayData['newspaperFront']>;

const gazeteAdi = (f: Front) => f.paper ?? (f.provider === 'turkiyegazetesi' ? 'Türkiye' : 'Milliyet');

/**
 * O günün gerçek gazetesi: ön sayfa kartı; dokununca sayfa sayfa gezilen tam ekran görüntüleyici.
 * Görseller arşivden (Milliyet / Gaste Arşivi / Kiosko) bilgisayardaki Expo sunucusu üzerinden gelir.
 * Türkiye Gazetesi PDF olduğu için doğrudan PDF olarak açılır.
 */
export function GazeteKart({ iso, front, pages, c1 }: { iso: string; front: Front; pages?: DayData['newspaperPages']; c1: string }) {
  const [acik, setAcik] = useState(false);
  const [bad, setBad] = useState(false);
  const pdf = front.provider === 'turkiyegazetesi';
  const ad = gazeteAdi(front);
  const sayfaSayisi = pages?.count ?? 0;

  // Türkiye Gazetesi (2016+): PDF'i telefonun kendisi gösterir; kartta 1. sayfa, dokununca tam ekran
  if (pdf && !bad) {
    return (
      <>
        <Bas onPress={() => setAcik(true)} style={st.card} scale={0.985}>
          <View style={st.paperWrap} pointerEvents="none">
            <ActivityIndicator color={C.faint} style={StyleSheet.absoluteFill} />
            <WebView source={{ uri: front.image.url }} style={st.paper} scrollEnabled={false} scalesPageToFit
              onError={() => setBad(true)} onHttpError={() => setBad(true)} originWhitelist={['*']} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={st.paperShade} />
            <View style={st.paperLabel}>
              <Text style={st.kicker}>O GÜNÜN GAZETESİ</Text>
              <Text style={st.paperTitle}>{ad}</Text>
              <Text style={st.paperSub}>Büyütmek için dokun ›</Text>
            </View>
          </View>
        </Bas>
        {acik && (
          <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAcik(false)}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <View style={st.galTop}>
                <Pressable onPress={() => setAcik(false)} hitSlop={12}><Text style={st.galBtn}>✕  Kapat</Text></Pressable>
                <Text style={st.galInfo}>{ad} · ön sayfa</Text>
                <Pressable onPress={() => Linking.openURL(front.image.url)} hitSlop={12}><Text style={st.galBtn}>Safari ↗</Text></Pressable>
              </View>
              <WebView source={{ uri: front.image.url }} style={{ flex: 1, backgroundColor: '#000' }} originWhitelist={['*']} />
              <Text style={[st.note, { paddingBottom: 30 }]}>Kaynak: Türkiye Gazetesi e-gazete arşivi · İki parmakla yakınlaştır</Text>
            </View>
          </Modal>
        )}
      </>
    );
  }

  if (pdf || bad) {
    return (
      <Bas onPress={() => Linking.openURL(pdf ? front.image.url : front.image.sourcePage ?? front.image.url)} style={st.pdfCard}>
        <LinearGradient colors={[c1 + '55', C.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={st.kicker}>O GÜNÜN GAZETESİ</Text>
        <Text style={st.pdfTitle}>{ad} gazetesinin o günkü ön sayfası</Text>
        <Text style={[st.link, { color: c1 }]}>{pdf ? 'Ön sayfayı aç (PDF) ↗' : 'Arşivde aç ↗'}</Text>
      </Bas>
    );
  }

  return (
    <>
      <Bas onPress={() => setAcik(true)} style={st.card} scale={0.985}>
        <View style={st.paperWrap}>
          <ActivityIndicator color={C.faint} style={StyleSheet.absoluteFill} />
          {/* önce küçük önizleme anında görünür, büyük boy yüklenince üstüne oturur */}
          {sayfaSayisi > 0 && <Image source={{ uri: gazeteUrl(iso, 1, true) }} style={st.paper} resizeMode="cover" blurRadius={1} />}
          <Image source={{ uri: gazeteUrl(iso) }} style={st.paper} resizeMode="cover" onError={() => setBad(true)} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={st.paperShade} />
          <View style={st.paperLabel}>
            <Text style={st.kicker}>O GÜNÜN GAZETESİ</Text>
            <Text style={st.paperTitle}>{ad}</Text>
            <Text style={st.paperSub}>{sayfaSayisi > 1 ? `${sayfaSayisi} sayfanın hepsini gez ›` : 'Büyütmek için dokun ›'}</Text>
          </View>
        </View>
      </Bas>
      {acik && <GazeteGaleri iso={iso} front={front} pages={pages} onClose={() => setAcik(false)} />}
    </>
  );
}

function GazeteGaleri({ iso, front, pages, onClose }: { iso: string; front: Front; pages?: DayData['newspaperPages']; onClose: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const liste = pages?.pages?.length ? pages.pages.map((p) => p.no) : [0];
  const [i, setI] = useState(0);
  const ref = useRef<FlatList<number>>(null);
  const tamsayfa = (no: number) => (no === 0 ? gazeteUrl(iso) : gazeteUrl(iso, no));
  const kucuk = (no: number) => (no === 0 ? gazeteUrl(iso) : gazeteUrl(iso, no, true));
  const git = (k: number) => { setI(k); ref.current?.scrollToIndex({ index: k, animated: true }); };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={st.galTop}>
          <Pressable onPress={onClose} hitSlop={12}><Text style={st.galBtn}>✕  Kapat</Text></Pressable>
          <Text style={st.galInfo}>{gazeteAdi(front)} · {liste.length > 1 ? `${i + 1} / ${liste.length}` : 'ön sayfa'}</Text>
          {front.image.sourcePage
            ? <Pressable onPress={() => Linking.openURL(front.image.sourcePage!)} hitSlop={12}><Text style={st.galBtn}>Arşiv ↗</Text></Pressable>
            : <View style={{ width: 50 }} />}
        </View>

        <FlatList
          ref={ref}
          data={liste}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(n) => String(n)}
          getItemLayout={(_, k) => ({ length: W, offset: W * k, index: k })}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item }) => (
            <ScrollView style={{ width: W }} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}
              maximumZoomScale={4} minimumZoomScale={1} centerContent showsVerticalScrollIndicator={false}>
              <ActivityIndicator color="#888" style={{ position: 'absolute' }} />
              <Image source={{ uri: tamsayfa(item) }} style={{ width: W, height: H * 0.74 }} resizeMode="contain" />
            </ScrollView>
          )}
        />

        {liste.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12, paddingBottom: 34 }}>
            {liste.map((no, k) => (
              <Pressable key={no} onPress={() => git(k)} style={[st.thumb, k === i && { borderColor: '#fff' }]}>
                <Image source={{ uri: kucuk(no) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <Text style={st.thumbNo}>{no}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {front.provider === 'gastearsivi' && <Text style={st.note}>Arşivin herkese açık önizlemesi (küçük boy). Tam boy için "Arşiv"e dokun.</Text>}
        <Text style={st.note}>Kaynak: {front.image.license ?? 'Gazete arşivi'} · Tarama ilgili gazeteye aittir.</Text>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, marginBottom: 14 },
  paperWrap: { width: '100%', aspectRatio: 0.78, backgroundColor: '#E9E4D8', overflow: 'hidden' },
  paper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  paperShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  paperLabel: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  kicker: { fontFamily: F.b, color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 2 },
  paperTitle: { fontFamily: F.serif, color: '#fff', fontSize: 40, lineHeight: 44 },
  paperSub: { fontFamily: F.sb, color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  pdfCard: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, marginBottom: 14 },
  pdfTitle: { fontFamily: F.serif, color: C.text, fontSize: 30, lineHeight: 34, marginTop: 8 },
  link: { fontFamily: F.b, fontSize: 15, marginTop: 14 },
  galTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 58, paddingHorizontal: 18, paddingBottom: 10 },
  galBtn: { fontFamily: F.sb, color: '#fff', fontSize: 15 },
  galInfo: { fontFamily: F.m, color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  thumb: { width: 54, height: 72, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: '#222' },
  thumbNo: { position: 'absolute', bottom: 2, right: 4, fontFamily: F.b, color: '#fff', fontSize: 10, textShadowColor: '#000', textShadowRadius: 3 },
  note: { fontFamily: F.r, color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 6 },
});
