import { StyleSheet, Text, View } from 'react-native';
import { AYLAR, isoOf, weekdayOf } from '../data';
import { F } from '../ui';

/**
 * Kadran Gazetesi: o günün ön sayfası, kendi tasarımımızla.
 * Gazete arşivinin sayfa taramalarını kullanmadan "o sabah gazeteye bakmak" hissini verir.
 * Başlıklar arşivdeki haberlerden gelir (kaynak gösterilerek); düzen, yazı ve süsler bize aittir.
 * `genislik` ile her boyutta aynı oranla çizilir (paylaşım kartında küçük, gün sayfasında büyük).
 */
export interface GazeteIcerik {
  manset?: string;
  basliklar?: string[];
  sarki?: { title: string; artist: string };
  dolar?: string;
  dizi?: string;
  mac?: string;
}

export function KadranGazetesi({ year, month, day, icerik, genislik = 320, kaynak, kisa = false }: {
  year: number; month: number; day: number; icerik: GazeteIcerik; genislik?: number; kaynak?: string;
  /** kisa: sadece manşet ve üst kısım (küçük kartlar için) */
  kisa?: boolean;
}) {
  const o = genislik / 320; // ölçek
  const z = (n: number) => Math.round(n * o * 10) / 10;
  const gun = weekdayOf(isoOf(year, month, day));
  const manset = icerik.manset ?? icerik.basliklar?.[0];
  const digerleri = (icerik.basliklar ?? []).filter((b) => b !== manset).slice(0, kisa ? 0 : 3);
  const kutular = [
    icerik.sarki && { b: 'RADYODA', d: `${icerik.sarki.title}`, a: icerik.sarki.artist },
    icerik.dolar && { b: '1 DOLAR', d: year < 2005 ? icerik.dolar.replace(/ TL$/, ' lira') : icerik.dolar },
    icerik.dizi && { b: 'EKRANDA', d: icerik.dizi },
    icerik.mac && { b: 'SAHADA', d: icerik.mac },
  ].filter(Boolean).slice(0, kisa ? 2 : 3) as { b: string; d: string; a?: string }[];

  return (
    <View style={[s.kagit, { width: genislik, padding: z(14) }]}>
      {/* künye */}
      <View style={[s.cizgi, { borderTopWidth: z(2.5) }]} />
      <Text style={[s.marka, { fontSize: z(40), lineHeight: z(44) }]}>KADRAN</Text>
      <View style={[s.kunye, { borderTopWidth: z(1), borderBottomWidth: z(1), paddingVertical: z(3) }]}>
        <Text style={[s.kunyeYazi, { fontSize: z(8.5) }]}>{day} {AYLAR[month - 1].toLocaleUpperCase('tr-TR')} {year}</Text>
        <Text style={[s.kunyeYazi, { fontSize: z(8.5) }]}>{gun.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={[s.kunyeYazi, { fontSize: z(8.5) }]}>ZAMAN YOLCULARININ GAZETESİ</Text>
      </View>

      {/* manşet */}
      {manset ? (
        <Text style={[s.manset, { fontSize: z(manset.length > 80 ? 21 : manset.length > 45 ? 25 : 30), lineHeight: z(manset.length > 80 ? 24 : manset.length > 45 ? 28 : 33), marginTop: z(10) }]}
          numberOfLines={kisa ? 4 : 5}>{manset}</Text>
      ) : (
        <Text style={[s.manset, { fontSize: z(26), lineHeight: z(30), marginTop: z(10) }]}>{day} {AYLAR[month - 1]} {year}</Text>
      )}

      {/* diğer başlıklar: iki sütun */}
      {digerleri.length > 0 && (
        <View style={[s.sutunlar, { marginTop: z(10), gap: z(10), borderTopWidth: z(1), paddingTop: z(8) }]}>
          {digerleri.map((b, i) => (
            <View key={i} style={[{ flex: 1 }, i > 0 && { borderLeftWidth: z(0.8), borderColor: '#2B2622', paddingLeft: z(8) }]}>
              <Text style={[s.baslik, { fontSize: z(11.5), lineHeight: z(14.5) }]} numberOfLines={5}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {/* alt kutular */}
      {kutular.length > 0 && (
        <View style={[s.sutunlar, { marginTop: z(10), gap: z(8) }]}>
          {kutular.map((k, i) => (
            <View key={i} style={[s.kutu, { flex: 1, padding: z(6), borderWidth: z(1) }]}>
              <Text style={[s.kutuBaslik, { fontSize: z(7.5), letterSpacing: z(1) }]}>{k.b}</Text>
              <Text style={[s.kutuDeger, { fontSize: z(11), lineHeight: z(13.5), marginTop: z(2) }]} numberOfLines={3}>{k.d}</Text>
              {k.a && <Text style={[s.kutuAlt, { fontSize: z(9) }]} numberOfLines={1}>{k.a}</Text>}
            </View>
          ))}
        </View>
      )}
      {!!kaynak && !kisa && <Text style={[s.kaynak, { fontSize: z(7.5), marginTop: z(8) }]}>Başlıklar: {kaynak}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  kagit: { backgroundColor: '#F2EADB' },
  cizgi: { borderColor: '#1E1A17' },
  marka: { fontFamily: F.serif, color: '#1E1A17', textAlign: 'center', letterSpacing: 2 },
  kunye: { flexDirection: 'row', justifyContent: 'space-between', borderColor: '#1E1A17' },
  kunyeYazi: { fontFamily: F.b, color: '#2B2622', letterSpacing: 0.6 },
  manset: { fontFamily: F.serif, color: '#14110F' },
  sutunlar: { flexDirection: 'row', borderColor: '#2B2622' },
  baslik: { fontFamily: F.sb, color: '#2B2622' },
  kutu: { borderColor: '#2B2622' },
  kutuBaslik: { fontFamily: F.xb, color: '#7A2E1E' },
  kutuDeger: { fontFamily: F.serif, color: '#14110F' },
  kutuAlt: { fontFamily: F.m, color: '#4A433D' },
  kaynak: { fontFamily: F.r, color: '#6B625A' },
});
