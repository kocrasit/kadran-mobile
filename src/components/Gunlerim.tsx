import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AYLAR, weekdayOf, isoOf } from '../data';
import { themeForYear } from '../theme';
import { DatePicker, YMD, clamp, MAX } from './DatePicker';
import { ERA_GLOW } from './Post';
import { Bas, C, ERA_LIGHT, F } from '../ui';
import { useStored } from '../storage';
import { OnemliGun, TURLER, TurKey, fotoSec, gunAdi, izinIste, sonrakiYildonumu, useOzet } from '../gunler';
import { PaylasHedef, PaylasKart, Sablon } from './PaylasKart';

const AMBER = '#FFB000';
const kalanYazi = (n: number) => (n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : `${n} gün sonra`);

/** Izgaradaki bir kare: doğduğun gün, önemli bir gün ya da kaydettiğin gün */
interface Gun { anahtar: string; ymd: YMD; ikon: string; baslik: string; tur: 'dogum' | 'onemli' | 'kayit'; onemli?: OnemliGun }

/**
 * Benim Günlerim — Instagram profili gibi:
 * üstte doğum kartı (profil), altında her önemli gün bir kare. Kareye dokun → gün sayfası → tek tuşla paylaş.
 */
export function Gunlerim({ birthday, setBirthday, saved, removeSaved, onTravel, today, onemli, setOnemli, hatirlatma, setHatirlatma }: {
  birthday: YMD | null;
  setBirthday: (v: YMD | null) => void;
  saved: YMD[];
  removeSaved: (v: YMD) => void;
  onTravel: (v: YMD) => void;
  today: { year: number; month: number; day: number };
  onemli: OnemliGun[];
  setOnemli: (v: OnemliGun[]) => void;
  hatirlatma: boolean;
  setHatirlatma: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<YMD>(birthday ?? clamp({ year: 1995, month: 1, day: 1 }));
  const [ekle, setEkle] = useState<{ tur?: TurKey; duzenle?: OnemliGun } | null>(null);
  const [paylas, setPaylas] = useState<(PaylasHedef & { anahtar: string }) | null>(null);
  const [acik, setAcik] = useState<Gun | null>(null);
  const [fotolar, setFotolar] = useStored<Record<string, string>>('gunFotolari', {});
  const { width } = useWindowDimensions();

  const fotoEkle = async (anahtar: string) => {
    const u = await fotoSec(anahtar);
    if (u) setFotolar({ ...fotolar, [anahtar]: u });
    return u;
  };
  const hatirlatmaAc = async () => {
    const ok = await izinIste();
    if (ok || Platform.OS === 'web') setHatirlatma(true);
  };

  if (!birthday || editing) {
    return (
      <ScrollView contentContainerStyle={st.page}>
        <Text style={st.h1}>Doğum günün ne zaman?</Text>
        <Text style={st.p}>Kadran senin günlerini hatırlasın: doğduğun gün ve hayatının önemli günleri, o günlerin gazetesi ve şarkılarıyla.</Text>
        <Text style={st.big}>{draft.day} {AYLAR[draft.month - 1]} {draft.year}</Text>
        <DatePicker value={draft} onChange={setDraft} />
        <Bas style={st.primary} onPress={() => { setBirthday(draft); setEditing(false); }}>
          <Text style={st.primaryText}>Kaydet</Text>
        </Bas>
        {birthday && (
          <Pressable onPress={() => setEditing(false)} style={{ alignSelf: 'center', marginTop: 14 }}>
            <Text style={st.link}>Vazgeç</Text>
          </Pressable>
        )}
        <Text style={[st.small, { marginTop: 16, textAlign: 'center' }]}>Tarihlerin ve fotoğrafların sadece bu telefonda saklanır.</Text>
      </ScrollView>
    );
  }

  const bIso = isoOf(birthday.year, birthday.month, birthday.day);
  const ageDays = Math.floor((Date.now() - Date.parse(bIso + 'T00:00:00Z')) / 86400000);
  let age = today.year - birthday.year;
  if (today.month < birthday.month || (today.month === birthday.month && today.day < birthday.day)) age--;
  const t = themeForYear(birthday.year);
  const bugun = new Date(today.year, today.month - 1, today.day);
  const dogumSonraki = sonrakiYildonumu(birthday, bugun);

  const yaklasan = [
    { g: birthday as YMD, ikon: '🎂', baslik: `${dogumSonraki.yil}. yaş günün`, ...dogumSonraki },
    ...onemli.map((o) => { const s = sonrakiYildonumu(o, bugun); return { g: o as YMD, ikon: TURLER[o.tur].ikon, baslik: o.tur === 'cocuk' && o.ad ? `${o.ad} ${s.yil} yaşına giriyor` : o.tur === 'diger' && o.ad ? `${o.ad} · ${s.yil}. yıl` : TURLER[o.tur].yildonumu(s.yil), ...s }; }),
  ].filter((x) => x.yil > 0 && x.kalan <= 45).sort((a, b) => a.kalan - b.kalan)[0];

  // ızgara: doğum günü sabit ilk kare, sonra önemli günler (eskiden yeniye), sonra kaydedilen günler
  const gunler: Gun[] = [
    { anahtar: 'dogum', ymd: birthday, ikon: '🎂', baslik: 'Doğduğum gün', tur: 'dogum' },
    ...[...onemli].sort((a, b) => a.year - b.year || a.month - b.month || a.day - b.day)
      .map((o): Gun => ({ anahtar: o.id, ymd: { year: o.year, month: o.month, day: o.day }, ikon: TURLER[o.tur].ikon, baslik: gunAdi(o), tur: 'onemli', onemli: o })),
    ...saved.map((s): Gun => ({ anahtar: `kayit-${isoOf(s.year, s.month, s.day)}`, ymd: s, ikon: '⭐', baslik: 'Kaydettiğin gün', tur: 'kayit' })),
  ];
  const kare = (width - 36 - 8) / 3;
  const paylasAc = (g: Gun, sablon?: Sablon) => setPaylas({ ...g.ymd, baslik: g.baslik, ikon: g.ikon, foto: fotolar[g.anahtar] ?? null, anahtar: g.anahtar, sablon });

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>Benim Günlerim</Text>

      {yaklasan && (
        <Animated.View entering={FadeInUp}>
          <Pressable onPress={() => onTravel(yaklasan.g)} style={st.yaklasan}>
            <Text style={{ fontSize: 18 }}>{yaklasan.ikon}</Text>
            <Text style={st.yaklasanText} numberOfLines={1}>
              <Text style={{ color: AMBER }}>{kalanYazi(yaklasan.kalan)}{yaklasan.kalan === 0 ? ' 🎉' : ''}: </Text>{yaklasan.baslik}
            </Text>
            <Text style={[st.small, { color: AMBER }]}>›</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* doğum kartı — profil (değiştirilmedi) */}
      <Bas onPress={() => onTravel(birthday)} style={st.birthCard} scale={0.985}>
        <LinearGradient colors={[ERA_LIGHT[t.key][1], C.card]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={st.kicker}>DOĞDUĞUN GÜN · {t.label.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={[st.birthYear, { color: ERA_LIGHT[t.key][0] }]}>{birthday.year}</Text>
        <Text style={st.birthDate}>{birthday.day} {AYLAR[birthday.month - 1]}, {weekdayOf(bIso)}</Text>
        <View style={st.istat}>
          {[[String(age), 'yaşındasın'], [ageDays.toLocaleString('tr-TR'), 'gün yaşadın'], [String(dogumSonraki.kalan), dogumSonraki.kalan === 0 ? 'bugün doğum günün!' : 'gün sonra doğum günün']].map(([n, l], i) => (
            <View key={i} style={[{ flex: 1 }, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingLeft: 10 }]}>
              <Text style={{ fontFamily: F.serif, color: C.text, fontSize: 30 }}>{n}</Text>
              <Text style={{ fontFamily: F.r, color: C.faint, fontSize: 12 }}>{l}</Text>
            </View>
          ))}
        </View>
        <OzetSatirlari g={birthday} renk={ERA_LIGHT[t.key][0]} giris="Sen doğduğunda" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <View style={[st.birthGo, { backgroundColor: ERA_LIGHT[t.key][0] }]}>
            <Text style={{ color: '#111', fontFamily: F.b, fontSize: 15 }}>O güne ışınlan</Text>
          </View>
          <Bas onPress={() => paylasAc(gunler[0])} style={st.ghostBtn}>
            <Text style={st.ghostText}>Kartını paylaş</Text>
          </Bas>
        </View>
      </Bas>
      <Pressable onPress={() => { setDraft(birthday); setEditing(true); }} style={{ marginTop: 10 }}>
        <Text style={st.link}>Doğum gününü değiştir</Text>
      </Pressable>

      {/* ızgara */}
      <View style={st.izgaraBaslik}>
        <Text style={st.h2}>Günlerin</Text>
        <Bas onPress={() => setEkle({})} style={st.arti}><Text style={st.artiText}>＋</Text></Bas>
      </View>
      <View style={st.izgara}>
        {gunler.map((g, i) => (
          <Animated.View key={g.anahtar} entering={FadeIn.delay(i * 40)}>
            <Kare g={g} boy={kare} foto={fotolar[g.anahtar]} onPress={() => setAcik(g)} />
          </Animated.View>
        ))}
        {onemli.length === 0 && (['dugun', 'cocuk'] as TurKey[]).map((tk) => (
          <Pressable key={tk} onPress={() => setEkle({ tur: tk })} style={[st.oneriKare, { width: kare, height: kare }]}>
            <Text style={{ fontSize: 30 }}>{TURLER[tk].ikon}</Text>
            <Text style={st.oneriKareText}>{TURLER[tk].ad}?</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setEkle({})} style={[st.ekleKare, { width: kare, height: kare }]}>
          <Text style={st.ekleArti}>＋</Text>
          <Text style={st.ekleKareText}>Gün ekle</Text>
        </Pressable>
      </View>
      {onemli.length === 0 && (
        <Text style={[st.small, { marginTop: 12 }]}>Düğün, mezuniyet, çocuğunun doğumu… Her biri bir kare olur; o günün gazetesi ve şarkısıyla saklanır, istediğin an paylaşırsın.</Text>
      )}

      <Pressable onPress={() => (hatirlatma ? setHatirlatma(false) : hatirlatmaAc())} style={st.bildirim}>
        <Text style={{ fontSize: 16 }}>🔔</Text>
        <Text style={[st.small, { flex: 1, color: C.sub }]}>Yıldönümü bildirimleri</Text>
        <Text style={[st.small, { color: hatirlatma ? AMBER : C.faint, fontFamily: F.b }]}>{hatirlatma ? 'Açık' : 'Kapalı'}</Text>
      </Pressable>

      <GunSayfasi gun={acik} foto={acik ? fotolar[acik.anahtar] : undefined} bugun={bugun}
        onKapat={() => setAcik(null)}
        onPaylas={(g, sb) => { setAcik(null); setTimeout(() => paylasAc(g, sb), 350); }}
        onTravel={(g) => { setAcik(null); onTravel(g.ymd); }}
        onFoto={(g) => fotoEkle(g.anahtar)}
        onDuzenle={(g) => { setAcik(null); if (g.tur === 'dogum') { setDraft(birthday); setEditing(true); } else if (g.onemli) setTimeout(() => setEkle({ duzenle: g.onemli }), 350); }}
        onKaldir={(g) => { setAcik(null); removeSaved(g.ymd); }} />

      <EkleAkisi durum={ekle} onKapat={() => setEkle(null)} dogumYili={birthday.year} hatirlatma={hatirlatma}
        onKaydet={async (g, foto, hatirlat, paylasHemen) => {
          setOnemli([...onemli.filter((x) => x.id !== g.id), g]);
          if (foto) setFotolar({ ...fotolar, [g.id]: foto });
          if (hatirlat && !hatirlatma) hatirlatmaAc();
          setEkle(null);
          if (paylasHemen) setTimeout(() => setPaylas({ year: g.year, month: g.month, day: g.day, baslik: gunAdi(g), ikon: TURLER[g.tur].ikon, foto: foto ?? fotolar[g.id] ?? null, anahtar: g.id }), 400);
        }}
        onSil={(id) => { setOnemli(onemli.filter((x) => x.id !== id)); setEkle(null); }} />

      <PaylasKart hedef={paylas} onKapat={() => setPaylas(null)} onFotoEkle={paylas ? () => fotoEkle(paylas.anahtar) : undefined} />
    </ScrollView>
  );
}

/* ---------------- kare ---------------- */
function Kare({ g, boy, foto, onPress }: { g: Gun; boy: number; foto?: string; onPress: () => void }) {
  const oz = useOzet(g.ymd);
  const [bad, setBad] = useState(0);
  const yt = themeForYear(g.ymd.year);
  const [c1, c2] = ERA_LIGHT[yt.key];
  const adaylar = [foto, oz?.gazeteKucuk, oz?.gazete].filter(Boolean) as string[];
  const uri = adaylar[bad];
  return (
    <Bas onPress={onPress} style={{ width: boy, height: boy, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card2 }} scale={0.96}>
      <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setBad((b) => b + 1)} />}
      <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
      <Text style={st.kareIkon}>{g.ikon}</Text>
      <View style={st.kareAlt}>
        <Text style={st.kareYil}>{g.ymd.year}</Text>
        <Text style={st.kareAd} numberOfLines={1}>{g.baslik}</Text>
      </View>
    </Bas>
  );
}

/* ---------------- gün sayfası ---------------- */
function GunSayfasi({ gun, foto, bugun, onKapat, onPaylas, onTravel, onFoto, onDuzenle, onKaldir }: {
  gun: Gun | null; foto?: string; bugun: Date; onKapat: () => void;
  onPaylas: (g: Gun, sablon?: Sablon) => void; onTravel: (g: Gun) => void; onFoto: (g: Gun) => Promise<string | null>; onDuzenle: (g: Gun) => void; onKaldir: (g: Gun) => void;
}) {
  return (
    <Modal visible={!!gun} animationType="slide" presentationStyle="fullScreen" onRequestClose={onKapat}>
      {gun && <GunIcerik gun={gun} foto={foto} bugun={bugun} onKapat={onKapat} onPaylas={onPaylas} onTravel={onTravel} onFoto={onFoto} onDuzenle={onDuzenle} onKaldir={onKaldir} />}
    </Modal>
  );
}
function GunIcerik({ gun, foto, bugun, onKapat, onPaylas, onTravel, onFoto, onDuzenle, onKaldir }: {
  gun: Gun; foto?: string; bugun: Date; onKapat: () => void;
  onPaylas: (g: Gun, sablon?: Sablon) => void; onTravel: (g: Gun) => void; onFoto: (g: Gun) => Promise<string | null>; onDuzenle: (g: Gun) => void; onKaldir: (g: Gun) => void;
}) {
  const oz = useOzet(gun.ymd);
  const [yeniFoto, setYeniFoto] = useState<string | null>(null);
  const [bad, setBad] = useState(0);
  const yt = themeForYear(gun.ymd.year);
  const [c1, c2] = ERA_LIGHT[yt.key];
  const g = gun.ymd;
  const s = sonrakiYildonumu(g, bugun);
  const once = bugun.getFullYear() - g.year - (s.kalan > 0 && s.tarih.getFullYear() === bugun.getFullYear() ? 1 : 0);
  const adaylar = [yeniFoto ?? foto, oz?.gazete].filter(Boolean) as string[];
  const uri = adaylar[bad];
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={{ width, height: width * 1.15 }}>
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {uri && <Animated.Image entering={FadeIn.duration(500)} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setBad((b) => b + 1)} />}
          <LinearGradient colors={['rgba(7,8,10,0.35)', 'transparent', 'rgba(7,8,10,0.6)', C.bg]} locations={[0, 0.3, 0.75, 1]} style={StyleSheet.absoluteFill} />
          <View style={st.gsUst}>
            <Pressable onPress={onKapat} hitSlop={12} style={st.cam}><Text style={st.camText}>✕</Text></Pressable>
            {gun.tur === 'kayit'
              ? <Pressable onPress={() => onKaldir(gun)} hitSlop={12} style={[st.cam, { width: undefined, paddingHorizontal: 14 }]}><Text style={[st.camText, { fontSize: 13 }]}>Kaldır</Text></Pressable>
              : <Pressable onPress={() => onDuzenle(gun)} hitSlop={12} style={st.cam}><Text style={st.camText}>⋯</Text></Pressable>}
          </View>
          <View style={st.gsAlt}>
            <Animated.Text entering={FadeInDown.delay(100)} style={st.gsKicker}>{gun.ikon}  {gun.baslik.toLocaleUpperCase('tr-TR')}</Animated.Text>
            <Animated.Text entering={FadeInDown.delay(180)} style={st.gsTarih}>{g.day} {AYLAR[g.month - 1]} {g.year}</Animated.Text>
            <Text style={st.gsAltYazi}>{once > 0 ? `${once} yıl önce` : 'Bu yıl'} · {weekdayOf(isoOf(g.year, g.month, g.day))}{gun.tur !== 'kayit' && s.yil > 0 ? ` · yıldönümüne ${s.kalan === 0 ? 'bugün!' : `${s.kalan} gün`}` : ''}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18 }}>
          <Animated.View entering={FadeInUp.delay(250)}>
            <Bas onPress={() => onPaylas(gun)} style={st.insta}>
              <LinearGradient colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Text style={st.instaText}>Instagram'da paylaş</Text>
            </Bas>
          </Animated.View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Bas onPress={() => onTravel(gun)} style={[st.ikinci, { flex: 1 }]}><Text style={st.ikinciText}>O güne ışınlan</Text></Bas>
            <Bas onPress={async () => { const u = await onFoto(gun); if (u) { setYeniFoto(u); setBad(0); } }} style={[st.ikinci, { flex: 1 }]}>
              <Text style={st.ikinciText}>{yeniFoto || foto ? '📷 Fotoğrafı değiştir' : '📷 Fotoğrafını ekle'}</Text>
            </Bas>
          </View>

          <Text style={[st.kicker, { marginTop: 30, color: c1 }]}>O GÜN</Text>
          {oz === undefined ? <Text style={[st.small, { marginTop: 8 }]}>O günün kayıtları yükleniyor…</Text> : (
            <View style={st.gsKart}>
              {oz?.manset && <GsSatir ikon="📰" etiket="Gazetede" metin={oz.manset} />}
              {oz?.sarki && (
                <View>
                  <GsSatir ikon="🎵" etiket="Radyoda" metin={`${oz.sarki.title} · ${oz.sarki.artist}`} />
                  <Bas onPress={() => onPaylas(gun, 'plak')} style={st.sarkiPaylas}>
                    <Text style={st.sarkiPaylasText}>🎵 Şarkısıyla paylaş{(oz.sarkilar?.length ?? 0) > 1 ? ` · ${oz.sarkilar!.length} şarkıdan seç` : ''}</Text>
                  </Bas>
                </View>
              )}
              {oz?.dizi && <GsSatir ikon="📺" etiket="Ekranda" metin={oz.dizi} />}
              {oz?.dolar && <GsSatir ikon="💵" etiket="1 dolar" metin={`${g.year < 2005 ? oz.dolar.replace(/ TL$/, ' lira (eski para)') : oz.dolar}${oz.dolarKat && oz.dolarKat > 1.5 ? ` · 2026'da ${Math.round(oz.dolarKat).toLocaleString('tr-TR')} katı` : ''}`} />}
              {oz?.mac && <GsSatir ikon="⚽" etiket="Sahada" metin={oz.mac} />}
              {!oz?.manset && !oz?.sarki && !oz?.dolar && <Text style={st.small}>Bu gün için kayıt bulunamadı.</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
function GsSatir({ ikon, etiket, metin }: { ikon: string; etiket: string; metin: string }) {
  return (
    <View style={st.gsSatir}>
      <Text style={{ fontSize: 18, width: 26 }}>{ikon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={st.gsEtiket}>{etiket.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={st.gsMetin}>{metin}</Text>
      </View>
    </View>
  );
}

/* ---- doğum kartındaki kısa özet (değiştirilmedi) ---- */
function OzetSatirlari({ g, renk, giris }: { g: YMD; renk: string; giris?: string }) {
  const oz = useOzet(g);
  if (oz === undefined) return <View style={[st.ozet, { opacity: 0.4 }]}><Text style={st.small}>O günün kayıtları yükleniyor…</Text></View>;
  if (!oz || (!oz.manset && !oz.sarki && !oz.dolar)) return null;
  return (
    <Animated.View entering={FadeIn} style={st.ozet}>
      {giris && <Text style={[st.ozetGiris, { color: renk }]}>{giris.toLocaleUpperCase('tr-TR')}</Text>}
      {oz.manset && <OzetSatir ikon="📰" metin={oz.manset} />}
      {oz.sarki && <OzetSatir ikon="🎵" metin={`Radyoda “${oz.sarki.title}” · ${oz.sarki.artist}`} />}
      {oz.dolar && <OzetSatir ikon="💵" metin={`1 dolar ${g.year < 2005 ? oz.dolar.replace(/ TL$/, ' lira (eski para)') : oz.dolar}${oz.dolarKat && oz.dolarKat > 1.5 ? ` · 2026'da ${Math.round(oz.dolarKat).toLocaleString('tr-TR')} katı` : ''}`} />}
    </Animated.View>
  );
}
function OzetSatir({ ikon, metin }: { ikon: string; metin: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
      <Text style={{ fontSize: 14, width: 20 }}>{ikon}</Text>
      <Text style={st.ozetText} numberOfLines={2}>{metin}</Text>
    </View>
  );
}

/* ---------------- gün ekleme: 3 adım ---------------- */
function EkleAkisi({ durum, onKapat, onKaydet, onSil, dogumYili, hatirlatma }: {
  durum: { tur?: TurKey; duzenle?: OnemliGun } | null; onKapat: () => void;
  onKaydet: (g: OnemliGun, foto: string | null, hatirlat: boolean, paylas: boolean) => void; onSil: (id: string) => void; dogumYili: number; hatirlatma: boolean;
}) {
  return (
    <Modal visible={!!durum} animationType="slide" presentationStyle="pageSheet" onRequestClose={onKapat}>
      {durum && <EkleIcerik key={durum.duzenle?.id ?? durum.tur ?? 'yeni'} durum={durum} onKapat={onKapat} onKaydet={onKaydet} onSil={onSil} dogumYili={dogumYili} hatirlatma={hatirlatma} />}
    </Modal>
  );
}
function EkleIcerik({ durum, onKapat, onKaydet, onSil, dogumYili, hatirlatma }: {
  durum: { tur?: TurKey; duzenle?: OnemliGun }; onKapat: () => void;
  onKaydet: (g: OnemliGun, foto: string | null, hatirlat: boolean, paylas: boolean) => void; onSil: (id: string) => void; dogumYili: number; hatirlatma: boolean;
}) {
  const d = durum.duzenle;
  const [adim, setAdim] = useState<1 | 2 | 3>(d || durum.tur ? 2 : 1);
  const [tur, setTur] = useState<TurKey>(d?.tur ?? durum.tur ?? 'dugun');
  const [ad, setAd] = useState(d?.ad ?? '');
  const [tarih, setTarih] = useState<YMD>(d ? { year: d.year, month: d.month, day: d.day } : clamp({ year: Math.min(MAX.y, dogumYili + 25), month: 6, day: 15 }));
  const [foto, setFoto] = useState<string | null>(null);
  const [hatirlat, setHatirlat] = useState(true);
  const id = d?.id ?? `g${Date.now()}`;
  const yt = themeForYear(tarih.year);
  const renk = ERA_GLOW[yt.key];
  const ipucu = TURLER[tur].ipucu;
  const kayit = (): OnemliGun => ({ id, tur, ad: ad.trim() || undefined, ...tarih });
  const gunOnizleme: Gun = { anahtar: id, ymd: tarih, ikon: TURLER[tur].ikon, baslik: gunAdi(kayit()), tur: 'onemli' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={st.ekUst}>
          <Pressable onPress={adim > 1 && !d ? () => setAdim((adim - 1) as 1 | 2) : onKapat} hitSlop={10}><Text style={st.link}>{adim > 1 && !d ? '‹ Geri' : 'Vazgeç'}</Text></Pressable>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3].map((n) => <View key={n} style={[st.adimNokta, n <= adim && { backgroundColor: AMBER, width: n === adim ? 20 : 8 }]} />)}
          </View>
          <View style={{ width: 50 }} />
        </View>

        {adim === 1 && (
          <Animated.View entering={FadeIn}>
            <Text style={st.ekBaslik}>Ne oldu?</Text>
            <View style={st.turIzgara}>
              {(Object.keys(TURLER) as TurKey[]).map((k) => (
                <View key={k} style={{ width: '48.5%' }}>
                  <Bas onPress={() => { setTur(k); Haptics.selectionAsync().catch(() => {}); setAdim(2); }} style={st.turKart}>
                    <Text style={{ fontSize: 34 }}>{TURLER[k].ikon}</Text>
                    <Text style={st.turKartText}>{TURLER[k].ad}</Text>
                  </Bas>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {adim === 2 && (
          <Animated.View entering={FadeIn}>
            <Text style={st.ekBaslik}>{d ? 'Günü düzenle' : 'Ne zaman?'}</Text>
            <Pressable onPress={() => !d && setAdim(1)} style={st.secilenTur}>
              <Text style={{ fontSize: 22 }}>{TURLER[tur].ikon}</Text>
              <Text style={st.secilenTurText}>{TURLER[tur].ad}</Text>
              {!d && <Text style={[st.small, { color: AMBER }]}>Değiştir</Text>}
            </Pressable>
            {ipucu && <TextInput value={ad} onChangeText={setAd} placeholder={ipucu} placeholderTextColor={C.faint} style={st.input} maxLength={40} />}
            <Text style={[st.big, { color: renk }]}>{tarih.day} {AYLAR[tarih.month - 1]} {tarih.year}</Text>
            <DatePicker value={tarih} onChange={setTarih} accent={renk} />
            <Bas onPress={() => (d ? onKaydet(kayit(), null, hatirlatma, false) : setAdim(3))} style={[st.primary, { backgroundColor: renk }]}>
              <Text style={st.primaryText}>{d ? 'Kaydet' : 'Devam'}</Text>
            </Bas>
            {d && (
              <Pressable onPress={() => onSil(d.id)} style={{ alignSelf: 'center', marginTop: 22, padding: 10 }}>
                <Text style={[st.link, { color: '#FF6B6B' }]}>Bu günü sil</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {adim === 3 && (
          <Animated.View entering={FadeIn}>
            <Text style={st.ekBaslik}>Kartın hazır</Text>
            <Animated.View entering={ZoomIn.springify().damping(13)} style={{ alignItems: 'center', marginTop: 10 }}>
              <Kare g={gunOnizleme} boy={210} foto={foto ?? undefined} onPress={() => {}} />
            </Animated.View>
            <Bas onPress={async () => { const u = await fotoSec(id); if (u) setFoto(u); }} style={[st.ikinci, { marginTop: 20 }]}>
              <Text style={st.ikinciText}>{foto ? '📷 Fotoğrafı değiştir' : '📷 O günden bir fotoğrafını ekle (isteğe bağlı)'}</Text>
            </Bas>
            <View style={st.hatirlatSatir}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              <Text style={[st.rowTitle, { flex: 1 }]}>Her yıl bu gün haber ver</Text>
              <Switch value={hatirlat} onValueChange={setHatirlat} trackColor={{ true: AMBER, false: '#333' }} thumbColor="#fff" />
            </View>
            <Bas onPress={() => onKaydet(kayit(), foto, hatirlat, true)} style={[st.insta, { marginTop: 22 }]}>
              <LinearGradient colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Text style={st.instaText}>Kaydet ve paylaş</Text>
            </Bas>
            <Pressable onPress={() => onKaydet(kayit(), foto, hatirlat, false)} style={{ alignSelf: 'center', padding: 14 }}>
              <Text style={st.link}>Sadece kaydet</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: 18, paddingBottom: 140 },
  h1: { fontFamily: F.serif, color: C.text, fontSize: 44, marginTop: 6, marginBottom: 4 },
  h2: { fontFamily: F.serif, color: C.text, fontSize: 32 },
  p: { fontFamily: F.r, color: C.sub, fontSize: 16, lineHeight: 23 },
  big: { fontFamily: F.serif, color: AMBER, fontSize: 48, marginTop: 18 },
  small: { fontFamily: F.r, color: C.faint, fontSize: 13, lineHeight: 18 },
  link: { fontFamily: F.sb, color: AMBER, fontSize: 15 },
  primary: { backgroundColor: AMBER, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 24 },
  primaryText: { fontFamily: F.b, color: '#111', fontSize: 17 },
  kicker: { fontFamily: F.b, color: C.sub, fontSize: 11, letterSpacing: 2 },
  yaklasan: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  yaklasanText: { flex: 1, fontFamily: F.sb, color: C.text, fontSize: 14 },
  birthCard: { borderRadius: 26, padding: 20, marginTop: 14, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  birthYear: { fontFamily: F.serif, fontSize: 96, lineHeight: 102, letterSpacing: -3, marginTop: 4 },
  birthDate: { fontFamily: F.b, color: C.text, fontSize: 20 },
  istat: { flexDirection: 'row', marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingTop: 14 },
  birthGo: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  ghostBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  ghostText: { fontFamily: F.b, color: C.text, fontSize: 14 },
  ozet: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  ozetGiris: { fontFamily: F.b, fontSize: 10, letterSpacing: 1.8, marginBottom: 2 },
  ozetText: { flex: 1, fontFamily: F.m, color: C.text, fontSize: 14, lineHeight: 19 },
  // ızgara
  izgaraBaslik: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 12 },
  arti: { width: 40, height: 40, borderRadius: 20, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },
  artiText: { color: '#111', fontSize: 22, fontFamily: F.b, marginTop: -2 },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  kareIkon: { position: 'absolute', top: 8, left: 9, fontSize: 20 },
  kareAlt: { position: 'absolute', left: 9, right: 8, bottom: 8 },
  kareYil: { fontFamily: F.serif, color: '#fff', fontSize: 26, lineHeight: 28 },
  kareAd: { fontFamily: F.b, color: 'rgba(255,255,255,0.85)', fontSize: 10.5 },
  oneriKare: { borderRadius: 14, borderWidth: 1, borderColor: C.stroke, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 },
  oneriKareText: { fontFamily: F.sb, color: C.sub, fontSize: 11.5, textAlign: 'center' },
  ekleKare: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: AMBER + '99', alignItems: 'center', justifyContent: 'center', gap: 2 },
  ekleArti: { color: AMBER, fontSize: 30, fontFamily: F.b },
  ekleKareText: { fontFamily: F.b, color: AMBER, fontSize: 12 },
  bildirim: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  // gün sayfası
  gsUst: { position: 'absolute', top: 54, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  cam: { height: 38, width: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  camText: { color: '#fff', fontSize: 16, fontFamily: F.b },
  gsAlt: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  gsKicker: { fontFamily: F.b, color: 'rgba(255,255,255,0.9)', fontSize: 12, letterSpacing: 2 },
  gsTarih: { fontFamily: F.serif, color: '#fff', fontSize: 50, lineHeight: 54, marginTop: 4 },
  gsAltYazi: { fontFamily: F.m, color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 },
  gsKart: { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  gsSatir: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  gsEtiket: { fontFamily: F.b, color: C.faint, fontSize: 10, letterSpacing: 1.6 },
  gsMetin: { fontFamily: F.sb, color: C.text, fontSize: 16, lineHeight: 22, marginTop: 2 },
  insta: { borderRadius: 20, paddingVertical: 17, alignItems: 'center', overflow: 'hidden' },
  instaText: { fontFamily: F.b, color: '#fff', fontSize: 17 },
  ikinci: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  ikinciText: { fontFamily: F.b, color: C.text, fontSize: 13.5, textAlign: 'center' },
  // ekleme
  ekUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adimNokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  ekBaslik: { fontFamily: F.serif, color: C.text, fontSize: 40, marginTop: 22 },
  turIzgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  turKart: { backgroundColor: C.card, borderRadius: 20, paddingVertical: 20, alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  turKartText: { fontFamily: F.b, color: C.text, fontSize: 14, textAlign: 'center' },
  secilenTur: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 14 },
  secilenTurText: { flex: 1, fontFamily: F.b, color: C.text, fontSize: 16 },
  input: { marginTop: 12, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontFamily: F.m, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  hatirlatSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: C.card, borderRadius: 16, padding: 14 },
  rowTitle: { fontFamily: F.m, color: C.text, fontSize: 16 },
  sarkiPaylas: { alignSelf: 'flex-start', marginLeft: 26 + 10, marginTop: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  sarkiPaylasText: { fontFamily: F.b, color: C.text, fontSize: 12.5 },
});
