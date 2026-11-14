import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  DayData, cleanTitle, dataBaseUrl, fetchDay, formatGold, formatPop, formatTL, imageUrl, isNewsy, isoOf, looksTurkish, sortSports,
  Ek, enYakinMacGunu, fetchEkForYear, dizilerOnAir, haftaninOlaylari, iyiOlay, yilDuzeyi, yilEki, AYLAR, gununOlaylari, cumleMi,
} from '../data';
import { GazeteKart } from './Gazete';
import { KadranGazetesi } from './KadranGazetesi';
import { GAZETE_TARAMA } from '../ayarlar';
import { themeForYear } from '../theme';
import { Bas, C, ERA_LIGHT, F } from '../ui';
import { Forma, kanalKisa, sigdir } from './EraArt';
import { ayEvresi, burc } from '../gunBilgi';
import { fetchEk, weekdayOf, cikmisMi, gorsel, ligAdi, adTemizle, wpGorsel, wdGorsel, ARSIV_BASI, yakinMilliMac, eskiDolar } from '../data';
import { Haber, haberleriTopla } from '../haberler';

const SON_GUN = '2026-06-25';
const yt = (id?: string) => id && Linking.openURL(`https://www.youtube.com/watch?v=${id}`);

/** Bir günün gazetesi — sade, tek dil: koyu zemin, aynı tip kartlar, dönem rengi sadece vurguda. */
export function DayPaper({ year, month, day, onChapter }: {
  year: number; month: number; day: number; onChapter?: (name: string, y: number) => void;
}) {
  const [wrapY, setWrapY] = useState(0);
  const [chap, setChapState] = useState<Record<string, number>>({});
  const [son, setSon] = useState<DayData | null>(null);
  useEffect(() => { fetchDay(SON_GUN).then(setSon).catch(() => {}); }, []);
  useEffect(() => { for (const [n, y] of Object.entries(chap)) onChapter?.(n, wrapY + y); }, [wrapY, chap]);
  const setChap = (n: string, y: number) => setChapState((p) => (p[n] === y ? p : { ...p, [n]: y }));
  const iso = isoOf(year, month, day);
  const [data, setData] = useState<DayData | null>(null);
  const [ek, setEk] = useState<Ek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [fotolar, setFotolar] = useState<Foto[] | null>(null);
  // "O yıllarda elimizde": Türkiye'de o yıllarda evlerde olan aletler (kendi listemiz)
  const [aletler, setAletler] = useState<Alet[]>([]);
  useEffect(() => { fetchEk<any[]>('aletler.json').then((a) => setAletler(a ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true; setFotolar(null);
    if (year >= 2000 && year <= 2025) fetchEk<Foto[]>(`foto/${year}.json`).then((f) => alive && setFotolar(f ?? [])).catch(() => alive && setFotolar([]));
    return () => { alive = false; };
  }, [year]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([fetchDay(iso), fetchEkForYear(year)])
      .then(([d, e]) => { if (alive) { setData(d); setEk(e); } })
      .catch((e) => alive && setError(String(e?.message ?? e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [iso]);

  const c1 = ERA_LIGHT[themeForYear(year).key][0];
  if (loading) return <ActivityIndicator color={c1} style={{ marginVertical: 60 }} />;
  if (error || !data) {
    return (
      <View style={st.card}>
        <Text style={st.h3}>Bu güne ulaşılamadı</Text>
        <Text style={[st.body, { marginTop: 6 }]}>Bilgisayarda BASLAT penceresi açık olmalı; telefon ile bilgisayar aynı ağda olmalı.</Text>
        <Text style={[st.small, { marginTop: 8 }]}>{dataBaseUrl()} · {error}</Text>
      </View>
    );
  }
  return <View onLayout={(e) => setWrapY(e.nativeEvent.layout.y)}><Content d={data} ek={ek} year={year} c1={c1} setChap={setChap} son={son} fotolar={fotolar} aletler={aletler} /></View>;
}

type Alet = { a: string; n: string; wp: string; wl?: string; b: number; s?: number };
function Content({ d, ek, year, c1, setChap, son, fotolar, aletler }: {
  d: DayData; ek: Ek | null; year: number; c1: string; setChap: (n: string, y: number) => void; son: DayData | null; fotolar: Foto[] | null; aletler: Alet[];
}) {
  // --- haberler: görselli ve açıklamalı olaylar önde
  const wd = ek?.wd ?? null;
  const haberler = haberleriTopla(d, ek);
  const lead = haberler.find((h) => h.scope === 'TR' && h.img && h.body) ?? haberler.find((h) => h.scope === 'TR' && (h.img || h.body)) ?? haberler.find((h) => h.scope === 'TR') ?? haberler[0];
  const trGun = haberler.filter((h) => h.scope === 'TR' && h !== lead).slice(0, 12);
  const dunyaGun = haberler.filter((h) => h.scope !== 'TR' && h !== lead).slice(0, 10);
  const depremler = (ek?.gundem?.deprem[d.date] ?? []).slice(0, 4);
  const hafta = haftaninOlaylari(ek?.turkiye ?? null, d.date).slice(0, 6);
  const fotoSecim = fotolar ? fotoSec(fotolar, d.date) : null;

  // --- cüzdan
  const e = d.economy ?? {};
  const yeniAltin = (v: number) => (year < 2005 ? v / 1e6 : v);
  const buyuk: { label: string; value: string; kat?: number }[] = [];
  if (e.usdTry) buyuk.push({ label: 'Dolar', value: formatTL(e.usdTry.value, year), kat: son?.economy?.usdTry ? son.economy.usdTry.value / e.usdTry.value : undefined });
  if (e.goldGram) buyuk.push({ label: 'Gram altın', value: formatGold(e.goldGram.value, year), kat: son?.economy?.goldGram ? son.economy.goldGram.value / yeniAltin(e.goldGram.value) : undefined });
  const satir: [string, string][] = [];
  if (e.eurTry) satir.push(['Euro', formatTL(e.eurTry.value, year)]);
  if (d.population?.turkey) satir.push(['Türkiye nüfusu', formatPop(d.population.turkey.value)]);
  if (d.population?.world) satir.push(['Dünya nüfusu', formatPop(d.population.world.value)]);
  const hava = (d.weather ?? []).slice(0, 3);

  // --- ekran & ses
  const music = (d.music ?? []).filter((m) => cikmisMi(m.note, d.date)).slice(0, 10);
  const onAir = dizilerOnAir(ek?.diziler ?? [], d.date).map(([program, channel]) => ({ program, channel: channel ?? undefined, image: undefined }));
  const seen = new Set(onAir.map((x) => x.program.toLocaleLowerCase('tr-TR')));
  // arşivin TV kaydında yabancı kanallar da var (İsveç, ABD); sadece Türkiye kanalları
  const TR_KANAL = /TRT|atv|ATV|Show|Kanal ?D|Star|FOX|Fox|Kanal ?6|Kanal ?7|Samanyolu|STV|Flash|TV8|Habertürk|NTV|CNN Türk|Interstar|HBB|Cine ?5|TGRT|Beyaz|Kanal ?A|Kral|Number One|Netflix|BluTV|Exxen|Gain|puhu|TLC|DMAX/;
  const tv = [...onAir, ...(d.tv ?? []).filter((x) => !seen.has(x.program.replace(/\s*—.*$/, '').toLocaleLowerCase('tr-TR')) && TR_KANAL.test(x.channel ?? '') && looksTurkish(x.program))]
    .map((p) => ({ ...p, program: adTemizle(p.program) })).slice(0, 12);
  const cinema = (d.cinema ?? []).filter((c) => cikmisMi(c.note, d.date)).slice(0, 8);
  const culture = aletler.filter((x) => x.b <= year && (x.s ?? 9999) >= year).sort((a, b) => b.b - a.b).slice(0, 8)
    .map((x) => ({ title: x.a, note: x.n, uri: wpGorsel(x.wp, x.wl ?? 'en') }));

  // --- spor
  const [, mm, dd] = d.date.split('-').map(Number);
  const sport = sortSports(d.sports, dd, mm, year);
  const yakin = enYakinMacGunu(ek?.maclar ?? null, d.date);
  const lig = (yakin?.maclar ?? []).map(([home, away, hs, as]) => ({ home, away, hs: String(hs), as: String(as) }));
  const anahtar = (m: { home: string; hs: string; as: string }) => `${m.home.replace(/^MKE\s+/, '').split(' ')[0]}|${m.hs}|${m.as}`;
  const ligA = new Set(lig.map(anahtar));
  const maclar = [...lig, ...sport.matches.filter((m) => !ligA.has(anahtar(m)))].slice(0, 6);
  const macNot = yakin && yakin.fark !== 0 && lig.length ? `${Math.abs(yakin.fark)} gün ${yakin.fark > 0 ? 'sonra' : 'önce'} oynanan ${ligAdi(d.date)} maçları` : lig.length ? ligAdi(d.date) : sport.matches[0]?.detail;
  const champ = sport.standing[0]?.detail?.match(/Sezon şampiyonu:\s*(.+)$/)?.[1];
  const sezon = sport.standing[0]?.title.replace('⚽ ', '').replace('Süper Lig', ligAdi(d.date));

  // --- insanlar
  // doğumu ölümünden sonra görünen hatalı kayıtlar atılır (ör. "2000 doğumlu, 1993'te vefat")
  const olum = (wd?.olum[d.date] ?? []).filter((k) => !k.d || k.d < year);
  const vefatFoto = olum.filter((k) => k.img).slice(0, 10)
    .map((k) => ({ name: k.n, img: gorsel(k.img)!, j: k.j, yas: k.d ? year - k.d : null }));
  const vefat = [...(ek?.turkiye?.olum[d.date] ?? [])].filter((x) => !vefatFoto.some((k) => x.includes(k.name)));
  for (const k of olum) {
    if (k.img) continue;
    if (!vefat.some((x) => x.includes(k.n))) vefat.push(`${k.n}${k.j ? `, ${k.j}` : ''}${k.d ? ` (${k.d} doğumlu)` : ''}`);
  }
  const md = d.date.slice(5);
  const wdBirths = (wd?.dogum[md] ?? []).slice(0, 14).map((k) => ({ name: k.n, bornYear: Number(k.t.slice(0, 4)), image: k.img ? { url: k.img } : undefined, field: k.j, wd: true }));
  const turkish = (d.notableBirths ?? []).filter((p) => /Türk/.test(p.field ?? ''));
  const births = [...wdBirths, ...turkish, ...(d.notableBirths ?? []).filter((p) => !turkish.includes(p))]
    .filter((p, i, a) => a.findIndex((x) => x.name === p.name) === i && !((p.bornYear ?? 0) > year)).slice(0, 16);
  const yakinlik = (t: string) => (yilDuzeyi(t) ? 999 : Math.abs(Date.parse(t) - Date.parse(d.date)) / 86400000);
  // o tarihten sonra vizyona girenler/çıkanlar gösterilmez (yıl düzeyindeki kayıtlar kalır)
  const cikti = (t: string) => yilDuzeyi(t) || t.slice(0, 10) <= d.date;
  const yilFilm = [...(wd?.filmler[String(year)] ?? [])].filter((f) => cikti(f.t)).sort((a, b) => yakinlik(a.t) - yakinlik(b.t) || b.s - a.s).slice(0, 10);
  const yilAlbum = [...(wd?.muzik[String(year)] ?? [])].filter((f) => cikti(f.t)).sort((a, b) => yakinlik(a.t) - yakinlik(b.t) || b.s - a.s).slice(0, 10);
  const tarihYaz = (t: string) => (yilDuzeyi(t) ? t.slice(0, 4) : `${Number(t.slice(8, 10))} ${AYLAR[Number(t.slice(5, 7)) - 1]}`);
  const og = d.officialGazette;
  const sky = d.sky?.mediaType !== 'video' && d.sky?.imageUrl ? d.sky : null;

  // --- arşivden
  const searches = (d.topSearches?.terms ?? []).filter((x, i, a) => a.findIndex((y) => y.term === x.term) === i).slice(0, 5);
  // arşivdeki 2005 öncesi reklamların hepsi yabancı (ABD, İngiltere, Japonya): o yıllarda yalnızca adı Türkçe olanlar
  const ads = (d.ads ?? []).filter((a) => /[çğıöşüÇĞİÖŞÜ]/.test(a.brand) || (year >= 2005 && a.brand.split(/\s+/).length <= 3 && !/\b(Ad|Ads|Commercial|Movie|Trailer|Japanese|Promo)\b|'/i.test(a.brand))).slice(0, 6);
  const snaps = (d.webSnapshots ?? []).slice(0, 4);


  return (
    <View>
      <Chapter name="Kapak" onLayout={setChap}>
        {GAZETE_TARAMA && d.newspaperFront && <GazeteKart iso={d.date} front={d.newspaperFront} pages={d.newspaperPages} c1={c1} />}
        {!GAZETE_TARAMA && (lead || trGun.length > 0) && (
          <KadranGazetesiKart d={d} basliklar={[...(lead ? [lead] : []), ...trGun].slice(0, 4)} sarki={music[0]} c1={c1} />
        )}
        <BilgiSeridi d={d} year={year} c1={c1} />
        {year < ARSIV_BASI && <EskiYil d={d} ek={ek} year={year} c1={c1} bos={!lead && !trGun.length && !dunyaGun.length} />}
        {lead && <ManşetKart h={lead} tarih={trTarih(d.date)} c1={c1} />}
      </Chapter>

      <Chapter name="Gündem" onLayout={setChap}>
        {trGun.length > 0 && (
          <Section title="Türkiye'de bu gün" kicker={`${yilEki(year)} bugün`}>
            <HaberListesi list={trGun} c1={c1} />
          </Section>
        )}
        {dunyaGun.length > 0 && (
          <Section title="Dünyada bu gün" kicker="O gün dünyada">
            <HaberListesi list={dunyaGun} c1={c1} />
          </Section>
        )}
        {hafta.length > 0 && (
          <Section title="O hafta Türkiye'de" kicker="Birkaç gün önce ve sonra">
            <View style={st.card}>
              {hafta.map((h, i) => (
                <View key={'h' + i} style={[st.row, i > 0 && st.rowLine]}>
                  <Text style={[st.tag, { color: c1 }]}>{h.fark > 0 ? `${h.fark} GÜN SONRA` : `${-h.fark} GÜN ÖNCE`}</Text>
                  <Text style={st.rowTitle}>{h.text}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}
        {fotoSecim && fotoSecim.list.length >= 3 && (
          <Section title={fotoSecim.gunun ? 'O gün çekilen kareler' : `${yilEki(year)} Türkiye'den kareler`} kicker={fotoSecim.gunun ? 'Fotoğraflarla o gün' : 'Fotoğraflarla o yıl'}>
            <FotoIzgara list={fotoSecim.list} c1={c1} />
          </Section>
        )}
      </Chapter>

      {depremler.length > 0 && (
        <Section title="Deprem" kicker={`O gün Türkiye'de · ${ek?.gundem?.depremKaynak ?? 'USGS'} kataloğu`}>
          <View style={[st.card, depremler[0].m >= 6 && { borderColor: '#FF6B4A' }]}>
            {depremler.map((q, i) => (
              <View key={i} style={[st.kv, i > 0 && st.rowLine]}>
                <Text style={{ fontFamily: F.serif, color: q.m >= 6 ? '#FF8A70' : q.m >= 5 ? c1 : C.text, fontSize: i === 0 ? 44 : 28, width: i === 0 ? 86 : 62 }}>{q.m.toLocaleString('tr-TR')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitleSm}>{q.yer}</Text>
                  <Text style={st.small}>Saat {q.saat}{q.dr ? ` · ${q.dr} km derinlik` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      )}

      {og && (
        <Section title="Resmî Gazete" kicker={`O gün yayımlanan sayı${og.issueNumber ? ` · ${og.issueNumber}` : ''}`}>
          <View style={st.card}>
            {og.items.slice(0, 5).map((it, i) => (
              <Pressable key={i} disabled={!it.url} onPress={() => it.url && Linking.openURL(it.url)} style={[st.row, i > 0 && st.rowLine]}>
                <Text style={[st.tag, { color: c1 }]}>{it.section.toLocaleUpperCase('tr-TR')}</Text>
                <Text style={st.rowTitleSm}>{it.title}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => Linking.openURL(og.pdfUrl ?? og.fihristUrl)} style={[st.kv, og.items.length > 0 && st.rowLine]}>
              <Text style={st.body}>{og.itemCount > 5 ? `${og.itemCount} maddenin tamamı` : og.items.length ? 'Sayının tamamı' : 'O günün sayısını aç'}</Text>
              <Text style={[st.small, { color: c1 }]}>Aç ↗</Text>
            </Pressable>
          </View>
        </Section>
      )}

      <Chapter name="Cüzdan" onLayout={setChap}>
        {(buyuk.length > 0 || satir.length > 0 || hava.length > 0) && (
          <Section title="Cüzdan" kicker="O gün fiyatlar">
            <View style={st.card}>
              <View style={{ flexDirection: 'row' }}>
                {buyuk.map((x, i) => (
                  <View key={i} style={[{ flex: 1 }, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingLeft: 16 }]}>
                    <Text style={st.small}>{x.label}</Text>
                    <Text style={[st.money, x.value.length > 10 && { fontSize: 26 }]} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
                    {x.kat && x.kat > 1.2 ? (
                      <Text style={[st.small, { color: c1 }]}>2026'da {x.kat.toLocaleString('tr-TR', { maximumFractionDigits: x.kat < 10 ? 1 : 0 })} kat</Text>
                    ) : null}
                  </View>
                ))}
              </View>
              {satir.map(([l, v], i) => (
                <View key={l} style={[st.kv, (i > 0 || buyuk.length > 0) && st.rowLine]}>
                  <Text style={st.body}>{l}</Text><Text style={st.kvVal}>{v}</Text>
                </View>
              ))}
              {hava.length > 0 && (
                <View style={[st.kv, st.rowLine]}>
                  {hava.map((w) => (
                    <View key={w.city} style={{ flex: 1 }}>
                      <Text style={st.small}>{w.city}</Text>
                      <Text style={st.kvVal}>{w.tempMax}°</Text>
                      {!!w.condition && <Text style={[st.small, { fontSize: 12 }]} numberOfLines={1}>{w.condition}</Text>}
                    </View>
                  ))}
                </View>
              )}
              {year < 2005 && buyuk.length > 0 && <Text style={[st.small, { marginTop: 12 }]}>2005'te liradan altı sıfır atıldı; "kat" karşılaştırması yeni TL ile.</Text>}
            </View>
          </Section>
        )}
      </Chapter>

      <Chapter name="Ekran & Ses" onLayout={setChap}>
        {music.length > 0 && (
          <Section title="Radyoda" kicker="O günlerin şarkıları">
            <Rail>
              {music.map((m, i) => (
                <Bas key={i} onPress={() => yt(m.youtubeId)} disabled={!m.youtubeId} style={{ width: 148 }}>
                  <Cover uri={imageUrl(m.image, [m.title, m.artist])} title={m.artist} c1={c1} w={148} h={148} />
                  <Text style={st.cardTitle} numberOfLines={1}>{m.title}</Text>
                  <Text style={st.small} numberOfLines={1}>{m.artist}{m.youtubeId ? '  ▶' : ''}</Text>
                </Bas>
              ))}
            </Rail>
          </Section>
        )}
        {yilAlbum.length > 0 && (
          <Section title={`${yilEki(year)} çıkan albümler`} kicker="Plak raflarında">
            <Rail>
              {yilAlbum.map((a, i) => (
                <View key={i} style={{ width: 148 }}>
                  <Cover uri={gorsel(a.img) ?? wdGorsel(a.q)} title={a.sanatci ?? a.n} c1={c1} w={148} h={148} />
                  <Text style={st.cardTitle} numberOfLines={1}>{a.n.replace(/\s*\((?:albüm|album)[^)]*\)/i, '')}</Text>
                  <Text style={st.small} numberOfLines={1}>{a.sanatci ?? ''} · {tarihYaz(a.t)}</Text>
                </View>
              ))}
            </Rail>
          </Section>
        )}
        {tv.length > 0 && (
          <Section title="Ekranda" kicker={onAir.length ? 'Bu sezon yayında' : 'Bu akşam'}>
            <Rail>
              {tv.map((p, i) => (
                <View key={i} style={{ width: 220 }}>
                  <Cover uri={imageUrl(p.image, [p.program])} title={p.program} c1={c1} w={220} h={130} badge={kanalKisa(p.channel)} />
                  <Text style={st.cardTitle} numberOfLines={1}>{p.program}</Text>
                  {!!p.channel && p.channel !== '—' && <Text style={st.small} numberOfLines={1}>{p.channel.replace('Türkiye Radyo Televizyon Kurumu', 'TRT')}</Text>}
                </View>
              ))}
            </Rail>
          </Section>
        )}
        {cinema.length > 0 && (
          <Section title="Vizyonda" kicker="Sinemalarda">
            <Rail>
              {cinema.map((c, i) => (
                <Bas key={i} onPress={() => yt(c.youtubeId)} disabled={!c.youtubeId} style={{ width: 124 }}>
                  <Cover uri={imageUrl(c.image, [c.title])} title={c.title} c1={c1} w={124} h={182} />
                  <Text style={st.cardTitle} numberOfLines={2}>{c.title}</Text>
                  {c.youtubeId && <Text style={[st.small, { color: c1 }]}>Fragman ▶</Text>}
                </Bas>
              ))}
            </Rail>
          </Section>
        )}
        {yilFilm.length > 0 && (
          <Section title={`${yilEki(year)} o güne kadar vizyona girenler`} kicker="Türk sineması">
            <Rail>
              {yilFilm.map((f, i) => (
                <View key={i} style={{ width: 124 }}>
                  <Cover uri={gorsel(f.img) ?? wdGorsel(f.q)} title={f.n} c1={c1} w={124} h={182} />
                  <Text style={st.cardTitle} numberOfLines={2}>{f.n.replace(/\s*\((?:film)[^)]*\)/i, '')}</Text>
                  <Text style={st.small} numberOfLines={1}>{f.yon ?? ''}{f.yon ? ' · ' : ''}{tarihYaz(f.t)}</Text>
                </View>
              ))}
            </Rail>
          </Section>
        )}
        {culture.length > 0 && (
          <Section title="O yıllarda elimizde" kicker="Dönemin eşyaları">
            <Rail>
              {culture.map((c, i) => (
                <View key={i} style={{ width: 200 }}>
                  <Cover uri={c.uri} title={c.title} c1={c1} w={200} h={120} />
                  <Text style={st.cardTitle} numberOfLines={1}>{c.title}</Text>
                  {c.note && <Text style={st.small} numberOfLines={2}>{c.note}</Text>}
                </View>
              ))}
            </Rail>
          </Section>
        )}
      </Chapter>

      <Chapter name="Saha" onLayout={setChap}>
        {(maclar.length > 0 || champ) && (
          <Section title="Saha" kicker={sezon ? `${sezon} sürüyor` : 'Maç sonuçları'}>
            <View style={st.card}>
              {maclar.map((m, i) => (
                <View key={i} style={[st.match, i > 0 && st.rowLine]}>
                  <View style={st.side}><Text style={[st.team, { textAlign: 'right' }]} numberOfLines={1}>{m.home}</Text><Forma ad={m.home} size={16} /></View>
                  <Text style={st.score}>{m.hs}<Text style={{ color: C.faint }}> – </Text>{m.as}</Text>
                  <View style={[st.side, { justifyContent: 'flex-start' }]}><Forma ad={m.away} size={16} /><Text style={st.team} numberOfLines={1}>{m.away}</Text></View>
                </View>
              ))}
              {macNot && maclar.length > 0 ? <Text style={[st.small, { textAlign: 'center', marginTop: 10 }]}>{macNot}</Text> : null}
              {champ && (
                <View style={[st.kv, maclar.length > 0 && st.rowLine]}>
                  <Text style={st.body}>🏆 Sezonun şampiyonu</Text><Text style={[st.kvVal, { color: c1 }]}>{champ}</Text>
                </View>
              )}
            </View>
          </Section>
        )}
      </Chapter>

      <Chapter name="İnsanlar" onLayout={setChap}>
        {births.length > 0 && (
          <Section title="Bu tarihte doğanlar" kicker="Doğum günleri">
            <Rail gap={16}>
              {births.map((p, i) => (
                <View key={i} style={{ width: 84, alignItems: 'center' }}>
                  <Avatar uri={imageUrl(p.image, (p as any).wd ? undefined : [p.name])} name={p.name} c1={c1} />
                  <Text style={[st.small, { color: C.text, textAlign: 'center', marginTop: 8 }]} numberOfLines={2}>{p.name}</Text>
                  {!!p.bornYear && <Text style={[st.small, { textAlign: 'center', fontSize: 12 }]}>{p.bornYear}</Text>}
                  {!!(p as any).field && (p as any).field.length < 28 && <Text style={[st.small, { textAlign: 'center', fontSize: 11, color: c1 }]} numberOfLines={1}>{(p as any).field}</Text>}
                </View>
              ))}
            </Rail>
          </Section>
        )}
        {(vefat.length > 0 || vefatFoto.length > 0) && (
          <Section title="Anma" kicker="Bu gün aramızdan ayrılanlar">
            {vefatFoto.length > 0 && (
              <Rail gap={12}>
                {vefatFoto.map((k, i) => (
                  <View key={i} style={{ width: 132 }}>
                    <View style={{ width: 132, height: 164, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card2 }}>
                      <Img uri={k.img} style={{ width: 132, height: 164 }} />
                    </View>
                    <Text style={st.cardTitle} numberOfLines={2}>{k.name}</Text>
                    <Text style={st.small} numberOfLines={2}>{[k.j, k.yas && k.yas > 0 && k.yas < 120 ? `${k.yas} yaşında` : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
              </Rail>
            )}
            {vefat.length > 0 && (
              <View style={[st.card, vefatFoto.length > 0 && { marginTop: 14 }]}>
                {vefat.map((v, i) => <Text key={i} style={[st.body, i > 0 && st.rowLine, { paddingVertical: 10 }]}>{v}</Text>)}
              </View>
            )}
          </Section>
        )}
        {sky && (
          <Section title="O gece gökyüzü" kicker="NASA · günün uzay fotoğrafı">
            <Bas onPress={() => sky.sources?.[0]?.url && Linking.openURL(sky.sources[0].url)} style={[st.card, { padding: 0, overflow: 'hidden' }]}>
              <Img uri={sky.imageUrl} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000' }} />
              <View style={{ padding: 16 }}>
                <Text style={st.rowTitle}>{sky.title}</Text>
                <Text style={[st.small, { marginTop: 4 }]}>Astronomy Picture of the Day · dokun, açıklamasını oku ↗</Text>
              </View>
            </Bas>
          </Section>
        )}
        {ads.length > 0 && (
          <Section title="Reklam arası" kicker="O yılların reklam filmleri">
            <Rail>
              {ads.map((a, i) => {
                const link = a.youtubeId ? `https://www.youtube.com/watch?v=${a.youtubeId}` : a.videoUrl;
                return (
                  <Bas key={i} onPress={() => link && Linking.openURL(link)} disabled={!link} style={{ width: 220 }}>
                    <Cover uri={imageUrl(a.image, [a.brand])} title={a.brand} c1={c1} w={220} h={130} badge={link ? '▶ İZLE' : undefined} />
                    <Text style={st.cardTitle} numberOfLines={1}>{a.brand}</Text>
                    {!!a.note && <Text style={st.small} numberOfLines={1}>{a.note}</Text>}
                  </Bas>
                );
              })}
            </Rail>
          </Section>
        )}
        {(searches.length > 0 || snaps.length > 0) && (
          <Section title="Arşivden" kicker="Küçük notlar">
            <View style={st.card}>
              {searches.length > 0 && (
                <View>
                  <Text style={st.small}>{d.topSearches?.year} yılında Google'da en çok arananlar</Text>
                  <Text style={[st.body, { color: C.text, marginTop: 6 }]}>{searches.map((x, i) => `${i + 1}. ${x.term}`).join('   ')}</Text>
                </View>
              )}
              {snaps.map((w, i) => (
                <Pressable key={'w' + i} onPress={() => Linking.openURL(w.snapshotUrl)} style={[st.kv, (i > 0 || searches.length > 0) && st.rowLine]}>
                  <View style={{ flex: 1 }}><Text style={st.small}>O gün internette</Text><Text style={st.rowTitleSm}>{w.site}</Text></View>
                  <Text style={[st.small, { color: c1 }]}>Aç ↗</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}
      </Chapter>

      <Text style={[st.small, { marginTop: 36, textAlign: 'center' }]}>
        Kaynaklar: Kadran veri arşivi{ek?.turkiye ? ', Vikipedi (CC BY-SA 4.0)' : ''}{ek?.maclar ? ', engsoccerdata' : ''}
      </Text>
    </View>
  );
}

/* ---------------- haberler ---------------- */

const trTarih = (iso: string) => `${Number(iso.slice(8, 10))} ${AYLAR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** O günün bilgi şeridi: gün, hava, ay, burç, Hicri tarih, nüfus */
function BilgiSeridi({ d, year, c1 }: { d: DayData; year: number; c1: string }) {
  const [, m, g] = d.date.split('-').map(Number);
  const ay = ayEvresi(year, m, g);
  const b = burc(m, g);
  const hava = d.weather?.find((w) => w.city === 'İstanbul') ?? d.weather?.[0];
  const parca: [string, string, string][] = [
    ['📅', 'Günlerden', weekdayOf(d.date)],
    ...(hava && hava.tempMax != null ? [['🌤️', hava.city, `${hava.tempMax}° / ${hava.tempMin}°${hava.condition ? ` · ${hava.condition}` : ''}`] as [string, string, string]] : []),
    [ay.emoji, 'Gökyüzünde', `${ay.ad} · %${ay.aydinlik}`],
    [b.sembol, 'Burç', b.ad],
    ...(d.islamic?.hijriDate ? [['☪️', 'Hicri', d.islamic.hijriDate] as [string, string, string]] : []),
    ...(d.population?.turkey ? [['👥', 'Türkiye', `${formatPop(d.population.turkey.value)} kişi`] as [string, string, string]] : []),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18, marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 18 }}>
      {parca.map(([ikon, etiket, deger]) => (
        <View key={etiket} style={st.pill}>
          <Text style={{ fontSize: 18 }}>{ikon}</Text>
          <View>
            <Text style={st.pillEtiket}>{etiket.toLocaleUpperCase('tr-TR')}</Text>
            <Text style={st.pillDeger} numberOfLines={1}>{deger}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Görseli olmayan haber için eski gazete kupürü */
function Kupur({ title, scope, tarih, buyuk }: { title: string; scope: 'TR' | 'world'; tarih: string; buyuk?: boolean }) {
  const fs = buyuk ? sigdir(title, 300, 30, 0.5) : sigdir(title, 260, 22, 0.5);
  return (
    <LinearGradient colors={['#F6EFE2', '#EFE6D4', '#E5D9C2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.kupur, buyuk && { minHeight: 210 }]}>
      <View style={st.kupurUst}>
        <Text style={st.kupurEtiket}>{scope === 'TR' ? 'TÜRKİYE' : 'DÜNYA'}</Text>
        <Text style={st.kupurTarih}>{tarih.toLocaleUpperCase('tr-TR')}</Text>
      </View>
      <Text style={[st.kupurBaslik, { fontSize: fs, lineHeight: fs * 1.12 }]} numberOfLines={buyuk ? 5 : 4}>{title}</Text>
      <Text style={st.kupurAlt}>📰 GAZETE KUPÜRÜ · O GÜNÜN HABERİ</Text>
    </LinearGradient>
  );
}

function ManşetKart({ h, tarih, c1 }: { h: Haber; tarih: string; c1: string }) {
  const [acik, setAcik] = useState(false);
  const [imgBad, setImgBad] = useState(false);
  const fs = sigdir(h.title, 300, h.title.length > 80 ? 26 : 32, 0.46);
  return (
    <View style={[st.card, { padding: 0, overflow: 'hidden', marginTop: 16 }]}>
      {h.img && !imgBad
        ? <Image source={{ uri: h.img }} style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: C.card2 }} resizeMode="cover" onError={() => setImgBad(true)} />
        : <Kupur title={h.title} scope={h.scope} tarih={tarih} buyuk />}
      <View style={{ padding: 20 }}>
        <Text style={[st.kicker, { color: c1 }]}>{h.scope === 'TR' ? 'GÜNÜN MANŞETİ · TÜRKİYE' : 'GÜNÜN MANŞETİ · DÜNYA'}</Text>
        {(h.img && !imgBad) && <Text style={[st.headline, { fontSize: fs, lineHeight: fs * 1.1 }]}>{h.title}</Text>}
        {h.body && (
          <Pressable onPress={() => setAcik(!acik)}>
            <Text style={[st.body, { marginTop: 10, color: C.text, opacity: 0.85 }]} numberOfLines={acik ? undefined : 4}>{h.body}</Text>
            {h.body.length > 180 && <Text style={[st.small, { color: c1, marginTop: 6 }]}>{acik ? 'Kısalt' : 'Devamını oku'}</Text>}
          </Pressable>
        )}
        {h.kaynak && <Text style={[st.small, { marginTop: 10 }]}>Kaynak: {h.kaynak}</Text>}
      </View>
    </View>
  );
}

/** Zengin haber listesi: görselli/açıklamalı olanlar kart, kalanlar sade satır */
function HaberListesi({ list, c1 }: { list: Haber[]; c1: string }) {
  const zengin = list.filter((h) => h.img || h.body);
  const sade = list.filter((h) => !h.img && !h.body);
  return (
    <View style={{ gap: 12 }}>
      {zengin.map((h, i) => <HaberKart key={'z' + i} h={h} c1={c1} />)}
      {sade.length > 0 && (
        <View style={st.card}>
          {sade.map((h, i) => (
            <View key={'s' + i} style={[st.row, i > 0 && st.rowLine, { flexDirection: 'row', gap: 12 }]}>
              <View style={[st.nokta, { backgroundColor: c1 }]} />
              <Text style={[st.rowTitle, { flex: 1 }]}>{h.title}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
function HaberKart({ h, c1 }: { h: Haber; c1: string }) {
  const [acik, setAcik] = useState(false);
  const [imgBad, setImgBad] = useState(false);
  const gorsel = h.img && !imgBad;
  return (
    <Pressable onPress={() => h.body && setAcik(!acik)} style={st.haberKart}>
      {gorsel && <Image source={{ uri: h.img! }} style={st.haberGorsel} resizeMode="cover" onError={() => setImgBad(true)} />}
      <View style={{ padding: 16 }}>
        <Text style={st.haberBaslik}>{h.title}</Text>
        {h.body && <Text style={[st.body, { fontSize: 15, lineHeight: 21, marginTop: 6 }]} numberOfLines={acik ? undefined : 3}>{h.body}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={st.small}>{h.kaynak}</Text>
          {h.body && h.body.length > 140 && <Text style={[st.small, { color: c1 }]}>{acik ? 'Kısalt' : 'Devamı'}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

/* ---------------- fotoğraflar (Wikimedia Commons) ---------------- */

export interface Foto { f: string; u: string; w?: number; h?: number; g?: string; a?: string; k: string[]; kat: string; l: string; y: string; s: string }
const KONU_ONCELIK = ['spor', 'siyaset', 'sokak', 'kultur', 'esya', 'afet', 'saglik_egitim', 'ulasim', 'mimari', 'genel'];
const KONU_AD: Record<string, string> = { spor: 'Spor', siyaset: 'Siyaset', sokak: 'Sokak', kultur: 'Kültür', esya: 'Eşya', afet: 'Afet', saglik_egitim: 'Okul ve hastane', ulasim: 'Ulaşım', mimari: 'Şehir', genel: 'Türkiye' };

/** O günün kareleri varsa onlar; yoksa yılın farklı konularından ve farklı yerlerinden bir seçki */
function fotoSec(list: Foto[], iso: string): { gunun: boolean; list: Foto[] } {
  const gunun = list.filter((f) => f.g === iso);
  const tekKat = (arr: Foto[], n: number) => {
    const out: Foto[] = []; const kat = new Set<string>();
    for (const f of arr) { if (kat.has(f.kat)) continue; kat.add(f.kat); out.push(f); if (out.length === n) break; }
    return out;
  };
  if (gunun.length >= 3) return { gunun: true, list: tekKat(gunun, 9).length >= 3 ? tekKat(gunun, 9) : gunun.slice(0, 9) };
  // konu konu sırayla birer tane: spor, siyaset, sokak, kültür... (aynı albümden iki kare olmaz)
  const ay = iso.slice(0, 7);
  const kovalar = KONU_ONCELIK.map((k) => list.filter((f) => f.k[0] === k).sort((a, b) => (b.g?.startsWith(ay) ? 1 : 0) - (a.g?.startsWith(ay) ? 1 : 0)));
  const out: Foto[] = []; const kat = new Set<string>();
  for (let tur = 0; out.length < 9 && tur < 40; tur++) {
    for (const kova of kovalar) {
      const f = kova.find((x) => !kat.has(x.kat));
      if (f) { kat.add(f.kat); out.push(f); kova.splice(kova.indexOf(f), 1); }
      if (out.length === 9) break;
    }
  }
  return { gunun: false, list: out };
}
const fotoBaslik = (f: Foto) => {
  const yer = f.kat.replace(/^Images from /, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/\b(in|at) Turkey\b/gi, '').replace(/^\s*(in|at)\s+/i, '').replace(/\s+(in|at)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return yer.length > 2 ? yer : (f.a ?? '').slice(0, 60);
};

function FotoIzgara({ list, c1 }: { list: Foto[]; c1: string }) {
  const [sec, setSec] = useState<Foto | null>(null);
  const { width } = useWindowDimensions();
  const boy = (width - 36 - 8) / 3;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 18, overflow: 'hidden' }}>
        {list.map((f) => (
          <Pressable key={f.f} onPress={() => setSec(f)} style={{ width: boy, height: boy }}>
            <Img uri={gorsel(f.u)} style={{ width: boy, height: boy, backgroundColor: C.card2 }} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={st.fotoAlt}>
              <Text style={st.fotoEtiket} numberOfLines={1}>{KONU_AD[f.k[0]] ?? 'Türkiye'}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
      <Text style={[st.small, { marginTop: 8 }]}>Wikimedia Commons · serbest lisanslı fotoğraflar. Dokun, büyüt.</Text>
      <Modal visible={!!sec} transparent animationType="fade" onRequestClose={() => setSec(null)}>
        {sec && (
          <Pressable style={st.fotoModal} onPress={() => setSec(null)}>
            <Image source={{ uri: gorsel(sec.u)! }} style={{ width: '100%', aspectRatio: sec.w && sec.h ? sec.w / sec.h : 4 / 3 }} resizeMode="contain" />
            <View style={{ padding: 20 }}>
              <Text style={[st.rowTitle, { color: '#fff' }]}>{fotoBaslik(sec)}</Text>
              {!!sec.a && <Text style={[st.body, { color: 'rgba(255,255,255,0.75)', marginTop: 6 }]} numberOfLines={4}>{sec.a}</Text>}
              <Text style={[st.small, { color: 'rgba(255,255,255,0.6)', marginTop: 10 }]}>{sec.g ? `${trTarih(sec.g)} · ` : ''}📷 {sec.y || 'bilinmiyor'} · {sec.l}</Text>
              <Pressable onPress={() => Linking.openURL(sec.s)} style={{ marginTop: 12 }}><Text style={[st.small, { color: c1 }]}>Kaynak sayfası ↗</Text></Pressable>
              <Text style={[st.small, { color: 'rgba(255,255,255,0.4)', marginTop: 18 }]}>Kapatmak için dokun</Text>
            </View>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}

/* ---------------- yapı taşları ---------------- */

/** 1950-79: gün gün arşiv yok; o güne ait ne varsa (milli maç, resmî kur) ve dürüst bir not */
function EskiYil({ d, ek, year, c1, bos }: { d: DayData; ek: Ek | null; year: number; c1: string; bos: boolean }) {
  const mac = yakinMilliMac(ek?.eski, d.date);
  const kur = eskiDolar(ek?.eski, d.date);
  return (
    <View style={[st.card, { marginTop: 18, gap: 10 }]}>
      <Text style={[st.small, { color: c1, letterSpacing: 1.2 }]}>{yilEki(year).toLocaleUpperCase('tr-TR')} · YIL SAYFASI</Text>
      <Text style={st.cardTitle}>{bos ? 'Bu tarihe ait kayıtlı bir olay bulamadık.' : 'Bu yıllar için gün gün gazete arşivimiz yok.'} Aşağıda o yılın filmleri, plakları ve bu tarihte doğanlar var.</Text>
      {mac && <Text style={st.small}>⚽ {mac.mac[0]} {mac.fark > 0 ? '–' : `${mac.mac[2]}–${mac.mac[3]}`} {mac.mac[1]} · {mac.fark === 0 ? 'o gün' : `${Math.abs(mac.fark)} gün ${mac.fark > 0 ? 'sonra' : 'önce'}`}</Text>}
      {kur && <Text style={st.small}>💵 1 dolar {kur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lira (resmî kur)</Text>}
    </View>
  );
}

function Section({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 34 }}>
      {kicker && <Text style={st.kicker}>{kicker.toLocaleUpperCase('tr-TR')}</Text>}
      <Text style={st.sectionTitle}>{title}</Text>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function Rail({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ gap, paddingHorizontal: 18 }}>
      {children}
    </ScrollView>
  );
}

function Img({ uri, style }: { uri?: string | null; style: any }) {
  const [bad, setBad] = useState(false);
  if (!uri || bad) return null;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setBad(true)} />;
}

/** Görsel kart: fotoğraf yoksa dönem renginde gradyan + başlık */
function Cover({ uri, title, c1, w, h, badge }: { uri?: string | null; title: string; c1: string; w: number; h: number; badge?: string }) {
  const [bad, setBad] = useState(!uri);
  const fs = sigdir(title, w - 24, 24, 0.46);
  return (
    <View style={{ width: w, height: h, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card2 }}>
      {bad ? (
        <LinearGradient colors={[c1 + 'CC', C.card2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, justifyContent: 'flex-end', padding: 12 }}>
          <Text style={{ fontFamily: F.serif, color: '#fff', fontSize: fs, lineHeight: fs * 1.1 }} numberOfLines={3}>{title}</Text>
        </LinearGradient>
      ) : <Image source={{ uri: uri! }} style={{ width: w, height: h }} resizeMode="cover" onError={() => setBad(true)} />}
      {!!badge && <View style={st.badge}><Text style={st.badgeText}>{badge}</Text></View>}
    </View>
  );
}

function Avatar({ uri, name, c1 }: { uri?: string | null; name: string; c1: string }) {
  const [bad, setBad] = useState(!uri);
  const bas = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('');
  return bad ? (
    <LinearGradient colors={[c1, C.card2]} style={st.avatar}><Text style={{ fontFamily: F.serif, color: '#fff', fontSize: 26 }}>{bas}</Text></LinearGradient>
  ) : <Image source={{ uri: uri! }} style={st.avatar} onError={() => setBad(true)} />;
}

/** Bir bölüm: konumunu bildirir ki üstteki şeritten atlanabilsin. */
function Chapter({ name, onLayout, children }: { name: string; onLayout: (n: string, y: number) => void; children: React.ReactNode }) {
  return <View onLayout={(e) => { if (e.nativeEvent.layout.height > 4) onLayout(name, e.nativeEvent.layout.y); }}>{children}</View>;
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 22, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  kicker: { fontFamily: F.b, color: C.faint, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  sectionTitle: { fontFamily: F.serif, color: C.text, fontSize: 34, lineHeight: 38 },
  headline: { fontFamily: F.serif, color: C.text, letterSpacing: -0.3 },
  h3: { fontFamily: F.b, color: C.text, fontSize: 18 },
  body: { fontFamily: F.r, color: C.sub, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: F.r, color: C.faint, fontSize: 13, lineHeight: 18 },
  row: { paddingVertical: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  tag: { fontFamily: F.b, fontSize: 10, letterSpacing: 1.5, marginBottom: 4 },
  rowTitle: { fontFamily: F.sb, color: C.text, fontSize: 17, lineHeight: 23 },
  rowTitleSm: { fontFamily: F.sb, color: C.text, fontSize: 15, marginTop: 2 },
  money: { fontFamily: F.serif, color: C.text, fontSize: 34, lineHeight: 40, marginVertical: 2 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  kvVal: { fontFamily: F.sb, color: C.text, fontSize: 16 },
  cardTitle: { fontFamily: F.sb, color: C.text, fontSize: 15, marginTop: 9 },
  badge: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: F.xb, color: '#fff', fontSize: 10 },
  match: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  team: { fontFamily: F.sb, color: C.text, fontSize: 15, flexShrink: 1 },
  score: { fontFamily: F.serif, color: C.text, fontSize: 28, width: 86, textAlign: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  pillEtiket: { fontFamily: F.b, color: C.faint, fontSize: 9.5, letterSpacing: 1.4 },
  pillDeger: { fontFamily: F.sb, color: C.text, fontSize: 14, marginTop: 1 },
  kupur: { padding: 18, justifyContent: 'space-between', minHeight: 170 },
  kupurUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(43,38,34,0.25)', paddingBottom: 6, marginBottom: 12 },
  kupurEtiket: { fontFamily: F.xb, color: '#fff', backgroundColor: '#8A2E1E', fontSize: 9.5, letterSpacing: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, overflow: 'hidden' },
  kupurTarih: { fontFamily: F.b, color: 'rgba(43,38,34,0.6)', fontSize: 10, letterSpacing: 1.5 },
  kupurBaslik: { fontFamily: F.serif, color: '#2B2622' },
  kupurAlt: { fontFamily: F.b, color: 'rgba(43,38,34,0.5)', fontSize: 9, letterSpacing: 1.5, marginTop: 14 },
  haberKart: { backgroundColor: C.card, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  haberGorsel: { width: '100%', aspectRatio: 16 / 9, backgroundColor: C.card2 },
  haberBaslik: { fontFamily: F.serif, color: C.text, fontSize: 23, lineHeight: 27 },
  nokta: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  fotoAlt: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingTop: 18, paddingBottom: 6 },
  fotoEtiket: { fontFamily: F.b, color: '#fff', fontSize: 10.5, letterSpacing: 0.6 },
  fotoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
});

/** Yayın sürümü: arşiv taraması yerine o günün başlıklarıyla Kadran Gazetesi + gazetenin kendi arşivine bağlantı */
function KadranGazetesiKart({ d, basliklar, sarki, c1 }: { d: DayData; basliklar: Haber[]; sarki?: { title: string; artist: string }; c1: string }) {
  const { width } = useWindowDimensions();
  const [y, m, g] = d.date.split('-').map(Number);
  const nf = d.newspaperFront;
  const link = nf ? (nf.provider === 'turkiyegazetesi' ? nf.image.url : nf.image.sourcePage ?? nf.image.url) : undefined;
  const kaynaklar = [...new Set(basliklar.map((h) => h.kaynak).filter(Boolean))].join(', ');
  return (
    <View style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 14 }}>
      <Text style={{ fontFamily: F.xb, color: C.faint, fontSize: 11, letterSpacing: 1.8, marginBottom: 8 }}>O SABAHIN GAZETESİ</Text>
      <View style={{ borderRadius: 6, overflow: 'hidden', alignSelf: 'center', transform: [{ rotate: '-0.6deg' }] }}>
        <KadranGazetesi year={y} month={m} day={g} genislik={Math.min(width, 520) - 32} kaynak={kaynaklar || undefined}
          icerik={{ manset: basliklar[0]?.title, basliklar: basliklar.map((h) => h.title), sarki: sarki ? { title: sarki.title, artist: sarki.artist } : undefined }} />
      </View>
      {link && (
        <Bas onPress={() => Linking.openURL(link).catch(() => {})} style={{ marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontFamily: F.b, color: c1, fontSize: 13 }}>{nf?.paper ?? 'Milliyet'} gazetesinin o günkü ön sayfası, kendi arşivinde ↗</Text>
        </Bas>
      )}
    </View>
  );
}
