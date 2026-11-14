import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { EraTheme } from '../theme';

/**
 * Dönem nesneleri: görsel olsa da olmasa da kartlar "o yılların eşyası" gibi görünsün.
 *  Müzik  → 80'ler plak, 90'lar kaset, 2000'ler CD, sonrası albüm kapağı
 *  Dizi   → o dönemin televizyonu, köşede kanal logosu
 *  Film   → afiş
 *  Kişi   → polaroid
 */

/** Metinden sabit bir renk seç (aynı şarkı hep aynı renkte görünsün). */
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
const PALET: Record<EraTheme['key'], string[]> = {
  '80s': ['#B5362B', '#2F4858', '#C68B2C', '#5B3A29', '#3E6B48', '#7A2E4A'],
  '90s': ['#E30613', '#0057B8', '#FFB400', '#00936B', '#8E2BB5', '#FF5A1F'],
  '2000s': ['#1D5FA8', '#F28C00', '#2BA84A', '#7B3FA0', '#00A0C6', '#D9304F'],
  '2010s': ['#2F5BFF', '#FF4D6D', '#00B894', '#FDCB6E', '#6C5CE7', '#E17055'],
  '2020s': ['#A493FF', '#5EE6C4', '#FF8FAB', '#FFC857', '#4CC9F0', '#F72585'],
};
/** En uzun kelime kutuya sığsın diye yazı boyutunu küçült (kelime ortadan bölünmesin). */
export const sigdir = (text: string, width: number, base: number, ratio = 0.62) => {
  const enUzun = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return Math.max(9, Math.min(base, width / (enUzun * ratio)));
};
export const renk = (t: EraTheme, s: string, k = 0) => { const p = PALET[t.key]; return p[(hash(s) + k) % p.length]; };

function Foto({ uri, style, onFail }: { uri?: string | null; style: any; onFail: () => void }) {
  if (!uri) return null;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={onFail} />;
}

/* ---------------- Müzik ---------------- */

export function MuzikNesnesi({ t, uri, title, artist, size = 150 }: { t: EraTheme; uri?: string | null; title: string; artist: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const foto = uri && !bad;
  const c1 = renk(t, artist), c2 = renk(t, artist, 2);

  // Kapak: foto ya da tipografik kapak
  const kapak = (w: number, h: number, extra?: any) => (
    <View style={[{ width: w, height: h, backgroundColor: c1, overflow: 'hidden', justifyContent: 'flex-end' }, extra]}>
      {foto ? <Foto uri={uri} style={{ position: 'absolute', width: w, height: h }} onFail={() => setBad(true)} /> : (
        <>
          <View style={{ position: 'absolute', right: -w * 0.25, top: -w * 0.25, width: w * 0.9, height: w * 0.9, borderRadius: w, backgroundColor: c2, opacity: 0.85 }} />
          <View style={{ padding: 10 }}>
            <Text numberOfLines={2} style={{ fontFamily: t.head, color: '#fff', fontSize: sigdir(artist, w - 20, w * 0.15, t.headUpper ? 0.66 : 0.6), lineHeight: sigdir(artist, w - 20, w * 0.15, t.headUpper ? 0.66 : 0.6) * 1.12 }}>
              {t.headUpper ? artist.toLocaleUpperCase('tr-TR') : artist}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: t.body, color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>{title}</Text>
          </View>
        </>
      )}
    </View>
  );

  if (t.key === '80s' || t.key === '2000s') {
    // plak ya da CD kılıfından dışarı kaymış
    const disk = size * 0.92;
    const cd = t.key === '2000s';
    return (
      <View style={{ width: size, height: size }}>
        <View style={{ position: 'absolute', left: size * 0.16, top: (size - disk) / 2, width: disk, height: disk, borderRadius: disk / 2,
          backgroundColor: cd ? '#D7DEE7' : '#141414', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cd ? '#AFC0D2' : '#4A4A4A' }}>
          {(cd ? [0.86, 0.6] : [0.9, 0.78, 0.66, 0.54]).map((k) => (
            <View key={k} style={{ position: 'absolute', width: disk * k, height: disk * k, borderRadius: disk, borderWidth: 1,
              borderColor: cd ? 'rgba(130,170,255,0.45)' : 'rgba(255,255,255,0.08)' }} />
          ))}
          {cd && <View style={{ position: 'absolute', width: disk, height: disk / 2, top: 0, borderTopLeftRadius: disk, borderTopRightRadius: disk, backgroundColor: 'rgba(255,190,240,0.18)' }} />}
          <View style={{ width: disk * 0.34, height: disk * 0.34, borderRadius: disk, backgroundColor: cd ? '#F4F6F9' : c2, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: disk * 0.07, height: disk * 0.07, borderRadius: disk, backgroundColor: cd ? '#B9C6D6' : '#141414' }} />
          </View>
        </View>
        {kapak(size * 0.82, size * 0.82, { position: 'absolute', left: 0, top: size * 0.09, borderRadius: cd ? 3 : 1,
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 3, height: 3 }, elevation: 4 })}
      </View>
    );
  }

  if (t.key === '90s') {
    // kaset
    const w = size, h = size * 0.66;
    return (
      <View style={{ width: w, height: size, justifyContent: 'center' }}>
        <View style={{ width: w, height: h, backgroundColor: '#1E1E22', borderRadius: 7, padding: 6 }}>
          <View style={{ flex: 1, backgroundColor: foto ? '#fff' : c1, borderRadius: 3, overflow: 'hidden' }}>
            {foto && <Foto uri={uri} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.9 }} onFail={() => setBad(true)} />}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', marginHorizontal: 6, marginTop: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2 }}>
              <Text numberOfLines={1} style={{ fontFamily: t.ui, fontSize: 10, color: '#0F1B2D' }}>{artist}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: w * 0.18, marginTop: h * 0.1 }}>
              {[0, 1].map((k) => (
                <View key={k} style={{ width: h * 0.3, height: h * 0.3, borderRadius: h, backgroundColor: '#1E1E22', borderWidth: 3, borderColor: '#EDEDED', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: h * 0.1, height: h * 0.1, borderRadius: h, backgroundColor: '#EDEDED' }} />
                </View>
              ))}
            </View>
          </View>
          <View style={{ alignSelf: 'center', width: w * 0.55, height: h * 0.14, backgroundColor: '#2C2C31', borderTopLeftRadius: 4, borderTopRightRadius: 4, marginTop: 4 }} />
        </View>
      </View>
    );
  }

  // 2010'lar / 2020'ler: albüm kapağı
  return kapak(size, size, { borderRadius: t.key === '2020s' ? 14 : 10 });
}

/* ---------------- Dizi: dönemin televizyonu ---------------- */

const KANAL_KISA: [RegExp, string][] = [
  [/Türkiye Radyo Televizyon|^TRT\s*1|^TRT$/i, 'TRT 1'], [/TRT\s*2/i, 'TRT 2'], [/Kanal\s*D/i, 'kanal D'], [/Show/i, 'SHOW'],
  [/Star/i, 'STAR'], [/ATV/i, 'atv'], [/Kanal\s*6/i, 'KANAL 6'], [/Fox|FOX/i, 'FOX'], [/Inter\s*Star|Interstar/i, 'interSTAR'], [/TGRT/i, 'TGRT'],
  [/Samanyolu|STV/i, 'STV'], [/Cine\s*5/i, 'Cine5'], [/TV\s*8|TV8/i, 'tv8'], [/Netflix/i, 'NETFLIX'], [/BluTV/i, 'BluTV'], [/Exxen/i, 'exxen'], [/NOW/i, 'NOW'],
];
export const kanalKisa = (c?: string) => {
  if (!c || c === '—') return '';
  for (const [r, k] of KANAL_KISA) if (r.test(c)) return k;
  return c.length > 10 ? c.slice(0, 10) : c;
};

export function Televizyon({ t, uri, program, channel, width = 170 }: { t: EraTheme; uri?: string | null; program: string; channel?: string; width?: number }) {
  const [bad, setBad] = useState(false);
  const foto = uri && !bad;
  const eski = t.key === '80s' || t.key === '90s';
  const W = width, scrH = W * 0.62;
  const kasa = t.key === '80s' ? '#6B4A2E' : t.key === '90s' ? '#2A2B2F' : t.key === '2000s' ? '#B9C2CC' : '#111316';
  const kanal = kanalKisa(channel);
  const c1 = renk(t, program), c2 = renk(t, program, 3);

  const ekran = (
    <View style={{ height: scrH, borderRadius: eski ? 14 : 3, overflow: 'hidden', backgroundColor: c1 }}>
      {foto ? <Foto uri={uri} style={{ position: 'absolute', width: '100%', height: '100%' }} onFail={() => setBad(true)} /> : (
        <View style={{ flex: 1, justifyContent: 'center', padding: 10 }}>
          <View style={{ position: 'absolute', left: -20, bottom: -30, width: W * 0.8, height: W * 0.8, borderRadius: W, backgroundColor: c2, opacity: 0.6 }} />
          <Text numberOfLines={3} style={{ fontFamily: t.head, color: '#fff', fontSize: sigdir(program, W - 44, 19, t.key === '90s' ? 0.88 : t.headUpper ? 0.72 : 0.6), lineHeight: sigdir(program, W - 44, 19, t.key === '90s' ? 0.88 : t.headUpper ? 0.72 : 0.6) * 1.15, textAlign: 'center' }}>
            {t.headUpper ? program.toLocaleUpperCase('tr-TR') : program}
          </Text>
        </View>
      )}
      {/* tarama çizgileri ve yansıma (tüplü televizyonlarda) */}
      {eski && <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: scrH * 0.45, backgroundColor: 'rgba(255,255,255,0.10)', borderBottomLeftRadius: W, borderBottomRightRadius: W }} />}
      {!!kanal && (
        <View style={{ position: 'absolute', right: 6, top: 5, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
          <Text style={{ fontFamily: t.ui, color: '#fff', fontSize: 9, opacity: 0.9 }}>{kanal}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ width: W }}>
      <View style={{ backgroundColor: kasa, borderRadius: eski ? 12 : 6, padding: eski ? 9 : 4, paddingBottom: eski ? 9 : 4 }}>
        {t.key === '80s' && <View style={{ flexDirection: 'row' }}><View style={{ flex: 1 }}>{ekran}</View>
          <View style={{ width: 22, alignItems: 'center', gap: 6, paddingTop: 8 }}>
            {[0, 1].map((k) => <View key={k} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#D9C29A' }} />)}
            {[0, 1, 2].map((k) => <View key={'s' + k} style={{ width: 12, height: 2, backgroundColor: '#3E2A19' }} />)}
          </View></View>}
        {t.key !== '80s' && ekran}
        {t.key === '90s' && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 6 }}>
          {[0, 1, 2, 3].map((k) => <View key={k} style={{ width: 8, height: 4, borderRadius: 1, backgroundColor: k === 0 ? '#E30613' : '#4A4B50' }} />)}
        </View>}
      </View>
      {/* ayak */}
      {eski
        ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: W * 0.2 }}>
            {[0, 1].map((k) => <View key={k} style={{ width: 6, height: 8, backgroundColor: kasa, transform: [{ skewX: k ? '-20deg' : '20deg' }] }} />)}
          </View>
        : <View style={{ alignSelf: 'center', width: W * 0.28, height: 6, backgroundColor: kasa, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />}
    </View>
  );
}

/* ---------------- Film: afiş ---------------- */

export function Afis({ t, uri, title, width = 130 }: { t: EraTheme; uri?: string | null; title: string; width?: number }) {
  const [bad, setBad] = useState(false);
  const foto = uri && !bad;
  const W = width, H = W * 1.46;
  const c1 = renk(t, title), c2 = renk(t, title, 1);
  return (
    <View style={{ width: W, height: H, backgroundColor: c1, borderRadius: Math.min(t.radius, 8), overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
      {foto ? <Foto uri={uri} style={{ width: W, height: H }} onFail={() => setBad(true)} /> : (
        <View style={{ flex: 1, justifyContent: 'space-between', padding: 10 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: H * 0.18, height: H * 0.42, backgroundColor: c2, opacity: 0.75, transform: [{ skewY: '-12deg' }] }} />
          <Text style={{ fontFamily: t.ui, color: 'rgba(255,255,255,0.85)', fontSize: 9, letterSpacing: 2 }}>SİNEMALARDA</Text>
          <Text numberOfLines={4} style={{ fontFamily: t.head, color: '#fff', fontSize: sigdir(title, W - 20, 20, t.key === '90s' ? 0.88 : 0.7), lineHeight: sigdir(title, W - 20, 20, t.key === '90s' ? 0.88 : 0.7) * 1.1 }}>
            {title.toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ---------------- Kişi: polaroid ---------------- */

export function Polaroid({ t, uri, name, year, i = 0 }: { t: EraTheme; uri?: string | null; name: string; year?: number | null; i?: number }) {
  const [bad, setBad] = useState(false);
  const foto = uri && !bad;
  const S = 88;
  const parts = name.split(' ');
  const bas = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  const modern = t.key === '2010s' || t.key === '2020s';
  return (
    <View style={{ width: S + 14, backgroundColor: modern ? t.surface : '#FBFAF6', padding: 7, paddingBottom: 8, borderRadius: modern ? 12 : 1,
      transform: [{ rotate: modern ? '0deg' : `${(i % 3 - 1) * 2.5}deg` }],
      shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 1, height: 2 }, elevation: 3 }}>
      <View style={{ width: S, height: S, backgroundColor: renk(t, name), borderRadius: modern ? 8 : 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {foto ? <Foto uri={uri} style={{ width: S, height: S }} onFail={() => setBad(true)} />
          : <Text style={{ fontFamily: t.head, color: 'rgba(255,255,255,0.92)', fontSize: 30 }}>{bas.toLocaleUpperCase('tr-TR')}</Text>}
      </View>
      <Text numberOfLines={2} style={{ fontFamily: t.bodyBold, color: modern ? t.ink : '#222', fontSize: 12, lineHeight: 15, marginTop: 6, textAlign: 'center' }}>{name}</Text>
      {!!year && <Text style={{ fontFamily: t.body, color: modern ? t.muted : '#777', fontSize: 11, textAlign: 'center' }}>{year}</Text>}
    </View>
  );
}

/* ---------------- Takım renkleri ---------------- */

const TAKIM: [RegExp, string, string][] = [
  [/galatasaray/i, '#A90432', '#FDB912'], [/fenerbah/i, '#163962', '#FFED00'], [/beşiktaş|besiktas/i, '#111111', '#FFFFFF'],
  [/trabzon/i, '#7A1E30', '#4FB3E8'], [/bursa/i, '#00A651', '#FFFFFF'], [/ankaragüc|ankaraguc/i, '#003B7A', '#FFD200'],
  [/gençlerbir|genclerbir/i, '#E30A17', '#111111'], [/göztepe|goztepe/i, '#FFD200', '#E30A17'], [/altay/i, '#111111', '#FFFFFF'],
  [/kayseri/i, '#E30A17', '#FFD200'], [/sivas/i, '#E30A17', '#FFFFFF'], [/konya/i, '#00A651', '#FFFFFF'],
  [/kocaeli/i, '#00A651', '#111111'], [/denizli/i, '#00A651', '#111111'], [/gazian/i, '#E30A17', '#111111'],
  [/başakşehir|basaksehir|büyükşehir/i, '#F37021', '#1A2C5B'], [/rize/i, '#00A651', '#0057B8'], [/alanya/i, '#F37021', '#00A651'],
  [/antalya/i, '#E30A17', '#FFFFFF'], [/samsun/i, '#E30A17', '#FFFFFF'], [/kasımpaşa|kasimpasa/i, '#0057B8', '#FFFFFF'],
  [/eskişehir|eskisehir/i, '#E30A17', '#111111'], [/karşıyaka|karsiyaka/i, '#00A651', '#E30A17'], [/adana demir/i, '#0057B8', '#4FB3E8'],
  [/adanaspor/i, '#F37021', '#FFFFFF'], [/malatya/i, '#E30A17', '#FFD200'], [/hatay/i, '#7A1E30', '#FFFFFF'], [/sarıyer|sariyer/i, '#0057B8', '#FFFFFF'],
];
export function takimRenk(ad: string): [string, string] | null {
  for (const [r, a, b] of TAKIM) if (r.test(ad)) return [a, b];
  return null;
}

/** İki renkli küçük forma şeridi */
export function Forma({ ad, size = 14 }: { ad: string; size?: number }) {
  const r = takimRenk(ad);
  if (!r) return <View style={{ width: size, height: size }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 3, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(128,128,128,0.55)' }}>
      <View style={{ flex: 1, backgroundColor: r[0] }} /><View style={{ flex: 1, backgroundColor: r[1] }} />
    </View>
  );
}
