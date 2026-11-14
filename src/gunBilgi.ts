/** O güne ait hesaplanan küçük bilgiler: ay evresi, burç. İnternet gerektirmez. */

const AY_ADLARI: [string, string][] = [
  ['🌑', 'Yeni ay'], ['🌒', 'Hilal'], ['🌓', 'İlk dördün'], ['🌔', 'Şişkin ay'],
  ['🌕', 'Dolunay'], ['🌖', 'Şişkin ay'], ['🌗', 'Son dördün'], ['🌘', 'Hilal'],
];
/** Basit ay evresi: 6 Ocak 2000 18:14 UTC yeni ayından bu yana geçen sinodik aylar. */
export function ayEvresi(year: number, month: number, day: number) {
  const gun = (Date.UTC(year, month - 1, day, 12) - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const sinodik = 29.530588853;
  const f = (((gun / sinodik) % 1) + 1) % 1; // 0 = yeni ay, 0.5 = dolunay
  const i = Math.round(f * 8) % 8;
  return { emoji: AY_ADLARI[i][0], ad: AY_ADLARI[i][1], aydinlik: Math.round((1 - Math.cos(f * 2 * Math.PI)) / 2 * 100) };
}

const BURCLAR: [number, number, string, string][] = [
  [1, 20, '♑', 'Oğlak'], [2, 19, '♒', 'Kova'], [3, 21, '♓', 'Balık'], [4, 20, '♈', 'Koç'],
  [5, 21, '♉', 'Boğa'], [6, 21, '♊', 'İkizler'], [7, 23, '♋', 'Yengeç'], [8, 23, '♌', 'Aslan'],
  [9, 23, '♍', 'Başak'], [10, 23, '♎', 'Terazi'], [11, 22, '♏', 'Akrep'], [12, 22, '♐', 'Yay'],
];
/** Güneş burcu: ayın belirtilen gününden önce bir önceki burç sürer. */
export function burc(month: number, day: number) {
  const [, sinir, sembol, ad] = BURCLAR[month - 1];
  if (day < sinir) return { sembol, ad };
  const s = BURCLAR[month % 12];
  return { sembol: s[2], ad: s[3] };
}
