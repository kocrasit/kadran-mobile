import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { C, F } from '../ui';

/** Yüzen buzlu cam alt menü; seçili sekmenin arkasında yayla kayan bir ışık. */
export function GlassTabBar({ tabs, active, onChange }: {
  tabs: { key: string; label: string; icon: string }[]; active: string; onChange: (k: string) => void;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active));
  const x = useSharedValue(0);
  const cell = w / tabs.length;
  useEffect(() => { if (w) x.value = withSpring(idx * cell, { damping: 18, stiffness: 220 }); }, [idx, w]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={st.wrap} pointerEvents="box-none">
      <View style={st.bar} onLayout={(e) => setW(e.nativeEvent.layout.width - 12)}>
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,21,25,0.55)' }]} />
        {w > 0 && <Animated.View style={[st.pill, { width: cell }, pill]} />}
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} style={st.tab} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(t.key); }}>
              <Text style={[st.icon, on && { color: C.text }]}>{t.icon}</Text>
              <Text style={[st.label, on && { color: C.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  bar: {
    width: '88%', maxWidth: 420, height: 66, borderRadius: 33, overflow: 'hidden', flexDirection: 'row', padding: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  pill: { position: 'absolute', left: 6, top: 6, bottom: 6, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  icon: { fontSize: 19, color: C.faint },
  label: { fontFamily: F.sb, fontSize: 11, color: C.faint },
});
