/**
 * Her on yılın kendi gazetesi.
 * Renk, yazı tipi ve bölüm başlığı biçimi dönemle birlikte değişir:
 * 80'ler kurşun dizgi gazete, 90'lar renkli magazin, 2000'ler internet portalı,
 * 2010'lar düz uygulama kartları, 2020'ler karanlık mod.
 */
export type SectionStyle = 'bar' | 'tab' | 'portal' | 'flat' | 'card';

export interface EraTheme {
  key: '80s' | '90s' | '2000s' | '2010s' | '2020s';
  label: string;
  paper: string;    // sayfa zemini
  surface: string;  // kutu zemini
  ink: string;      // ana yazı
  muted: string;    // ikincil yazı
  accent: string;   // manşet / vurgu
  accent2: string;  // ikinci renk
  rule: string;     // çizgi
  onAccent: string; // vurgu rengi üstündeki yazı
  head: string;     // manşet yazı tipi
  body: string;     // metin yazı tipi
  bodyBold: string;
  ui: string;       // buton / küçük yazı
  headUpper: boolean;
  section: SectionStyle;
  radius: number;
  dark: boolean;
}

const T: Record<EraTheme['key'], EraTheme> = {
  '80s': {
    key: '80s', label: "80'ler",
    paper: '#E4DCC6', surface: '#EDE6D3', ink: '#1B1A17', muted: '#5E584B',
    accent: '#C8102E', accent2: '#1B1A17', rule: '#1B1A17', onAccent: '#FFFFFF',
    head: 'Oswald_700Bold', body: 'PTSerif_400Regular', bodyBold: 'PTSerif_700Bold', ui: 'Oswald_500Medium',
    headUpper: true, section: 'bar', radius: 0, dark: false,
  },
  '90s': {
    key: '90s', label: "90'lar",
    paper: '#FFFFFF', surface: '#FFF6C7', ink: '#0F1B2D', muted: '#56627A',
    accent: '#E30613', accent2: '#0057B8', rule: '#0F1B2D', onAccent: '#FFFFFF',
    head: 'ArchivoBlack_400Regular', body: 'PTSerif_400Regular', bodyBold: 'PTSerif_700Bold', ui: 'ArchivoBlack_400Regular',
    headUpper: true, section: 'tab', radius: 3, dark: false,
  },
  '2000s': {
    key: '2000s', label: "2000'ler",
    paper: '#D9E4F1', surface: '#FFFFFF', ink: '#14324F', muted: '#5A7491',
    accent: '#1D5FA8', accent2: '#F28C00', rule: '#A9BED6', onAccent: '#FFFFFF',
    head: 'Nunito_900Black', body: 'Nunito_400Regular', bodyBold: 'Nunito_800ExtraBold', ui: 'Nunito_800ExtraBold',
    headUpper: false, section: 'portal', radius: 8, dark: false,
  },
  '2010s': {
    key: '2010s', label: "2010'lar",
    paper: '#F3F4F6', surface: '#FFFFFF', ink: '#16181C', muted: '#6B7280',
    accent: '#2F5BFF', accent2: '#16181C', rule: '#E3E5E9', onAccent: '#FFFFFF',
    head: 'SpaceGrotesk_700Bold', body: 'Nunito_400Regular', bodyBold: 'Nunito_700Bold', ui: 'SpaceGrotesk_600SemiBold',
    headUpper: false, section: 'flat', radius: 16, dark: false,
  },
  '2020s': {
    key: '2020s', label: "2020'ler",
    paper: '#0E1116', surface: '#181D25', ink: '#EEF1F5', muted: '#8E98A6',
    accent: '#A493FF', accent2: '#5EE6C4', rule: '#262D38', onAccent: '#0E1116',
    head: 'SpaceGrotesk_700Bold', body: 'SpaceGrotesk_400Regular', bodyBold: 'SpaceGrotesk_600SemiBold', ui: 'SpaceGrotesk_600SemiBold',
    headUpper: false, section: 'card', radius: 18, dark: true,
  },
};

const ESKI_ETIKET: Record<number, string> = { 1950: "50'ler", 1960: "60'lar", 1970: "70'ler" };
export function themeForYear(year: number): EraTheme {
  // 1950-79 şimdilik 80'lerin görünümünü kullanır, etiketi kendi on yılı
  if (year < 1980) return { ...T['80s'], label: ESKI_ETIKET[Math.floor(year / 10) * 10] ?? T['80s'].label };
  if (year < 1990) return T['80s'];
  if (year < 2000) return T['90s'];
  if (year < 2010) return T['2000s'];
  if (year < 2020) return T['2010s'];
  return T['2020s'];
}

/** TRT test kartının renk çubukları — uygulamanın imza şeridi. */
export const TEST_CARD = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'];
