#!/usr/bin/env python3
"""
Süper Lig maç sonuçlarını (1994–2025) gün gün ek veri dosyalarına çevirir.
Kaynak: engsoccerdata (James Curley), turkey.csv — https://github.com/jalapic/engsoccerdata
Çıktı: veri-ek/maclar/<YIL>.json  →  { "YYYY-MM-DD": [[ev, deplasman, ev_gol, dep_gol], ...] }
Kullanım: python scripts/maclar_olustur.py <turkey.csv yolu>
"""
import csv, json, os, sys
from collections import defaultdict

TR = {
    'A. Sebatspor': 'Akçaabat Sebatspor', 'Ad. Demirspor': 'Adana Demirspor', 'Akhisar Belediyespor': 'Akhisarspor',
    'Ankaragucu': 'Ankaragücü', 'Antalya': 'Antalyaspor', 'Balikesirspor': 'Balıkesirspor', 'Besiktas': 'Beşiktaş',
    'Buyuksehyr': 'Başakşehir', 'Diyarbakirspor': 'Diyarbakırspor', 'Elazigspor': 'Elazığspor', 'Erzurum': 'Erzurumspor',
    'Eskisehirspor': 'Eskişehirspor', 'Eyupspor': 'Eyüpspor', 'Fenerbahce': 'Fenerbahçe', 'Genclerbirligi': 'Gençlerbirliği',
    'Goztep': 'Göztepe', 'Istanbulspor': 'İstanbulspor', 'Karabukspor': 'Karabükspor', 'Karagumruk SK': 'Fatih Karagümrük',
    'Karsiyaka': 'Karşıyaka', 'Kasimpasa': 'Kasımpaşa', 'Kayseri': 'Kayserispor', 'Mersin Idman Yurdu': 'Mersin İdmanyurdu',
    'Oftasspor': 'Oftaşspor', 'Osmanlispor': 'Osmanlıspor', 'P. Ofisi': 'Petrol Ofisi', 'Sariyer': 'Sarıyer',
    'Sekerspor': 'Şekerspor', 'Siirt Jet-PA': 'Siirt Jetpa', 'Umraniyespor': 'Ümraniyespor', 'Gaziantep FK': 'Gaziantep FK',
}
tr = lambda n: TR.get(n, n)

def main(src):
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'veri-ek', 'maclar')
    os.makedirs(out, exist_ok=True)
    by_year = defaultdict(lambda: defaultdict(list))
    for r in csv.DictReader(open(src, encoding='utf-8')):
        d = r['Date']
        by_year[d[:4]][d].append([tr(r['home']), tr(r['visitor']), int(r['hgoal']), int(r['vgoal'])])
    for y, days in by_year.items():
        with open(os.path.join(out, f'{y}.json'), 'w', encoding='utf-8') as f:
            json.dump({'kaynak': 'engsoccerdata (J. Curley) — Süper Lig sonuçları', 'gunler': days}, f, ensure_ascii=False, separators=(',', ':'))
    print(len(by_year), 'yıl yazıldı ->', out)

if __name__ == '__main__':
    main(sys.argv[1])
