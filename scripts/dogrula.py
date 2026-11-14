#!/usr/bin/env python3
"""
Kadran veri doğrulama scripti.

Web projesindeki gün dosyalarını (kadran/public/data/<dönem>/<YYYY-MM-DD>.json)
SADECE OKUR, hiçbirini değiştirmez. Bulduğu sorunları raporlar.

Kullanım:
    python scripts/dogrula.py                      # tüm dönemler
    python scripts/dogrula.py 1990s                # tek dönem
    python scripts/dogrula.py --rapor              # dönem sonuçlarını birleştirip rapor yaz

Çıktılar (kadran-mobile/rapor/):
    sonuc_<dönem>.json   — dönem dönem ham sonuçlar
    VERI_RAPORU.md       — okunabilir özet
"""
import glob
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.environ.get("KADRAN_DATA") or os.path.normpath(os.path.join(ROOT, "..", "..", "kadran", "public", "data"))
OUT = os.path.join(ROOT, "rapor")

AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
EN_WORDS = re.compile(r"\b(the|of|and|in|to|for|with|on|is|are|after|over|at)\b", re.I)
TR_CHARS = re.compile(r"[çğıöşüÇĞİÖŞÜ]")
DATE_IN_TEXT = re.compile(r"\b(\d{1,2}) (" + "|".join(AY_KISA) + r") (\d{4})\b")
SECTIONS = ["events", "music", "tv", "cinema", "sports", "notableBirths", "weather", "economy"]

ISSUE_TYPES = {
    "madde_adi": "Haber değil, sadece bir Vikipedi madde adı (ör. 'Çin', 'Kertenkele')",
    "ingilizce_baslik": "Haber başlığı İngilizce",
    "yanlis_tarih": "Kayıt içindeki tarih dosyanın tarihiyle uyuşmuyor (ör. 12 Ekim maçı 12 Mayıs'ta)",
    "alakasiz_gorsel": "Görsel başka bir şeye ait görünüyor (ör. şarkıcı Nilüfer → nilüfer çiçeği)",
    "telifli_kaynak": "Telif riski taşıyan kaynak (Milliyet arşiv taraması, TMDB, Vikipedi afişi)",
    "bos_gun": "Günde haber, şarkı, dizi ve film bölümlerinin hepsi boş",
}


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def tokens(s):
    return {w for w in norm(s).split() if len(w) >= 3}


def page_title(url):
    if not url:
        return ""
    t = url.rstrip("/").split("/")[-1]
    try:
        from urllib.parse import unquote
        t = unquote(t)
    except Exception:
        pass
    return t.replace("_", " ")


def image_mismatch(name, img):
    """Görselin kaynak sayfası isimle hiç ortak kelime taşımıyorsa şüpheli say."""
    if not img or img.get("placeholder"):
        return None
    src = img.get("sourcePage") or ""
    if "wikidata.org" in src or not src:
        return None  # Wikidata kimliği: isimden kontrol edilemez
    pt = page_title(src)
    if not tokens(name) or not tokens(pt):
        return None
    if tokens(name) & tokens(pt):
        return None
    return pt


def check_day(path):
    iso = os.path.basename(path)[:-5]
    y, m, d = (int(x) for x in iso.split("-"))
    today = f"{d} {AY_KISA[m - 1]} {y}"
    with open(path, encoding="utf-8") as f:
        day = json.load(f)
    issues = []

    def add(kind, section, text, extra=None):
        issues.append({"tarih": iso, "tur": kind, "bolum": section, "kayit": text[:160], **({"ayrinti": extra} if extra else {})})

    for e in day.get("events") or []:
        t = (e.get("title") or "").strip()
        words = [w for w in re.sub(r"^#+", "", t).split() if w]
        if len(words) < 3:
            add("madde_adi", "events", t)
        elif not TR_CHARS.search(t) and EN_WORDS.search(t):
            add("ingilizce_baslik", "events", t)

    for s in day.get("sports") or []:
        det = s.get("detail") or ""
        for dd, mon, yy in DATE_IN_TEXT.findall(det):
            if f"{int(dd)} {mon} {yy}" != today:
                add("yanlis_tarih", "sports", s.get("title", ""), f"kayıttaki tarih: {dd} {mon} {yy}")
                break

    for mu in day.get("music") or []:
        bad = image_mismatch(mu.get("artist", ""), mu.get("image"))
        if bad:
            add("alakasiz_gorsel", "music", f"{mu.get('title')} – {mu.get('artist')}", f"görselin sayfası: {bad}")
    for c in day.get("cinema") or []:
        img = c.get("image") or {}
        if img.get("license", "").startswith("Vikipedi (afiş)"):
            add("telifli_kaynak", "cinema", c.get("title", ""), "Vikipedi afişi (adil kullanım, ticari kullanım riskli)")
        bad = image_mismatch(c.get("title", ""), img)
        if bad:
            add("alakasiz_gorsel", "cinema", c.get("title", ""), f"görselin sayfası: {bad}")
    for tv in day.get("tv") or []:
        img = tv.get("image") or {}
        if "themoviedb" in (img.get("url") or ""):
            add("telifli_kaynak", "tv", tv.get("program", ""), "TMDB görseli")

    if day.get("newspaperFront") or day.get("newspaperPages"):
        add("telifli_kaynak", "newspaper", "Milliyet ön/iç sayfa taraması")

    filled = {k: bool(day.get(k)) for k in SECTIONS}
    tr_news = sum(1 for e in day.get("events") or [] if e.get("scope") == "TR" and len((e.get("title") or "").split()) >= 3)
    if not any(day.get(k) for k in ["events", "music", "tv", "cinema"]):
        add("bos_gun", "-", "haber/şarkı/dizi/film yok")

    return issues, filled, tr_news


def run(decade):
    files = sorted(glob.glob(os.path.join(DATA, decade, "*.json")))
    all_issues, cover, tr_days = [], Counter(), 0
    for p in files:
        try:
            iss, filled, trn = check_day(p)
        except Exception as ex:  # bozuk dosya
            all_issues.append({"tarih": os.path.basename(p), "tur": "bozuk_dosya", "bolum": "-", "kayit": str(ex)[:160]})
            continue
        all_issues.extend(iss)
        for k, v in filled.items():
            cover[k] += int(v)
        tr_days += int(trn > 0)
    os.makedirs(OUT, exist_ok=True)
    res = {"donem": decade, "gun": len(files), "kapsama": cover, "tr_haberli_gun": tr_days, "sorunlar": all_issues}
    with open(os.path.join(OUT, f"sonuc_{decade}.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False)
    print(f"{decade}: {len(files)} gün, {len(all_issues)} sorun")


def tr_num(n):
    return f"{n:,}".replace(",", ".")


def report():
    parts = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(OUT, "sonuc_*.json")))]
    total_days = sum(p["gun"] for p in parts)
    by_type = Counter()
    examples = defaultdict(Counter)
    for p in parts:
        for i in p["sorunlar"]:
            by_type[i["tur"]] += 1
            examples[i["tur"]][(i["kayit"], i.get("ayrinti", ""))] += 1

    L = ["# Kadran Veri Raporu", "", f"Taranan gün: **{tr_num(total_days)}**", ""]
    L += ["## Kapsama (bölümün dolu olduğu günlerin oranı)", "",
          "| Dönem | Gün | TR haberi | Şarkı | Dizi | Film | Spor | Doğanlar | Hava | Ekonomi |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for p in parts:
        n = max(p["gun"], 1)
        c = p["kapsama"]
        pct = lambda k: f"%{round(100 * c.get(k, 0) / n)}"
        L.append(f"| {p['donem']} | {p['gun']} | %{round(100 * p['tr_haberli_gun'] / n)} | {pct('music')} | {pct('tv')} | {pct('cinema')} | {pct('sports')} | {pct('notableBirths')} | {pct('weather')} | {pct('economy')} |")
    L += ["", "## Sorunlar", ""]
    for kind, cnt in by_type.most_common():
        L += [f"### {ISSUE_TYPES.get(kind, kind)} — {tr_num(cnt)} kayıt", ""]
        for (text, extra), k in examples[kind].most_common(12):
            L.append(f"- {text}" + (f" _({extra})_" if extra else "") + (f" — {k} günde" if k > 1 else ""))
        L.append("")
    L += ["## Bu script'in kontrol EDEMEDİKLERİ", "",
          "- Doğum/ölüm tarihlerinin doğruluğu (ör. Leonardo da Vinci 12 Mayıs'ta değil 2 Mayıs'ta öldü) — Wikidata ile karşılaştırma gerekir (internet erişimi).",
          "- Veride hiç olmayan diziler (ör. Kertenkele, 2014, ATV) — Türk dizileri listesiyle karşılaştırma gerekir.", ""]
    with open(os.path.join(OUT, "VERI_RAPORU.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    print("rapor yazıldı:", os.path.join(OUT, "VERI_RAPORU.md"))


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--rapor"]:
        report()
    else:
        decades = args or sorted(os.path.basename(p) for p in glob.glob(os.path.join(DATA, "*s")) if os.path.isdir(p))
        for dec in decades:
            run(dec)
        if not args:
            report()
