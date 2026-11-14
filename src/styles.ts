import { Platform, StyleSheet } from 'react-native';
import { EraTheme } from './theme';

export type Styles = ReturnType<typeof makeStyles>;

export function makeStyles(t: EraTheme) {
  const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
  const head = t.serif ? serif : undefined;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.paper },
    page: { padding: 16, paddingBottom: 48 },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    back: { color: t.accent, fontWeight: '700', fontSize: 15 },
    kicker: { color: t.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
    today: { color: t.ink, fontSize: 34, fontWeight: '800', fontFamily: head },
    chips: { marginVertical: 14, flexGrow: 0 },
    chip: { borderWidth: 1, borderColor: t.rule, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
    chipOn: { backgroundColor: t.ink, borderColor: t.ink },
    chipText: { color: t.ink, fontWeight: '600' },
    chipTextOn: { color: t.paper },
    paper: { borderTopWidth: 3, borderBottomWidth: 1, borderColor: t.rule, paddingVertical: 12 },
    masthead: { color: t.ink, fontSize: 30, fontWeight: '900', textAlign: 'center', fontFamily: serif, letterSpacing: 1 },
    dateline: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.rule, paddingVertical: 4, marginVertical: 10 },
    datelineText: { color: t.muted, fontSize: 12, fontWeight: '600' },
    headline: { color: t.accent, fontSize: 26, fontWeight: '900', fontFamily: head, lineHeight: 31, marginBottom: 8 },
    bullet: { color: t.ink, fontSize: 15, marginBottom: 6, fontFamily: head },
    row: { flexDirection: 'row', gap: 10, marginTop: 12 },
    box: { flex: 1, borderWidth: 1, borderColor: t.rule, padding: 10 },
    label: { color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
    big: { color: t.ink, fontSize: 18, fontWeight: '800' },
    section: { marginTop: 16, borderTopWidth: 1, borderColor: t.rule, paddingTop: 10 },
    item: { color: t.ink, fontSize: 15, marginBottom: 6, lineHeight: 21 },
    itemStrong: { fontWeight: '700' },
    h2: { color: t.ink, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    body: { color: t.ink, fontSize: 15, lineHeight: 21 },
    small: { color: t.muted, fontSize: 12 },
    cta: { marginTop: 20, backgroundColor: t.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  });
}
