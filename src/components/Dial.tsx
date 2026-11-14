import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const AMBER = '#FFB000';
const LABELS = [1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025];

/**
 * Ana sayfanın kalbi: yavaşça dönen zaman kadranı.
 * Dış halkada yıllar ve çentikler döner, ortada bugünün tarihi durur.
 */
export function Dial({ size, day, monthName, weekday, year }: {
  size: number; day: number; monthName: string; weekday: string; year: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // açılışta kadran hızlıca bir tur atıp yerine oturur, sonra çok yavaş döner
    Animated.timing(intro, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 120000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const R = size / 2;
  const rotate = Animated.add(spin, intro.interpolate({ inputRange: [0, 1], outputRange: [-0.35, 0] }))
    .interpolate({ inputRange: [-1, 1], outputRange: ['360deg', '-360deg'] });
  const centerScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  const ticks = Array.from({ length: 120 }, (_, i) => i);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* dış çerçeve */}
      <View style={[st.ring, { width: size, height: size, borderRadius: R }]} />
      <View style={[st.ringInner, { width: size - 70, height: size - 70, borderRadius: (size - 70) / 2 }]} />

      {/* dönen halka: çentikler + yıllar */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        {ticks.map((i) => {
          const major = i % 12 === 0;
          const mid = i % 3 === 0;
          const h = major ? 16 : mid ? 9 : 5;
          return (
            <View key={i} style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: `${i * 3}deg` }] }]}>
              <View style={{ marginTop: 6, width: major ? 2 : 1, height: h, backgroundColor: major ? AMBER : mid ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)' }} />
            </View>
          );
        })}
        {LABELS.map((y, i) => (
          <View key={y} style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: `${i * 36}deg` }] }]}>
            <Text style={st.label}>{y}</Text>
          </View>
        ))}
      </Animated.View>

      {/* sabit ibre */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center' }]} pointerEvents="none">
        <View style={st.needle} />
      </View>

      {/* merkez */}
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: centerScale }] }}>
        <Text style={st.weekday}>{weekday}</Text>
        <Text style={st.day}>{day}</Text>
        <Text style={st.month}>{monthName}</Text>
        <View style={st.yearPill}><Text style={st.year}>{year}</Text></View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(12,13,16,0.55)' },
  ringInner: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(7,8,10,0.85)' },
  label: { marginTop: 26, color: 'rgba(245,242,236,0.55)', fontSize: 11, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.6 },
  needle: {
    marginTop: -2, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 13,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: AMBER,
  },
  weekday: { color: 'rgba(245,242,236,0.55)', fontSize: 12, fontFamily: 'InterTight_600SemiBold', letterSpacing: 2.5, textTransform: 'uppercase' },
  day: { color: '#F5F2EC', fontSize: 118, lineHeight: 122, fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -3 },
  month: { color: '#F5F2EC', fontSize: 28, fontFamily: 'InstrumentSerif_400Regular_Italic', marginTop: -10 },
  yearPill: { marginTop: 10, backgroundColor: 'rgba(255,176,0,0.14)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  year: { color: AMBER, fontSize: 13, fontFamily: 'InterTight_700Bold', letterSpacing: 1.5 },
});
