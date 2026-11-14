// ../expo/mobile/src/data.ts
var AY_NO = { Oca: 1, \u015Eub: 2, Mar: 3, Nis: 4, May: 5, Haz: 6, Tem: 7, A\u011Fu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12 };
function notTarihi(note) {
  const m = note?.match(/(\d{1,2}) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara) (\d{4})/);
  return m ? `${m[3]}-${String(AY_NO[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
var cikmisMi = (note, iso) => {
  const t = notTarihi(note);
  return !t || t <= iso;
};
function cleanTitle(s) {
  return s.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
}
function looksTurkish(s) {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(s)) return true;
  return !/\b(the|of|and|in|to|for|with|on|is|are)\b/i.test(s);
}
function isNewsy(title) {
  return cleanTitle(title).split(" ").filter(Boolean).length >= 3;
}
var KOTU_TUR = /* @__PURE__ */ new Set(["sezon", "basketball game", "futbol kul\xFCpleri aras\u0131 ma\xE7", "d\xFCzenli olarak tekrarlanan spor etkinli\u011Fi", "spor sezonu"]);
function iyiOlay(e) {
  if (e.tur && KOTU_TUR.has(e.tur)) return false;
  return !/\bvs\b|\d{8}$|listesi$|Ligi$|Lig$|sezonu|Season|League|Wikimedia|Under-\d+|\bat the\b/i.test(e.n);
}
var ILLER = "Adana|Ad\u0131yaman|Afyon|A\u011Fr\u0131|Amasya|Ankara|Antalya|Artvin|Ayd\u0131n|Bal\u0131kesir|Bilecik|Bing\xF6l|Bitlis|Bolu|Burdur|Bursa|\xC7anakkale|\xC7ank\u0131r\u0131|\xC7orum|Denizli|Diyarbak\u0131r|Edirne|Elaz\u0131\u011F|Erzincan|Erzurum|Eski\u015Fehir|Gaziantep|Giresun|G\xFCm\xFC\u015Fhane|Hakk\xE2ri|Hakkari|Hatay|Isparta|Mersin|\u0130stanbul|\u0130zmir|Kars|Kastamonu|Kayseri|K\u0131rklareli|K\u0131r\u015Fehir|Kocaeli|Konya|K\xFCtahya|Malatya|Manisa|Kahramanmara\u015F|Mardin|Mu\u011Fla|Mu\u015F|Nev\u015Fehir|Ni\u011Fde|Ordu|Rize|Sakarya|Samsun|Siirt|Sinop|Sivas|Tekirda\u011F|Tokat|Trabzon|Tunceli|\u015Eanl\u0131urfa|U\u015Fak|Van|Yozgat|Zonguldak|Aksaray|Bayburt|Karaman|K\u0131r\u0131kkale|Batman|\u015E\u0131rnak|Bart\u0131n|Ardahan|I\u011Fd\u0131r|Yalova|Karab\xFCk|Kilis|Osmaniye|D\xFCzce";
var TR_RE = new RegExp(`T\xFCrkiye|(?:^|[^A-Za-z\xC7\u011E\u0130\xD6\u015E\xDC\xE7\u011F\u0131\xF6\u015F\xFC])(?:T\xFCrk(?!men|i?stan)|TBMM|Meclis|Atat\xFCrk|Anadolu|Marmara|G\xF6lc\xFCk|\xDCsk\xFCdar|Kad\u0131k\xF6y|Beyo\u011Flu|Taksim|Bo\u011Fazi\xE7i|G\xFCm\xFC\u015Fsuyu|Tuzla|\u015Ei\u015Fli|Bak\u0131rk\xF6y|Esenyurt|Pendik|\xDCmraniye|K\u0131z\u0131lay|\xC7ankaya|PKK|DHKP|TSK|M\u0130T|Y\xD6K|Diyanet|THY|TRT|CHP|AKP|AK Parti|MHP|HDP|DEM Parti|DYP|ANAP|SHP|DSP|Refah Partisi|\u0130Y\u0130 Parti|Erdo\u011Fan|Ecevit|\xD6zal|Demirel|\xC7iller|Erbakan|Mesut Y\u0131lmaz|Baykal|Bah\xE7eli|K\u0131l\u0131\xE7daro\u011Flu|Davuto\u011Flu|Abdullah G\xFCl|Necdet Sezer|Kenan Evren|Galatasaray|Fenerbah\xE7e|Be\u015Fikta\u015F|Trabzonspor|K\u0131br\u0131s|KKTC|${ILLER})(?![a-z\xE7\u011F\u0131\xF6\u015F\xFC])`);
var trMi = (t) => TR_RE.test(t);
var cumleMi = (t) => t.trim().split(/\s+/).length >= 5 && !/\(\d{4}/.test(t);
function gununOlaylari(ek, iso) {
  const list = ek?.gundem?.gunler[iso.slice(5)]?.[iso.slice(0, 4)] ?? [];
  return { tr: list.filter((x) => trMi(x.t)).map((x) => x.t), dunya: list.filter((x) => !trMi(x.t)).map((x) => x.t) };
}

// ../expo/mobile/src/haberler.ts
var anahtar = (t) => cleanTitle(t).toLocaleLowerCase("tr-TR").replace(/[^a-zçğıöşü0-9]/g, "").slice(0, 22);
var MADDE_KAYNAK = /* @__PURE__ */ new Set(["Vikipedi (G\xFCncel olaylar)", "Vikipedi", "Vikipedi (d\xFCnya \u2014 olaylar)"]);
var OLAY_GOVDE_KAYNAK = /* @__PURE__ */ new Set(["Vikipedi (g\xFCn \u2014 olaylar)", "Vikipedi \u2014 Tarihte bug\xFCn", "Vikipedi (T\xFCrkiye y\u0131l makalesi)", "Vikipedi (y\u0131l makalesi)"]);
var WIKIDATA_KAYNAK = /* @__PURE__ */ new Set(["Wikidata (T\xFCrkiye olay\u0131)", "Wikidata (d\xFCnya olay\u0131)", "Wikidata / Vikipedi"]);
var OLAY_ADI = /(deprem|savaş|harekât|harekat|operasyon|saldırı|suikast|darbe|seçim|referandum|kaza|faciası|felaket|yangın|sel\b|kriz|protesto|ayaklanma|isyan|katliam|bombalama|patlama|kongre|zirve|antlaşma|anlaşma|beyanname|şampiyona|olimpiyat|kupa|final|maçı|turnuva|festival|fırtına|tsunami|kasırga|salgın|pandemi|grev|muharebe|kuşatma|işgal|sefer sayılı|tecrit|ilanı|açılış|tören|cenaze)/i;
var GENEL_GORSEL = /(\.svg|flag|bayra|map\b|_map|map_|harita|locator|location|logo|seal|coat_of_arms|arma|emblem|collage|fallback|amp_default|default\.|icon|banner|diagram|chart)/i;
var YIL = /(19[0-9]\d|20[0-2]\d)/g;
var kaynakAdi = (e) => e.sources?.[0]?.name ?? "";
var gelecekYilVar = (metin, yil) => (metin.match(YIL) ?? []).some((y) => Number(y) > yil);
function gorselUygun(url, yil) {
  if (!url || url.startsWith("/")) return null;
  let ad = url.split("/").pop() ?? "";
  try {
    ad = decodeURIComponent(ad);
  } catch {
  }
  if (GENEL_GORSEL.test(ad) || gelecekYilVar(ad, yil)) return null;
  return url.replace(/^http:\/\//, "https://");
}
var wikimedia = (url) => /wikimedia|wikipedia/.test(url);
var copBaslik = (t) => t.length < 14 || /View International Edition|^EURO\s|USD\s.*ALTIN|(\d+,\d+.*){3}/.test(t);
function arsivOlayi(e, yil) {
  const k = kaynakAdi(e);
  const ham = e.image?.placeholder ? null : e.image?.url ?? null;
  let title = cleanTitle(e.title);
  let body = e.body ? e.body.replace(/\s+/g, " ").trim() : void 0;
  let img = null;
  if (copBaslik(title)) return null;
  if (OLAY_GOVDE_KAYNAK.has(k)) {
    if (!body || body.length < 20) return null;
    title = body.length > 220 ? body.slice(0, 217).replace(/\s+\S*$/, "") + "\u2026" : body;
    body = void 0;
  } else if (MADDE_KAYNAK.has(k)) {
    if (!cumleMi(title) && !OLAY_ADI.test(title)) return null;
    body = void 0;
  } else if (WIKIDATA_KAYNAK.has(k)) {
    img = gorselUygun(ham, yil);
  } else if (ham && !wikimedia(ham)) {
    img = gorselUygun(ham, yil);
  }
  if (body && (gelecekYilVar(body, yil) || body.length < 30 || !looksTurkish(body))) body = void 0;
  if (body && body.toLocaleLowerCase("tr-TR").startsWith(title.toLocaleLowerCase("tr-TR").slice(0, 30)) && body.length < title.length + 20) body = void 0;
  return { title, body, img, kaynak: kaynakEtiketi(k) };
}
var kaynakEtiketi = (k) => k.replace(/\s*\((gazete arşivi|haber arşivi|web arşivi|arşiv|dünya)\)/, " ar\u015Fivi").replace(/\s*\(.*?\)/, "") || "Kadran ar\u015Fivi";
function haberleriTopla(d, ek) {
  const yil = Number(d.date.slice(0, 4));
  const out = [];
  const gor = /* @__PURE__ */ new Set();
  const ekle = (h) => {
    const k = anahtar(h.title);
    if (!k || gor.has(k)) return;
    gor.add(k);
    out.push(h);
  };
  const arsiv = (d.events ?? []).filter((e) => isNewsy(e.title) && looksTurkish(e.title)).sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0)).map((e) => ({ e, o: arsivOlayi(e, yil) })).filter((x) => !!x.o);
  const gun2 = gununOlaylari(ek, d.date);
  const trOlay = (e, o) => e.scope === "TR" && trMi(`${o.title} ${o.body ?? ""}`) && !/NYT|New York Times/.test(`${e.body ?? ""} ${kaynakAdi(e)}`);
  for (const { e, o } of arsiv.filter(({ e: e2, o: o2 }) => trOlay(e2, o2))) ekle({ ...o, scope: "TR" });
  for (const w of (ek?.wd?.olay[d.date] ?? []).filter((w2) => iyiOlay(w2) && looksTurkish(w2.n))) ekle({ title: w.n, img: gorselUygun(w.img, yil), scope: "TR", kaynak: "Wikidata" });
  for (const t of ek?.turkiye?.olay[d.date] ?? []) ekle({ title: cleanTitle(t), scope: "TR", kaynak: "Vikipedi" });
  for (const t of gun2.tr) ekle({ title: cleanTitle(t), scope: "TR", kaynak: "Vikipedi" });
  for (const { e, o } of arsiv.filter(({ e: e2, o: o2 }) => !trOlay(e2, o2) && (cumleMi(o2.title) || o2.body || OLAY_ADI.test(o2.title)))) ekle({ ...o, scope: "world" });
  for (const t of gun2.dunya) ekle({ title: cleanTitle(t), scope: "world", kaynak: "Vikipedi" });
  const puan = (h) => (h.img ? 2 : 0) + (h.body ? 1 : 0);
  return out.map((h, i) => ({ h, i })).sort((a, b) => a.h.scope === b.h.scope ? puan(b.h) - puan(a.h) || a.i - b.i : 0).map((x) => x.h);
}

// test.ts
var fs = require("fs");
var path = require("path");
var root = process.argv[2];
var decs = process.argv.slice(3);
var gun = 0;
var haber = 0;
var gorsel = 0;
var govde = 0;
var tr = 0;
var film0 = 0;
var film1 = 0;
var ornek = [];
var gorselOrnek = [];
for (const dec of decs) for (const f of fs.readdirSync(path.join(root, dec))) {
  const d = JSON.parse(fs.readFileSync(path.join(root, dec, f), "utf8"));
  gun++;
  const h = haberleriTopla(d, null);
  haber += h.length;
  gorsel += h.filter((x) => x.img).length;
  govde += h.filter((x) => x.body).length;
  tr += h.filter((x) => x.scope === "TR").length;
  for (const c of d.cinema ?? []) {
    film0++;
    if (cikmisMi(c.note, d.date)) film1++;
  }
  if (Math.random() < 4e-3) ornek.push([d.date, h.slice(0, 3).map((x) => `${x.scope}|${x.title.slice(0, 70)}|${x.body ? "G" : "-"}|${x.img ? x.img.split("/").pop().slice(0, 40) : "-"}|${x.kaynak}`)]);
  for (const x of h) if (x.img && Math.random() < 0.01) gorselOrnek.push([d.date, x.title.slice(0, 60), x.img.split("/").pop().slice(0, 60)]);
}
console.log(JSON.stringify({ gun, haber, gorsel, govde, tr, film0, film1 }));
for (const o of ornek.slice(0, 18)) console.log(o[0], "\n   " + o[1].join("\n   "));
console.log("--- g\xF6rsel \xF6rnekleri");
for (const g of gorselOrnek.slice(0, 30)) console.log("  ", g.join(" | "));
