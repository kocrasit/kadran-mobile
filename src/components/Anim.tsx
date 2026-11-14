import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { AYLAR, yilEki } from '../data';
import { themeForYear } from '../theme';
import { Bas, C, ERA_LIGHT, F } from '../ui';

/**
 * Kullanıcının kendi anıları: "1987'de bugün ne yapıyordun?"
 * Şimdilik telefonda saklanır (anahtar: o günün tarihi). Arkadaş/aile odaları gelince aynı kayıtlar paylaşılacak.
 */
export interface Anim { id: string; t: string; ts: number }
export type Anilarim = Record<string, Anim[]>; // "1987-10-27" → anılar
const SINIR = 280;

/** Yıl ayracının altında: anı yoksa ince bir "ne yapıyordun?" satırı */
export function AniSor({ year, month, day, onYaz }: { year: number; month: number; day: number; onYaz: () => void }) {
  const c1 = ERA_LIGHT[themeForYear(year).key][0];
  return (
    <Pressable onPress={onYaz} style={st.sor}>
      <View style={[st.avatar, st.senAvatar]}><Text style={st.senHarf}>Sen</Text></View>
      <Text style={st.sorText}>{day} {AYLAR[month - 1]} {yilEki(year)} ne yapıyordun?</Text>
      <Text style={[st.sorIkon, { color: c1 }]}>✍️</Text>
    </Pressable>
  );
}

/** Kullanıcının anısı, akışta bir gönderi olarak */
export function AnimPost({ a, year, month, day, onSil }: { a: Anim; year: number; month: number; day: number; onSil: () => void }) {
  const [menu, setMenu] = useState(false);
  const c1 = ERA_LIGHT[themeForYear(year).key][0];
  const paylas = () => Share.share({ message: `${day} ${AYLAR[month - 1]} ${year}\n“${a.t}”\n\nKadran ile zamanda yolculuk ⏳` }).catch(() => {});
  return (
    <View style={st.post}>
      <View style={[st.avatar, st.senAvatar]}><Text style={st.senHarf}>Sen</Text></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={st.ad}>Sen</Text>
          <Text style={st.zaman}> · {day} {AYLAR[month - 1].slice(0, 3)} {year} · anı</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setMenu((v) => !v)} hitSlop={10}><Text style={st.uc}>⋯</Text></Pressable>
        </View>
        <Text style={st.metin}>{a.t}</Text>
        {menu && (
          <View style={st.menu}>
            <Pressable onPress={() => { setMenu(false); onSil(); }} hitSlop={6}><Text style={[st.menuText, { color: C.like }]}>Anıyı sil</Text></Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 10 }}>
          <Text style={[st.eylem, { color: c1 }]}>⏳ {new Date().getFullYear() - year} yıl önce</Text>
          <Pressable onPress={paylas} hitSlop={8}><Text style={st.eylem}>↗</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

/** Anı yazma penceresi */
export function AniYaz({ hedef, onKapat, onKaydet }: {
  hedef: { year: number; month: number; day: number } | null; onKapat: () => void; onKaydet: (t: string) => void;
}) {
  const [t, setT] = useState('');
  useEffect(() => { if (hedef) setT(''); }, [hedef?.year]);
  if (!hedef) return null;
  const c1 = ERA_LIGHT[themeForYear(hedef.year).key][0];
  const ornek = hedef.year < 1995 ? 'Babamla maça gitmiştik, dönüşte yağmur…' : hedef.year < 2010 ? 'Okuldan çıkıp internet kafeye koşmuştuk…' : 'O gün ilk işimin ilk günüydü…';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={st.perde} onPress={onKapat} />
        <View style={st.panel}>
          <View style={st.panelUst}>
            <Pressable onPress={onKapat} hitSlop={10}><Text style={st.vazgec}>Vazgeç</Text></Pressable>
            <Bas disabled={!t.trim()} onPress={() => onKaydet(t.trim())} style={[st.paylasBtn, { backgroundColor: c1, opacity: t.trim() ? 1 : 0.4 }]}>
              <Text style={st.paylasText}>Paylaş</Text>
            </Bas>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={[st.avatar, st.senAvatar]}><Text style={st.senHarf}>Sen</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.soru, { color: c1 }]}>{hedef.day} {AYLAR[hedef.month - 1]} {hedef.year}</Text>
              <TextInput value={t} onChangeText={(x) => setT(x.slice(0, SINIR))} autoFocus multiline
                placeholder={`O gün ne yapıyordun?\nÖrn. ${ornek}`} placeholderTextColor={C.faint} style={st.girdi} />
            </View>
          </View>
          <Text style={st.sayac}>{SINIR - t.length}</Text>
          <Text style={st.not}>Anıların şimdilik sadece bu telefonda saklanır. Arkadaş ve aile odaları gelince onlarla paylaşabileceksin.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  sor: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  sorText: { flex: 1, fontFamily: F.r, color: C.faint, fontSize: 15 },
  sorIkon: { fontSize: 18 },
  post: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, backgroundColor: 'rgba(255,176,0,0.04)' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  senAvatar: { backgroundColor: C.amber },
  senHarf: { fontFamily: F.xb, color: '#111', fontSize: 12 },
  ad: { fontFamily: F.b, color: C.text, fontSize: 15 },
  zaman: { fontFamily: F.r, color: C.faint, fontSize: 14 },
  uc: { color: C.faint, fontSize: 18, paddingHorizontal: 4 },
  metin: { fontFamily: F.r, color: C.text, fontSize: 16, lineHeight: 22, marginTop: 2 },
  menu: { alignSelf: 'flex-end', marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.card2 },
  menuText: { fontFamily: F.b, fontSize: 13 },
  eylem: { fontFamily: F.m, color: C.faint, fontSize: 13 },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 30 },
  panelUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vazgec: { fontFamily: F.m, color: C.text, fontSize: 15 },
  paylasBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999 },
  paylasText: { fontFamily: F.b, color: '#111', fontSize: 15 },
  soru: { fontFamily: F.b, fontSize: 14 },
  girdi: { fontFamily: F.r, color: C.text, fontSize: 18, lineHeight: 25, minHeight: 110, textAlignVertical: 'top', marginTop: 4 },
  sayac: { alignSelf: 'flex-end', fontFamily: F.m, color: C.faint, fontSize: 12 },
  not: { fontFamily: F.r, color: C.faint, fontSize: 12, marginTop: 10 },
});
