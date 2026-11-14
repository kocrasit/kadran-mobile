# Kadran Mobil — Çalışma Notları

_Son güncelleme: 14 Kasım 2026_

## Nasıl çalıştırılır

1. `kadran-mobile` klasöründe **BASLAT.bat**'a çift tıkla (token `token.txt` içinde).
2. iPhone kamerasıyla QR kodu okut (Expo Go'da **emrersd34** hesabı açık olmalı).
3. Pencere açık kaldıkça kod değişiklikleri telefona kendiliğinden gelir. Yeni paket eklenirse pencereyi kapatıp BASLAT'ı yeniden çalıştır.

Veri, arkadaşların web projesindeki `C:\Users\emrer\kadran\public\data` klasöründen Expo üzerinden okunuyor (bkz. `metro.config.js`). Web projesine dokunulmuyor.

## Şu an uygulamada olanlar

- **Ana sayfa:** Dönen zaman kadranı (bugünün tarihi) + altında Twitter tarzı "Bugün tarihte" akışı. Her yıldan 2 gönderi (📰 Manşet, 📻 Radyo, 📺 Ekran…), altta küçük tarih, ⏳ Işınlan / ♡ Hatırlıyorum / ↗ Paylaş butonları.
- **Yüzen buton:** "Başka bir güne git" → koyu tarih seçici (yıl / ay / gün) → Işınlan.
- **Işınlanma efekti:** Akan yıl sayacı, titreşim, parazit, beyaz flaş.
- **Gün sayfası:** Dev yıl, dönemin gazete künyesi, manşet kartı, diğer haberler, günün rakamları (dolar, euro, altın, hava, nüfus, hicri), radyo, TV, sinema, doğanlar, dönemin eşyaları, reklam arası.
- Her on yılın kendi görünümü: 80'ler gazete kağıdı, 90'lar renkli magazin, 2000'ler portal, 2010'lar düz kartlar, 2020'ler karanlık mod.

---

## YARIN — Plan

### 1. CSS / tasarım iyileştirmesi
- [ ] Gün sayfasını telefonda gözden geçir; görsellerin gerçek görünümüne göre boşluk, boyut, hiyerarşi düzelt.
- [ ] Işınlanma efektini daha etkileyici yap (ses, daha güçlü geçiş).
- [ ] Tarih seçiciyi daha "zaman makinesi" hissine sok (kaydırmalı çark?).
- [ ] `SafeAreaView` uyarısını gider (react-native-safe-area-context'e geç).
- [ ] Uygulama ikonu ve açılış ekranı (şu an Expo varsayılanı).

### 2. Bilgi (veri) kontrolü
- [ ] **Doğrulama scripti:** tüm gün dosyalarını tarayıp hataları raporlasın:
  - Yanlış tarih eşleşmesi (12 Mayıs 1983'te Leonardo da Vinci "ölenler"de — aslında 2 Mayıs; 12 Ekim maçının 12 Mayıs'a düşmesi).
  - Alakasız Vikipedi maddeleri haber diye girilmiş: "Kertenkele" (hayvan) 2012–2014 arası 47 günde "haber" olarak var.
  - Yanlış görseller: şarkıcı Nilüfer → nilüfer çiçeği; "Rüya" filmi → Rousseau tablosu.
  - Haber gibi görünmeyen başlıklar ("Ekrem İmamoğlu", "Türkiye Futbol Federasyonu" tek başına).
  - Kırık görsel/video linkleri, boş bölümler (kapsama haritası).
- [ ] **Türk dizileri eksik:** Kertenkele (2014, ATV) TV verisinde hiç yok. Sebep: diziler Wikidata'dan çekiliyor, çoğunda yayın tarihi girilmemiş. → Vikipedi'deki yıllara göre Türk dizileri listelerinden kanal + yayın yılı çekip "Bu akşam ekranda"yı dolduran script.
- [ ] Manşet seçimi çok siyasi; spor / magazin / kültür ağırlığını artır.
- [ ] Telif riski (mağazaya çıkmadan önce): Milliyet arşiv sayfaları, TMDB afişleri, Vikipedi film afişleri.

### 3. Yeni özellikler
- [ ] **Spor başlığı:** maç sonuçları, Süper Lig puan durumu, şampiyonlar (veride `sports` alanı var ama henüz gösterilmiyor).
- [ ] Gündemde ne aranıyordu (`topSearches`, 2010 sonrası), Resmî Gazete (`officialGazette`), o günün web siteleri (`webSnapshots`) — veride var, gösterilmiyor.
- [ ] "Doğduğum gün" kısayolu: doğum tarihini bir kere gir, ana sayfada "X yaşındaydın" kartları.
- [ ] Paylaşılabilir görsel kart (Instagram hikâyesi için).
- [ ] Günlük "Hangi yıl?" oyunu.

---

## Büyük resim (arkadaşlara giden plan)

1. Önce tek başına keyifli bir uygulama (zamanda yolculuk ve o günün gazetesi)
2. Sonra arkadaş ve aile odaları (birlikte zamanda yolculuk)
3. Sonra büyük günlerde açık akışlar (ortak hatıra duvarı)
4. En son tüm günlere açılan "Geçmişin Twitter'ı" (takip, gündem ve kâşifler)

## Para kazanma (özet)

- Hediye: "Doğduğun Günün Gazetesi" — dijital + basılı çerçeveli poster (içerik tamamen bizim olmalı).
- Kadran Pro: tek seferlik ömür boyu (+ yıllık seçenek).
- Marka sponsorluğu (kullanıcı tabanı büyüyünce).
- Reklam minimum; günlük oyun, ana sayfa ve temel paylaşım ücretsiz.

## Teknik notlar

- Expo SDK 58, React Native, TypeScript. Expo Go ile iPhone'da test.
- Yazı tipleri: Oswald, PT Serif, Archivo Black, Nunito, Space Grotesk (Google Fonts, Türkçe karakter destekli).
- İleride: veriyi internete koy (BASLAT'sız çalışsın), App Store için EAS Build (Mac gerekmez).

## 4 Kasım — Şarkıyla paylaşım
- Paylaşım kartına "🎵 Şarkı" şablonu eklendi: dönen plak, ortada fotoğraf / kapak / yıl, şarkı adı + sanatçı, 2012 ━●━ 2026 çalar çubuğu.
- "KARTIN ŞARKISI" seçici: o gün radyoda çalanlar (▶ ile kısa dinleme), "Şarkısız", "✏️ Başka şarkı" (elle yaz: ör. düğün şarkısı). Seçilen şarkı bütün şablonlarda görünür.
- Paylaş'a basınca şarkı adı panoya kopyalanır, ekranda ipucu çıkar: Instagram'da Müzik çıkartmasına yapıştır. (Instagram dışarıdan müzik eklemeye izin vermiyor; sesi biz koyamıyoruz — telif + YouTube kuralları.)
- Gün sayfasında Radyoda satırının altında "🎵 Şarkısıyla paylaş · N şarkıdan seç".
- Düzeltme: o tarihten sonra çıkan şarkılar artık listede/hikâyede/gün sayfasında görünmüyor (cikmisMi).
- Yeni paket: expo-clipboard ~58.0.4.
- Sonra: 5–10 sn dönen plaklı sessiz video (geliştirme sürümünde).

## 10 Kasım — Ana ekranda "Anılar"
- "Bugün tarihte" başlığının sağında Haberler | Anılar seçici. Anılar: bugünün tarihinde geçmiş yıllarda çekilmiş fotoğraflar, yıl sırasıyla, tek satır Türkçe açıklama + fotoğrafçı/lisans (CC gereği). Dokununca o güne ışınlar.
- Veri: veri-ek/anilar/AA-GG.json (366 gün, ~1.900 fotoğraf, günde en fazla 6). Kaynak foto/gunluk.json (Wikimedia Commons); haritalar, uçak tescil fotoğrafları, logolar, tekrarlar ayıklandı; açıklamalar elle kısaltıldı/çevrildi. 1980–2002 için ayrıca o sabahın gazetesinin manşet kısmı (en fazla 2).
- Kural: yüklenemeyen fotoğraf asla gösterilmez — her fotoğraf önce arka planda indirilir (aynı anda 3), inmeyen listeye girmez; görüntülenirken hata verirse listeden çıkar.
- data.ts gorsel(): thumb.wikimedia.org adresleri upload.wikimedia.org'a çevrilip aracıdan (proxy) geçiyor (gün sayfasındaki foto ızgarası da bundan yararlanır).
- 10 Kasım (2): Anılar genişletildi — günlük 6 sınırı kaldırıldı; aynı fotoğrafçının aynı günkü serisinden en fazla 3 kare. Deprem, saldırı, yangın gibi acı olayların fotoğrafları da var. Toplam ~4.900 fotoğraf, günde ortalama 11, en çok 58. Eski yıllar için her 5 yıldan birinin gazete manşeti (1980, 1985 … 2000).
- 10 Kasım (3): Anılar'a gün seçici: ‹ › ile bir gün ileri/geri, tarihe dokununca ay+gün seçme paneli, 'Bugüne dön'. Gazete manşetleri artık her gün için 1980/85/90/95/2000.
- 10 Kasım (4): Anıların sonunda 'O yıllarda elimizde': 80'ler→2020'ler, 81 alet (jetonlu telefon, Walkman, Murat 124, Nokia 3310, MSN, Togg…), veri-ek/aletler.json. Görseller Vikipedi maddesinin baş görseli: metro.config.js /kadran-gorsel?wp=<madde>&wl=<dil> (sunucu çözer, diske saklar). Görseli inmeyen alet gösterilmez.

## 13 Kasım — Ana sayfa "Twitter havası" (1. adım)
- Akış kartları gönderi düzeninde: solda hesap simgesi, ad · tarih, kısa cümle, medya, eylemler (💬 Anın · ⏳ X yıl önce · ♡ · ↗). Hesaplar Kadran'ın kendi bölümleri (Kadran Manşet / Radyo / Saha / Piyasa / Ekran / Sinema / Gündem / Dünya / Deprem / Anma / Gazete). Gerçek gazete ya da kişi adına konuşmuyoruz; kaynak "Kaynak: …" diye altta. Sahte beğeni/RT sayısı yok.
- Yeni "Kadran Gazete" gönderisi: o sabahın ön sayfasının üst yarısı (Milliyet/arşiv). Görsel inmezse gönderi hiç görünmez.
- Kullanıcı anıları: her yılın başında "27 Ekim 1987'de ne yapıyordun?" satırı → yazma penceresi (280 karakter) → "Sen" gönderisi. Şimdilik telefonda (useStored 'anilarim'); odalar gelince paylaşılacak.
- haberler.ts: "Harita: / Video: / Galeri:" gibi içerik başlıkları elendi (NYT harita başlığı depremi ikinci kez gösteriyordu).
- Telif notu: tek tek haber başlıkları kaynak göstererek kullanılabilir (FSEK m.36 / günlük haberler eser sayılmıyor — Yargıtay kararı). Gazete sayfa taramalarının toplu kullanımı ve logo/hesap taklidi ayrı konu: yayından önce arşiv sahibinden izin + avukat görüşü.


## 13 Kasım (akşam) — 1950'ye açılış, Raflar, veri temizliği
- Akış 1950'ye kadar iniyor: Vikipedi olayları, milli maçlar (CC0 veri seti), resmî dolar kuru (devalüasyon tarihleri + OECD/FRED), o yılın filmi/plağı. 1950-79 gün sayfası açılıyor.
- Asgari ücret (ÇSGB, 1974-2026), ekmek fiyatı ve "bir ekmek için kaç dakika çalışmak" (Hürriyet, İHA/DİSK) cüzdana eklendi.
- "Ne oldu? / Kimdi?" satırı hazır; veri VERI_TOPLA_ESKI.bat ile gelecek (baglam.json).
- Oyun sekmesi kaldırıldı; yerine Raflar: Filmler, Plaklar, Diziler, Maçlar, Gazeteler, Depremler, Fiyatlar, Aletler.
- Veri temizliği: yabancı olaylar Türkiye manşeti olmuyor, İngilizce ve çöp başlıklar gösterilmiyor, Türkiye/Dünya etiketi düzeldi, maç dili ("2 gün sonra oynanacak maç"), 2001 öncesi "1. Lig", yıl ekleri, parantezli adlar.
- Deprem verisi: 6 Şubat 2023 (7,7 ve 7,6) ve 30 Ekim 2020 İzmir (6,6) eklendi; 960 yer adındaki bozuk harf düzeldi; toplayıcı artık büyük depremleri kontrol ediyor.
- Anılar: 16 fotoğraf doğru güne taşındı, boş altyazılı 12 fotoğraf çıktı. Gün sayfasında yabancı reklam/dizi/eşya yerine kendi aletler listemiz.
- Sırada: ana ekran yeniden tasarım (A/B/C/D seçenekleri), ışınlanma ekranı, Anılar fotoğraflarını 80'ler-90'lar ağırlıklı yeniden toplamak.

## 14 Kasım — Yayın ayarı, Twitter akışı, rapor düzeltmeleri
- GAZETE_TARAMA = false: uygulama artık yayındaymış gibi; taramalar yok, yerine Kadran Gazetesi + "arşivde aç" bağlantısı. Raflar'da Gazeteler rafı da böyle.
- Akış Twitter gibi: her haber ayrı gönderi, açıklamalı olanlar kalın başlık + paragraf, açıklamasızlar aralara dağıtılıyor. "Anın" (yorum) kısmı kaldırıldı.
- Hız: sekmeler bir kez kurulup gizleniyor, akış 8'er yıl yükleniyor, ışınlanma 1,5-2 sn.
- Görseller: 500 px küçük kopya, aynı anda 6 indirme, inmeyenler .gorsel-onbellek/hatalar.log; çizilmiş sahte kapak/afiş yok; sadece serbest lisanslı görsel (telifli afiş yok).
- ACIKLAMA_TOPLA.bat: gazete başlıklarına haberin kendi arşiv sayfasından kısa açıklama (henüz çalıştırılmadı).
- Rapor düzeltmeleri: çıkmamış şarkı yok, oynanmamış maçta skor yok, büyük maç öncelikli, aynı olay iki kez çıkmıyor, tutarsız vefat kayıtları (doğum > ölüm, 105 yaş üstü) atılıyor, NYT başlıkları cümle düzeninde, tık tuzağı başlıklar atılıyor, alakasız görseller (logo, şehir, kale) atılıyor, Samu metni düzeltildi, renkli TV notu düzeltildi.
- Bekleyen: verinin internete konması (BASLAT'sız çalışma), 2026 Haziran sonrası veri, 70'ler-80'ler boşluğu, Anılar'ın anı gibi olması, git ile yedek.
