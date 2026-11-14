import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as FS from 'expo-file-system/legacy';
import { DayData, Ek, cikmisMi, fetchDay, fetchEkForYear, gazeteUrl, imageUrl, isoOf } from './data';
import { buildSlides } from './components/StoryViewer';
import { haberleriTopla } from './haberler';
import { GAZETE_TARAMA } from './ayarlar';

/* ================= önemli günler ================= */
export type TurKey = 'dugun' | 'tanisma' | 'mezuniyet' | 'cocuk' | 'asker' | 'is' | 'ev' | 'diger';
export interface OnemliGun { id: string; tur: TurKey; ad?: string; year: number; month: number; day: number }

export const TURLER: Record<TurKey, { ikon: string; ad: string; yildonumu: (n: number) => string; ipucu?: string }> = {
  dugun: { ikon: '💍', ad: 'Düğünümüz', yildonumu: (n) => `Evlilik yıldönümünüz · ${n}. yıl` },
  tanisma: { ikon: '❤️', ad: 'Tanıştığımız gün', yildonumu: (n) => `Tanışmanızın ${n}. yılı` },
  cocuk: { ikon: '👶', ad: 'Çocuğumun doğumu', yildonumu: (n) => `${n}. yaş günü`, ipucu: 'Adı (isteğe bağlı)' },
  mezuniyet: { ikon: '🎓', ad: 'Mezuniyetim', yildonumu: (n) => `Mezuniyetinin ${n}. yılı` },
  asker: { ikon: '🪖', ad: 'Askere gittiğim gün', yildonumu: (n) => `Askerliğin ${n}. yılı` },
  is: { ikon: '💼', ad: 'İlk işim', yildonumu: (n) => `İlk işinin ${n}. yılı` },
  ev: { ikon: '🏠', ad: 'Eve taşındığımız gün', yildonumu: (n) => `Bu evdeki ${n}. yılınız` },
  diger: { ikon: '✏️', ad: 'Başka bir gün', yildonumu: (n) => `${n}. yıl`, ipucu: 'Bu güne bir ad ver' },
};
export const gunAdi = (g: OnemliGun) =>
  g.tur === 'cocuk' && g.ad ? `${g.ad} doğdu` : g.tur === 'diger' && g.ad ? g.ad : TURLER[g.tur].ad;

/** Bir sonraki yıldönümü: kaç gün kaldı, kaçıncı yıl */
export function sonrakiYildonumu(g: { year: number; month: number; day: number }, bugun = new Date()) {
  const b = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  let n = new Date(b.getFullYear(), g.month - 1, g.day);
  if (n < b) n = new Date(b.getFullYear() + 1, g.month - 1, g.day);
  return { kalan: Math.round((n.getTime() - b.getTime()) / 86400000), yil: n.getFullYear() - g.year, tarih: n };
}

/* ================= günün özeti (kartlar ve paylaşım için) ================= */
export interface Sarki { title: string; artist: string; yt?: string; img?: string | null }
export interface Ozet { gazete?: string; gazeteKucuk?: string; manset?: string; basliklar?: string[]; sarki?: Sarki; sarkilar?: Sarki[]; dizi?: string; dolar?: string; dolarKat?: number; altin?: string; mac?: string }
/** "Senin İçin (Ferhat Göçer albümü)" → "Senin İçin" */
export const sarkiAdi = (t: string) => t.replace(/\s*\([^)]*(albüm|album|single|şarkı)[^)]*\)\s*$/i, '').trim();
const SON_GUN = '2026-06-25';
let sonP: Promise<DayData | null> | null = null;
const ozetCache = new Map<string, Promise<Ozet | null>>();

export function gunOzeti(year: number, month: number, day: number): Promise<Ozet | null> {
  const iso = isoOf(year, month, day);
  if (!ozetCache.has(iso)) {
    sonP ??= fetchDay(SON_GUN).catch(() => null);
    ozetCache.set(iso, Promise.all([fetchDay(iso), fetchEkForYear(year).catch(() => null as Ek | null), sonP]).then(([d, ek, son]) => {
      const o: Ozet = {};
      // o gün çıkmış şarkılar (arşivde bazen o tarihten sonra çıkan şarkılar da var)
      const sarkilar = (d?.music ?? []).filter((m) => m.title && m.artist && cikmisMi(m.note, iso))
        .map((m) => ({ title: sarkiAdi(m.title), artist: m.artist, yt: m.youtubeId ?? undefined, img: imageUrl(m.image, [m.title, m.artist]) }));
      if (sarkilar.length) { o.sarkilar = sarkilar.slice(0, 12); o.sarki = sarkilar[0]; }
      // Kadran Gazetesi için o günün Türkiye başlıkları
      if (d) o.basliklar = haberleriTopla(d, ek).filter((h) => h.scope === 'TR').slice(0, 6).map((h) => h.title);
      for (const s of buildSlides(d, ek, son, year)) {
        if (GAZETE_TARAMA && s.k === 'gazete' && !o.gazete) { o.gazete = gazeteUrl(s.iso); if (s.pages > 0) o.gazeteKucuk = gazeteUrl(s.iso, 1, true); }
        if (s.k === 'manset' && !o.manset) o.manset = s.title;
        if (s.k === 'sarki' && !o.sarki) o.sarki = { title: sarkiAdi(s.title), artist: s.artist, yt: s.yt };
        if (s.k === 'dizi' && !o.dizi) o.dizi = s.program;
        if (s.k === 'fiyat') for (const it of s.items) {
          if (it.label === 'Dolar') { o.dolar = it.value; o.dolarKat = it.kat; }
          if (it.label === 'Gram altın') o.altin = it.value;
        }
        if (s.k === 'mac' && !o.mac) o.mac = `${s.home} ${s.hs}-${s.as} ${s.away}`;
      }
      return o;
    }).catch(() => null));
  }
  return ozetCache.get(iso)!;
}
export function useOzet(g: { year: number; month: number; day: number } | null) {
  const [o, setO] = useState<Ozet | null | undefined>(undefined);
  const key = g ? isoOf(g.year, g.month, g.day) : '';
  useEffect(() => {
    if (!g) return; let canli = true; setO(undefined);
    gunOzeti(g.year, g.month, g.day).then((x) => canli && setO(x));
    return () => { canli = false; };
  }, [key]);
  return o;
}

/* ================= kullanıcının kendi fotoğrafları ================= */
/** Galeriden fotoğraf seçtirir, uygulamanın kalıcı klasörüne kopyalar; iptal edilirse null. */
export async function fotoSec(anahtar: string): Promise<string | null> {
  try {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted && Platform.OS !== 'web') return null;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
    if (r.canceled || !r.assets?.[0]?.uri) return null;
    const kaynak = r.assets[0].uri;
    if (Platform.OS === 'web' || !FS.documentDirectory) return kaynak;
    const klasor = FS.documentDirectory + 'gunler/';
    await FS.makeDirectoryAsync(klasor, { intermediates: true }).catch(() => {});
    const hedef = `${klasor}${anahtar.replace(/[^a-z0-9-]/gi, '_')}-${Date.now()}.jpg`;
    await FS.copyAsync({ from: kaynak, to: hedef });
    return hedef;
  } catch { return null; }
}

/* ================= hatırlatmalar ================= */
const ON_EK = 'kadran-yil-';
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {}
}

export async function izinIste(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const mevcut = await Notifications.getPermissionsAsync();
    if (mevcut.granted) return true;
    const r = await Notifications.requestPermissionsAsync();
    return r.granted;
  } catch { return false; }
}

/** Her gün için bir sonraki yıldönümünün sabahına (10:00) bildirim kurar; uygulama her açılışta yeniler. */
export async function hatirlatmalariKur(acik: boolean, dogum: { year: number; month: number; day: number } | null, onemli: OnemliGun[]) {
  if (Platform.OS === 'web') return;
  try {
    const kurulu = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(kurulu.filter((n) => n.identifier.startsWith(ON_EK)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!acik) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const liste: { id: string; g: { year: number; month: number; day: number }; baslik: (n: number) => string }[] = [];
    if (dogum) liste.push({ id: 'dogum', g: dogum, baslik: (n) => `🎂 Bugün doğum günün! ${n} yaşına girdin` });
    for (const o of onemli) liste.push({ id: o.id, g: o, baslik: (n) => o.tur === 'cocuk'
      ? `👶 ${o.ad ? o.ad : 'Çocuğun'} bugün ${n} yaşında!`
      : `${TURLER[o.tur].ikon} Bugün: ${o.tur === 'diger' && o.ad ? `${o.ad} · ${n}. yıl` : TURLER[o.tur].yildonumu(n)}` });
    const simdi = new Date();
    for (const x of liste) {
      let { tarih, yil } = sonrakiYildonumu(x.g, simdi);
      tarih = new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate(), 10, 0);
      if (tarih <= simdi) { tarih = new Date(tarih.getFullYear() + 1, tarih.getMonth(), tarih.getDate(), 10, 0); yil++; }
      if (yil <= 0) continue;
      let govde = 'O gün manşet neydi, radyoda ne çalıyordu? Işınlanmak için dokun.';
      try {
        const oz = await gunOzeti(x.g.year, x.g.month, x.g.day);
        if (oz?.sarki) govde = `${x.g.year}'de o gün radyoda “${oz.sarki.title}” çalıyordu. O güne ışınlan ›`;
        else if (oz?.manset) govde = `O gün: ${oz.manset.slice(0, 90)} · O güne ışınlan ›`;
      } catch {}
      await Notifications.scheduleNotificationAsync({
        identifier: ON_EK + x.id,
        content: { title: x.baslik(yil), body: govde, data: { iso: isoOf(x.g.year, x.g.month, x.g.day) } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tarih },
      });
    }
  } catch {}
}

/** Bildirime dokununca o güne ışınla */
export function useBildirimeDokununca(git: (iso: string) => void) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((r) => {
        const iso = r.notification.request.content.data?.iso;
        if (typeof iso === 'string') git(iso);
      });
      Notifications.getLastNotificationResponseAsync().then((r) => {
        const iso = r?.notification.request.content.data?.iso;
        if (typeof iso === 'string') git(iso);
      }).catch(() => {});
    } catch {}
    return () => sub?.remove();
  }, []);
}
