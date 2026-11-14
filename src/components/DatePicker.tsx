import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AYLAR } from '../data';

/** Verinin olduğu aralık: 1 Ocak 1950 – 25 Haziran 2026 */
export const MIN = { y: 1950, m: 1, d: 1 };
export const MAX = { y: 2026, m: 6, d: 25 };

export interface YMD { year: number; month: number; day: number }

function daysIn(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function maxMonth(y: number) { return y === MAX.y ? MAX.m : 12; }
function maxDay(y: number, m: number) {
  return y === MAX.y && m === MAX.m ? MAX.d : daysIn(y, m);
}
export function clamp({ year, month, day }: YMD): YMD {
  const y = Math.min(Math.max(year, MIN.y), MAX.y);
  const m = Math.min(month, maxMonth(y));
  const d = Math.min(day, maxDay(y, m));
  return { year: y, month: m, day: d };
}

const AMBER = '#FFB000';
const tick = () => { Haptics.selectionAsync().catch(() => {}); };

/** Koyu "zaman makinesi kontrol paneli": yıl şeridi, ay ve gün ızgarası. */
export function DatePicker({ value, onChange, accent = AMBER }: { value: YMD; onChange: (v: YMD) => void; accent?: string }) {
  const on1 = { borderColor: accent, backgroundColor: accent };
  const years: number[] = [];
  for (let y = MAX.y; y >= MIN.y; y--) years.push(y);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yearRef = useRef<any>(null);
  const [laidOut, setLaidOut] = useState(false);

  useEffect(() => {
    if (!laidOut) return;
    const i = years.indexOf(value.year);
    yearRef.current?.scrollTo({ x: Math.max(0, i * 76 - 120), animated: true });
  }, [laidOut, value.year]);

  const set = (patch: Partial<YMD>) => { tick(); onChange(clamp({ ...value, ...patch })); };

  const dCount = maxDay(value.year, value.month);
  const days = Array.from({ length: dCount }, (_, i) => i + 1);

  return (
    <View>
      <Text style={p.label}>Yıl</Text>
      <ScrollView ref={yearRef} horizontal showsHorizontalScrollIndicator={false}
        onLayout={() => setLaidOut(true)} contentContainerStyle={{ paddingHorizontal: 4 }}>
        {years.map((y) => {
          const on = y === value.year;
          return (
            <View key={y}>
              <Text style={[p.decade, { opacity: y % 10 === 9 || y === MAX.y ? 1 : 0 }]}>{y === MAX.y ? 'şimdi' : `${String(y - 9).slice(2)}'ler`}</Text>
              <Pressable onPress={() => set({ year: y })} style={[p.year, on && { borderColor: accent, backgroundColor: accent + '22' }]}>
                <Text style={[p.yearText, on && { color: accent }]}>{y}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Text style={p.label}>Ay</Text>
      <View style={p.grid}>
        {AYLAR.map((name, i) => {
          const m = i + 1;
          const disabled = m > maxMonth(value.year);
          const on = m === value.month;
          return (
            <Pressable key={m} disabled={disabled} onPress={() => set({ month: m })}
              style={[p.month, on && on1, disabled && p.disabled]}>
              <Text style={[p.cellText, on && p.cellTextOn]}>{name.slice(0, 3)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={p.label}>Gün</Text>
      <View style={p.grid}>
        {days.map((d) => {
          const on = d === value.day;
          return (
            <Pressable key={d} onPress={() => set({ day: d })} style={[p.day, on && on1]}>
              <Text style={[p.cellText, on && p.cellTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const p = StyleSheet.create({
  decade: { color: 'rgba(245,242,236,0.38)', fontSize: 11, fontFamily: 'InterTight_600SemiBold', marginBottom: 4, marginLeft: 2 },
  label: { color: 'rgba(245,242,236,0.38)', fontSize: 11, fontFamily: 'InterTight_700Bold', letterSpacing: 2, marginTop: 22, marginBottom: 10, textTransform: 'uppercase' },
  year: { width: 70, marginRight: 8, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  yearText: { color: '#F5F2EC', fontSize: 24, fontFamily: 'InstrumentSerif_400Regular' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  month: { width: '23.5%', paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  day: { width: '12.6%', aspectRatio: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  cellText: { color: '#F5F2EC', fontFamily: 'InterTight_600SemiBold' },
  cellTextOn: { color: '#111' },
  disabled: { opacity: 0.25 },
});
