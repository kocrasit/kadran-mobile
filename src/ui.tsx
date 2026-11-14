import { ReactNode } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { EraTheme } from './theme';

/**
 * Kadran 2026 tasarım sistemi.
 * Tek, modern bir dil: derin siyah zemin, dergi tipi büyük başlıklar (Instrument Serif),
 * temiz arayüz yazısı (Inter Tight). Dönemi renk ışığı ve içerik taşır.
 */
export const C = {
  bg: '#07080A',
  card: '#111215',
  card2: '#17191D',
  stroke: 'rgba(255,255,255,0.09)',
  text: '#F5F2EC',
  sub: 'rgba(245,242,236,0.64)',
  faint: 'rgba(245,242,236,0.38)',
  amber: '#FFB000',
  like: '#FF3D71',
};

export const F = {
  serif: 'InstrumentSerif_400Regular',
  serifI: 'InstrumentSerif_400Regular_Italic',
  r: 'InterTight_400Regular',
  m: 'InterTight_500Medium',
  sb: 'InterTight_600SemiBold',
  b: 'InterTight_700Bold',
  xb: 'InterTight_800ExtraBold',
};

/** Her on yılın ışığı: iki renkli gradyan (parlak → derin) */
export const ERA_LIGHT: Record<EraTheme['key'], [string, string]> = {
  '80s': ['#FF8A3D', '#9E2A1E'],
  '90s': ['#FF4FA3', '#5B22D6'],
  '2000s': ['#3EE6C9', '#1F5FE0'],
  '2010s': ['#7C9BFF', '#0EA5E9'],
  '2020s': ['#FFC23D', '#FF5A36'],
};

/** Basınca hafifçe esneyen yüzey (yay fiziği) */
export function Bas({ onPress, onLongPress, style, children, haptic = true, scale = 0.97, disabled }: {
  onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; haptic?: boolean; scale?: number; disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable disabled={disabled} onLongPress={onLongPress}
      onPressIn={() => { s.value = withSpring(scale, { damping: 18, stiffness: 420 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      onPress={() => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(); }}>
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}
