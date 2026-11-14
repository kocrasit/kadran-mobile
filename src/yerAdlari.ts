/**
 * USGS deprem kataloğunda Türkçe harfleri "?" olmuş yer adlarının doğru yazımı (veri denetimi, 29 Ekim).
 * 180 farklı ad; kalan bilinmeyenler gösterilirken "Türkiye" ile değiştirilir.
 */
export const YER_ADI: Record<string, string> = {
  'Erci?': 'Erciş', 'Do?anyol': 'Doğanyol', 'Pazarc?k': 'Pazarcık', 'Do?an?ehir': 'Doğanşehir', 'Uzunba?': 'Uzunbağ', 'Alt?nyayla': 'Altınyayla',
  'Nurda??': 'Nurdağı', 'Karl?ova': 'Karlıova', 'Marmara Ere?lisi': 'Marmara Ereğlisi', 'Sultanda??': 'Sultandağı', 'Ka?': 'Kaş', '?çmeler': 'İçmeler',
  'Kahramanmara?': 'Kahramanmaraş', 'A?kale': 'Aşkale', 'K?rka?aç': 'Kırkağaç', 'Akyaz?': 'Akyazı', 'Alaçat?': 'Alaçatı', 'Gazipa?a': 'Gazipaşa',
  '?enkaya': 'Şenkaya', 'Sava?tepe': 'Savaştepe', 'And?r?n': 'Andırın', '?aphane': 'Şaphane', 'Ça?layancerit': 'Çağlayancerit', 'Ye?ilyurt': 'Yeşilyurt',
  'Gölba??': 'Gölbaşı', 'Elmal?': 'Elmalı', 'Ac?payam': 'Acıpayam', 'Bay?r': 'Bayır', 'Geva?': 'Gevaş', 'Do?ubayaz?t': 'Doğubayazıt', 'K?r?khan': 'Kırıkhan',
  'Yaylada??': 'Yayladağı', 'Saruhanl?': 'Saruhanlı', '?liç': 'İliç', 'Karayaz?': 'Karayazı', 'Af?in': 'Afşin', 'Ad?yaman': 'Adıyaman', 'Kumba?': 'Kumbağ',
  'Ka??zman': 'Kağızman', 'Çüngü?': 'Çüngüş', 'Bo?azkent': 'Boğazkent', 'E?irdir': 'Eğirdir', 'Band?rma': 'Bandırma', 'Ku?adas?': 'Kuşadası',
  'A?a?? Karafak?l?': 'Aşağı Karafakılı', 'Bal?kesir': 'Balıkesir', 'Bulan?k': 'Bulanık', 'Karata?': 'Karataş', '?emdinli': 'Şemdinli', 'Mu?la': 'Muğla',
  'Alia?a': 'Aliağa', 'Toygarl?': 'Toygarlı', 'I?d?r': 'Iğdır', 'Be?endik': 'Beşendik', 'S?nd?rg?': 'Sındırgı', 'Dumlup?nar': 'Dumlupınar', 'Alada?': 'Aladağ',
  '?hsaniye': 'İhsaniye', 'Ye?ilova': 'Yeşilova', 'Ele?kirt': 'Eleşkirt', 'Ba?makç?': 'Başmakçı', 'Karaisal?': 'Karaisalı', 'I??klar': 'Işıklar',
  'Ba?çiftlik': 'Başçiftlik', 'Ç?narc?k': 'Çınarcık', 'Adapazar?': 'Adapazarı', 'Çerke?': 'Çerkeş', 'Kovanc?lar': 'Kovancılar', 'Do?an?ar': 'Doğanşar',
  'Sar?o?lan': 'Sarıoğlan', 'Yaz?han': 'Yazıhan', 'G?ksun': 'Göksun', '?abanözü': 'Şabanözü', 'Mu?': 'Muş', '?uhut': 'Şuhut', 'Sar?kam??': 'Sarıkamış',
  'K?z?la?aç': 'Kızılağaç', 'Sand?kl?': 'Sandıklı', 'Ar?cak': 'Arıcak', 'H?n?s': 'Hınıs', 'Ula?': 'Ulaş', 'Kar??yaka': 'Karşıyaka', 'Kad?köy': 'Kadıköy',
  'Altp?nar': 'Altpınar', 'Çandarl?': 'Çandarlı', 'Ba?kale': 'Başkale', 'Hac?lar': 'Hacılar', '?mranl?': 'İmranlı', 'Kar?ncal?': 'Karıncalı',
  'Çardakl?': 'Çardaklı', 'Pozant?': 'Pozantı', 'Çe?me': 'Çeşme', 'Do?anköy': 'Doğanköy', '?skenderun': 'İskenderun', 'K?z?l?rmak': 'Kızılırmak',
  'K?z?lören': 'Kızılören', 'Koçarl?': 'Koçarlı', 'Kemalpa?a': 'Kemalpaşa', 'Torbal?': 'Torbalı', 'Gümü?hac?köy': 'Gümüşhacıköy', 'Divri?i': 'Divriği',
  'Bostanc?': 'Bostancı', 'Ta?köprü': 'Taşköprü', '?skilip': 'İskilip', 'P?narba??': 'Pınarbaşı', 'U?urluda?': 'Uğurludağ', 'Yeniça?a': 'Yeniçağa',
  '?hsangazi': 'İhsangazi', 'Ilg?n': 'Ilgın', '?ile': 'Şile', 'A?lasun': 'Ağlasun', 'Mustafakemalpa?a': 'Mustafakemalpaşa', 'Bey?ehir': 'Beyşehir',
  'Tekirda?': 'Tekirdağ', 'Ala?ehir': 'Alaşehir', 'Tepealt?': 'Tepealtı', 'Polatl?': 'Polatlı', '?ebin Karahisar': 'Şebinkarahisar', 'Bozdo?an': 'Bozdoğan',
  'Ovakava??': 'Ovakavağı', 'Emirda?': 'Emirdağ', 'Selimpa?a': 'Selimpaşa', '?yidere': 'İyidere', '?spir': 'İspir', 'Yal?hüyük': 'Yalıhüyük',
  'Seydi?ehir': 'Seydişehir', 'Gümü?hane': 'Gümüşhane', '?nönü': 'İnönü', 'Sar?z': 'Sarız', 'Kö?k': 'Köşk', 'K?nal?': 'Kınalı', 'Dazk?r?': 'Dazkırı',
  'Be?p?nar': 'Beşpınar', 'Sar?göl': 'Sarıgöl', 'Anayaz?': 'Anayazı', '?arkîkaraa?aç': 'Şarkikaraağaç', '?ncirliova': 'İncirliova', '?vrindi': 'İvrindi',
  '?ark??la': 'Şarkışla', 'Nall?han': 'Nallıhan', 'Ula?l?': 'Ulaşlı', 'Yaprakl?': 'Yapraklı', 'Beypazar?': 'Beypazarı', 'Ak?ehir': 'Akşehir',
  'Ba?l?ca': 'Bağlıca', 'Kad??ehri': 'Kadışehri', 'Muratpa?a': 'Muratpaşa', '?enoba': 'Şenoba', 'Il?ca': 'Ilıca', 'Vakf?kebir': 'Vakfıkebir',
  'Ta?kent': 'Taşkent', 'Günde?': 'Gündeş', 'Karg?': 'Kargı', 'Hal?dere': 'Halıdere', 'K?z?lkaya': 'Kızılkaya', 'Yahyal?': 'Yahyalı',
  'Sinanpa?a': 'Sinanpaşa', 'Çay?ralan': 'Çayıralan', 'A?r?': 'Ağrı', 'P?narönü': 'Pınarönü', 'Gülyaz?': 'Gülyazı', 'Ta?ova': 'Taşova',
  'K?zkalesi': 'Kızkalesi', 'Yeni?akran': 'Yenişakran', 'A??n': 'Ağın', 'Eski?ehir': 'Eskişehir', 'Elmada?': 'Elmadağ', 'Demirta?': 'Demirtaş',
  'Ere?li': 'Ereğli', 'Ayvac?k': 'Ayvacık', 'Karaba?lar': 'Karabağlar', 'Ak?ada?': 'Akçadağ', 'G?lba??': 'Gölbaşı', 'Alt?nözü': 'Altınözü',
  'K??lak': 'Kışlak', 'Bal?kl?dere': 'Balıklıdere', 'G?nyaz?': 'Günyazı', 'Ekin?z?': 'Ekinözü', 'Gümü?göze': 'Gümüşgöze',
};

/** İngilizce bölge adları */
export const BOLGE_ADI: Record<string, string> = {
  'Central Turkey': 'Orta Anadolu', 'Western Turkey': 'Batı Türkiye', 'Eastern Turkey': 'Doğu Türkiye',
  'Near the coast of western Turkey': 'Batı Türkiye kıyıları', 'K. Maras': 'Kahramanmaraş',
  'Turkey-Iraq border region': 'Türkiye-Irak sınırı', 'Georgia-Turkey border region': 'Türkiye-Gürcistan sınırı',
  'Turkey-Syria-Iraq border region': 'Türkiye-Suriye-Irak sınırı', 'Kahramanmaras Earthquake Sequence': 'Kahramanmaraş depremleri',
};

/** "K?r?khan · 11 km doğusu" → "Kırıkhan · 11 km doğusu"; İngilizce adları Türkçeleştirir. */
export function yerAdiDuzelt(yer: string): string {
  let y = yer.trim();
  const dizi = y.match(/^(Pazarcik|Elbistan) earthquake/i);
  if (dizi) return `${dizi[1].replace('Pazarcik', 'Pazarcık')} merkezli (Kahramanmaraş)`;
  if (/Néon Karlov/i.test(y)) return 'Sisam Adası açıkları (İzmir)';
  if (/Greece/.test(y)) return 'Ege Denizi, Yunanistan kıyısı';
  if (BOLGE_ADI[y]) return BOLGE_ADI[y];
  const [ad, ...kalan] = y.split(' · ');
  let dogru = YER_ADI[ad] ?? ad;
  if (dogru.includes('?')) return kalan.length ? `Türkiye · ${kalan.join(' · ')}` : 'Türkiye';
  return [dogru, ...kalan].join(' · ');
}
