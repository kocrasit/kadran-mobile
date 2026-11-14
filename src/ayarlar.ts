/**
 * Uygulama ayarları.
 *
 * GAZETE_TARAMA: gazete arşivlerinin sayfa taramaları (Milliyet, Gaste Arşivi…) uygulamada görünsün mü?
 * - true  → geliştirme: taramalar gün sayfasında, hikâyede, akışta ve anılarda görünür (sadece kendi telefonumuzda).
 * - false → YAYIN: taramaları biz göstermeyiz (izin yok). Yerine kendi tasarımımız "Kadran Gazetesi" ve
 *           gazetenin kendi arşivine "Arşivde aç ↗" bağlantısı gelir.
 * Günlerim paylaşım kartları (Instagram'a gider) bu ayardan bağımsız olarak HİÇBİR ZAMAN tarama kullanmaz.
 */
export const GAZETE_TARAMA = false;
