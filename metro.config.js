// Veri, uygulamayı telefona gönderen Expo sunucusunun üzerinden servis edilir.
// Böylece ikinci bir sunucuya / porta (ve güvenlik duvarı iznine) gerek kalmaz.
// Web projesindeki dosyalar sadece okunur, değiştirilmez.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

const DATA_DIR = path.resolve(
  process.env.KADRAN_DATA || path.join(__dirname, '..', '..', 'kadran', 'public', 'data'),
);
const PREFIX = '/kadran-data/';
const EK_DIR = path.join(__dirname, 'veri-ek');
const EK_PREFIX = '/kadran-ek/';
const GZ_PREFIX = '/kadran-gazete/';

/* ---------- Gazete görsel aracısı (web projesindeki /api/gazete ile aynı mantık) ----------
 * GET /kadran-gazete/1996-10-27            → o günün ön sayfası
 * GET /kadran-gazete/1996-10-27?page=3     → 3. sayfa (Milliyet)
 * GET ...&variant=thumb                    → küçük görsel
 * Milliyet görsel bağlantıları süreli olduğu için her istekte taze çözülür (20 dk önbellek).
 * Türkiye Gazetesi PDF olduğu için burada servis edilmez; uygulama PDF'i doğrudan açar. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const MIL_REF = 'https://gazetearsivi.milliyet.com.tr/';
const GASTE_REF = 'https://www.gastearsivi.com/';
const MIL_API = 'https://gazetearsivi-api.milliyet.com.tr/api/v1';
const tokImg = (tok) => `${MIL_API}/NewspaperImage/Image/${String(tok || '').replace('/AuthImage/', '')}`;
const gzCache = new Map();
const gzInflight = new Map();

async function getText(url, referer) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (a === 2) return null;
      await new Promise((res) => setTimeout(res, 600 * (a + 1)));
    }
  }
  return null;
}

/* Ön sayfa için sadece liste sayfası yeter; sayfa listesi (galeri) ayrıca ve gerektiğinde çözülür. */
async function resolveMilliyet(iso) {
  const hit = gzCache.get(iso);
  if (hit && Date.now() - hit.at < 20 * 60 * 1000) return hit.data;
  if (gzInflight.has(iso)) return gzInflight.get(iso);
  const p = (async () => {
    const html = await getText(`https://gazetearsivi.milliyet.com.tr/liste?tarih=${iso.replace(/-/g, '.')}`, MIL_REF);
    if (html == null) return null;
    let front = null;
    const m = html.match(/url=(https%3A%2F%2Fgazetearsivi-api[^&"']*NewspaperImage%2FImage%2F[^&"']*)/);
    if (m) front = decodeURIComponent(m[1]);
    else {
      const m2 = html.match(/https:\/\/gazetearsivi-api\.milliyet\.com\.tr\/api\/v1\/NewspaperImage\/Image\/[A-Za-z0-9_]+/);
      if (m2) front = m2[0];
    }
    const e = html.match(/\\"broadcastId\\":\d+,\\"id\\":\\"([^\\"]+)\\"/) || html.match(/"broadcastId":\d+,"id":"([^"]+)"/);
    const data = { front, eid: e ? e[1] : null, pages: null };
    gzCache.set(iso, { at: Date.now(), data });
    return data;
  })().finally(() => gzInflight.delete(iso));
  gzInflight.set(iso, p);
  return p;
}

async function milliyetPages(iso) {
  const g = await resolveMilliyet(iso);
  if (!g) return null;
  if (g.pages) return g;
  if (!g.pagesP) {
    g.pagesP = (async () => {
      if (!g.eid) return [];
      const txt = await getText(`${MIL_API}/Newspaper/GetNewspaperPages/${g.eid}`, MIL_REF);
      try {
        const j = JSON.parse(txt || '{}');
        return ((j.result && j.result.virtualPages) || []).filter((x) => x.pageFileOrjUrl)
          .map((x) => ({ no: x.pageNo, thumb: tokImg(x.pageFileThumbUrl), full: tokImg(x.pageFileOrjUrl) }));
      } catch (err) { return []; }
    })();
  }
  g.pages = await g.pagesP;
  return g;
}

/* İndirilen görselleri bellekte tut (aynı sayfa ikinci kez anında gelsin) */
const imgCache = new Map();
const IMG_MAX = 120;
function imgPut(key, val) {
  imgCache.set(key, val);
  if (imgCache.size > IMG_MAX) imgCache.delete(imgCache.keys().next().value);
}

async function serveGazete(req, res) {
  const u = new URL(req.url, 'http://yerel');
  const iso = u.pathname.slice(GZ_PREFIX.length);
  const send = (code, msg) => { res.statusCode = code; res.setHeader('Cache-Control', 'public, max-age=60'); res.end(msg || ''); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return send(400, 'Gecersiz tarih');
  const page = u.searchParams.get('page');
  const thumb = u.searchParams.get('variant') === 'thumb';
  const key = `${iso}|${page || 'on'}|${thumb ? 't' : 'f'}`;
  const cached = imgCache.get(key);
  if (cached) {
    res.setHeader('Content-Type', cached.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(cached.buf);
  }
  let day = null;
  try {
    const y = Number(iso.slice(0, 4));
    day = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${Math.floor(y / 10) * 10}s`, `${iso}.json`), 'utf8'));
  } catch (e) { /* gün dosyası yoksa Milliyet denenir */ }
  const front = day && day.newspaperFront;
  const provider = (front && front.provider) || 'milliyet';
  let src = null, ref = MIL_REF;
  if (provider === 'turkiyegazetesi') return send(415, 'PDF');
  if (provider !== 'milliyet' && front && page == null) { src = front.image && front.image.url; ref = GASTE_REF; }
  else {
    if (page != null) {
      const g = await milliyetPages(iso);
      if (!g) return send(502, 'Arsive ulasilamadi');
      const pg = g.pages.find((x) => String(x.no) === String(page));
      src = pg ? (thumb ? pg.thumb : pg.full) : null;
    } else {
      const g = await resolveMilliyet(iso);
      if (!g) return send(502, 'Arsive ulasilamadi');
      src = g.front;
      if (!src) { const g2 = await milliyetPages(iso); src = g2 && g2.pages[0] ? g2.pages[0].full : null; }
    }
  }
  if (!src) return send(404, 'Gazete gorseli yok');
  try {
    const r = await fetch(src, { headers: { 'User-Agent': UA, Referer: ref }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) { gzCache.delete(iso); return send(502, 'Gorsel alinamadi'); }
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || 'image/jpeg';
    imgPut(key, { buf, type });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (e) { send(502, 'Gorsel alinamadi'); }
}

/* ---------- Görsel aracısı (Wikimedia) ----------
 * GET /kadran-gorsel?u=<wikimedia görsel adresi>
 * Wikimedia, uygulamalardan gelen çok sayıda görsel isteğini "bot" sayıp 429 ile engelliyor.
 * Bu yüzden telefon görselleri doğrudan değil, buradan alır: sunucu kendini tanıtarak, en fazla
 * 3 istek aynı anda, 429'da bekleyip yeniden deneyerek indirir ve diske saklar (bir kez iner).
 * Önbellek: kadran-mobile/.gorsel-onbellek/  (silinebilir, gerekirse yeniden iner) */
const GR_PREFIX = '/kadran-gorsel';
const GR_DIR = path.join(__dirname, '.gorsel-onbellek');
const GR_UA = 'KadranMobil/0.1 (https://github.com/gencyusuftalha9-oss/kadran; Turkiye nostalji uygulamasi) node-fetch';
const GR_IZINLI = /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//;
const grInflight = new Map();
let grAktif = 0; const grSira = [];
const grSlot = () => new Promise((res) => { if (grAktif < 6) { grAktif++; res(); } else grSira.push(res); });
// inmeyen görseller: 10 dakika boyunca yeniden denenmez (telefon boşuna beklemesin); nedenleri hatalar.log'a yazılır
const grHata = new Map();
const grLog = (url, durum) => fs.promises.appendFile(path.join(GR_DIR, 'hatalar.log'), `${new Date().toISOString()} ${durum} ${url}\n`).catch(() => {});
const grBirak = () => { const n = grSira.shift(); if (n) n(); else grAktif--; };
const grAnahtar = (u) => require('crypto').createHash('sha1').update(u).digest('hex');

async function grIndir(u) {
  await grSlot();
  try {
    for (let a = 0; a < 4; a++) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': GR_UA, Referer: 'https://kadran.app/' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
        if (r.status === 429 || r.status >= 500) {
          const bekle = Math.min(15, Number(r.headers.get('retry-after')) || 3 * (a + 1));
          await new Promise((res) => setTimeout(res, bekle * 1000));
          continue;
        }
        if (!r.ok) return { durum: r.status };
        const tur = r.headers.get('content-type') || 'image/jpeg';
        if (!tur.startsWith('image/')) return { durum: 415 };
        return { durum: 200, tur, veri: Buffer.from(await r.arrayBuffer()) };
      } catch (e) {
        if (a === 3) return { durum: 502 };
        await new Promise((res) => setTimeout(res, 800 * (a + 1)));
      }
    }
    return { durum: 429 };
  } finally { grBirak(); }
}

/* Vikipedi maddesinin baş görseli: GET /kadran-gorsel?wp=Nokia_3310&wl=en
 * (dönemin aletleri gibi listelerde dosya adını bilmeden maddenin kendi görselini kullanmak için).
 * Madde → görsel adresi eşlemesi diske yazılır, görselin kendisi normal yoldan iner ve saklanır. */
const wpBellek = new Map();
async function wpCoz(baslik, dil) {
  const k = `${dil}:${baslik}`;
  if (wpBellek.has(k)) return wpBellek.get(k);
  const dosya = path.join(GR_DIR, 'wp-' + grAnahtar(k));
  try { const u = (await fs.promises.readFile(dosya, 'utf8')).trim(); wpBellek.set(k, u); return u; } catch {}
  let u = '';
  await grSlot();
  try {
    const api = `https://${dil}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=330&redirects=1&format=json&titles=${encodeURIComponent(baslik)}`;
    const r = await fetch(api, { headers: { 'User-Agent': GR_UA }, signal: AbortSignal.timeout(20000) });
    if (r.ok) {
      const j = await r.json();
      const sayfa = Object.values((j.query && j.query.pages) || {})[0];
      u = (sayfa && sayfa.thumbnail && sayfa.thumbnail.source) || '';
    }
  } catch {} finally { grBirak(); }
  wpBellek.set(k, u);
  fs.promises.mkdir(GR_DIR, { recursive: true }).then(() => fs.promises.writeFile(dosya, u)).catch(() => {});
  return u;
}

/* Wikidata kaydı → Türkçe Vikipedi maddesi → maddedeki serbest lisanslı görsel. GET /kadran-gorsel?q=Q123 */
async function qCoz(q) {
  const k = `q:${q}`;
  if (wpBellek.has(k)) return wpBellek.get(k);
  const dosya = path.join(GR_DIR, 'wp-' + grAnahtar(k));
  try { const u = (await fs.promises.readFile(dosya, 'utf8')).trim(); wpBellek.set(k, u); return u; } catch {}
  let u = '';
  await grSlot();
  try {
    const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${q}&props=sitelinks&sitefilter=trwiki|enwiki&format=json`, { headers: { 'User-Agent': GR_UA }, signal: AbortSignal.timeout(20000) });
    const e = r.ok ? (await r.json()).entities?.[q] : null;
    for (const [site, dil] of [['trwiki', 'tr'], ['enwiki', 'en']]) {
      const baslik = e?.sitelinks?.[site]?.title;
      if (!baslik) continue;
      // yalnızca serbest lisanslı görseller (Vikipedi'deki telifli afiş/kapaklar alınmaz)
      const api = `https://${dil}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=330&redirects=1&format=json&titles=${encodeURIComponent(baslik)}`;
      const r2 = await fetch(api, { headers: { 'User-Agent': GR_UA }, signal: AbortSignal.timeout(20000) });
      const sayfa = r2.ok ? Object.values(((await r2.json()).query || {}).pages || {})[0] : null;
      u = (sayfa && sayfa.thumbnail && sayfa.thumbnail.source) || '';
      if (u) break;
    }
  } catch {} finally { grBirak(); }
  wpBellek.set(k, u);
  fs.promises.mkdir(GR_DIR, { recursive: true }).then(() => fs.promises.writeFile(dosya, u)).catch(() => {});
  return u;
}

async function serveGorsel(req, res) {
  const sp = new URL(req.url, 'http://x').searchParams;
  let u = sp.get('u') || '';
  if (!u && sp.get('q')) {
    u = /^Q\d+$/.test(sp.get('q')) ? await qCoz(sp.get('q')) : '';
    if (!u) { res.statusCode = 404; return res.end(); }
  }
  if (!u && sp.get('wp')) {
    const dil = /^[a-z]{2}$/.test(sp.get('wl') || '') ? sp.get('wl') : 'en';
    u = await wpCoz(sp.get('wp'), dil);
    if (!u) { res.statusCode = 404; return res.end(); }
  }
  const url = u.replace(/^http:\/\//, 'https://');
  if (!GR_IZINLI.test(url)) { res.statusCode = 400; return res.end(); }
  const k = grAnahtar(url);
  const dosya = path.join(GR_DIR, k);
  const gonder = (tur, veri) => {
    res.setHeader('Content-Type', tur);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(veri);
  };
  try {
    const veri = await fs.promises.readFile(dosya);
    const tur = (await fs.promises.readFile(dosya + '.tur', 'utf8').catch(() => 'image/jpeg')).trim();
    return gonder(tur, veri);
  } catch {}
  const h = grHata.get(k);
  if (h && Date.now() - h.t < 10 * 60e3) { res.statusCode = h.durum; return res.end(); }
  if (!grInflight.has(k)) grInflight.set(k, grIndir(url).finally(() => grInflight.delete(k)));
  const r = await grInflight.get(k);
  if (r.durum !== 200) { grHata.set(k, { durum: r.durum, t: Date.now() }); grLog(url, r.durum); res.statusCode = r.durum; return res.end(); }
  fs.promises.mkdir(GR_DIR, { recursive: true })
    .then(() => Promise.all([fs.promises.writeFile(dosya, r.veri), fs.promises.writeFile(dosya + '.tur', r.tur)]))
    .catch(() => {});
  gonder(r.tur, r.veri);
}

const previous = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => {
      if (req.url && req.url.startsWith(GR_PREFIX + '?')) {
        serveGorsel(req, res).catch(() => { res.statusCode = 500; res.end(); });
        return;
      }
      if (req.url && req.url.startsWith(GZ_PREFIX)) {
        serveGazete(req, res).catch(() => { res.statusCode = 500; res.end(); });
        return;
      }
      const isEk = req.url && req.url.startsWith(EK_PREFIX);
      if (req.url && (req.url.startsWith(PREFIX) || isEk)) {
        const dir = isEk ? EK_DIR : DATA_DIR;
        const rel = decodeURIComponent(req.url.split('?')[0].slice((isEk ? EK_PREFIX : PREFIX).length));
        const file = path.resolve(dir, rel);
        if (!file.startsWith(dir + path.sep) || !file.endsWith('.json')) {
          res.statusCode = 403;
          return res.end();
        }
        return fs.readFile(file, (err, buf) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (err) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'bulunamadi', file: rel }));
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(buf);
        });
      }
      return base(req, res, next);
    };
  },
};

module.exports = config;
