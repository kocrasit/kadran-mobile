#!/usr/bin/env python3
"""
Türkiye A Milli Futbol Takımı'nın bütün maçlarını (1923–bugün) gün gün tek dosyaya çevirir.
Kaynak: martj42/international_results (Mart Jürisoo), results.csv — https://github.com/martj42/international_results (CC0)
Çıktı: veri-ek/milli.json → { "kaynak": …, "gunler": { "1954-03-14": [[ev, deplasman, ev_gol, dep_gol, turnuva, şehir]] } }
Kullanım: python scripts/milli_olustur.py <results.csv yolu>
"""
import csv, json, os, sys

ULKE = {
 'Turkey':'Türkiye','Albania':'Arnavutluk','Algeria':'Cezayir','Andorra':'Andorra','Angola':'Angola','Armenia':'Ermenistan','Australia':'Avustralya',
 'Austria':'Avusturya','Azerbaijan':'Azerbaycan','Belarus':'Belarus','Belgium':'Belçika','Bosnia and Herzegovina':'Bosna-Hersek','Brazil':'Brezilya',
 'Bulgaria':'Bulgaristan','Cameroon':'Kamerun','Canada':'Kanada','Chile':'Şili','China':'Çin','Colombia':'Kolombiya','Costa Rica':'Kosta Rika',
 'Croatia':'Hırvatistan','Czech Republic':'Çekya','Czechoslovakia':'Çekoslovakya','Denmark':'Danimarka','Ecuador':'Ekvador','Egypt':'Mısır',
 'England':'İngiltere','Estonia':'Estonya','Ethiopia':'Etiyopya','Faroe Islands':'Faroe Adaları','Finland':'Finlandiya','France':'Fransa',
 'Georgia':'Gürcistan','German DR':'Doğu Almanya','Germany':'Almanya','Ghana':'Gana','Gibraltar':'Cebelitarık','Greece':'Yunanistan','Guinea':'Gine',
 'Honduras':'Honduras','Hungary':'Macaristan','Iceland':'İzlanda','Iran':'İran','Iraq':'Irak','Israel':'İsrail','Italy':'İtalya',
 'Ivory Coast':'Fildişi Sahili','Japan':'Japonya','Kazakhstan':'Kazakistan','Kosovo':'Kosova','Latvia':'Letonya','Libya':'Libya',
 'Liechtenstein':'Lihtenştayn','Lithuania':'Litvanya','Luxembourg':'Lüksemburg','Malta':'Malta','Mexico':'Meksika','Moldova':'Moldova',
 'Montenegro':'Karadağ','Netherlands':'Hollanda','New Zealand':'Yeni Zelanda','North Macedonia':'Kuzey Makedonya','Northern Cyprus':'KKTC',
 'Northern Ireland':'Kuzey İrlanda','Norway':'Norveç','Pakistan':'Pakistan','Paraguay':'Paraguay','Poland':'Polonya','Portugal':'Portekiz',
 'Qatar':'Katar','Republic of Ireland':'İrlanda','Romania':'Romanya','Russia':'Rusya','San Marino':'San Marino','Saudi Arabia':'Suudi Arabistan',
 'Scotland':'İskoçya','Senegal':'Senegal','Serbia':'Sırbistan','Slovakia':'Slovakya','Slovenia':'Slovenya','South Africa':'Güney Afrika',
 'South Korea':'Güney Kore','Spain':'İspanya','Sweden':'İsveç','Switzerland':'İsviçre','Syria':'Suriye','Tunisia':'Tunus','Ukraine':'Ukrayna',
 'United States':'ABD','Uruguay':'Uruguay','Uzbekistan':'Özbekistan','Venezuela':'Venezuela','Wales':'Galler','Yugoslavia':'Yugoslavya',
}
TURNUVA = {
 'Friendly':'Hazırlık maçı','FIFA World Cup qualification':'Dünya Kupası elemeleri','UEFA Euro qualification':'Avrupa Şampiyonası elemeleri',
 'UEFA Nations League':'UEFA Uluslar Ligi','UEFA Euro':'Avrupa Şampiyonası','FIFA World Cup':'Dünya Kupası','Balkan Cup':'Balkan Kupası',
 'Mediterranean Cup':'Akdeniz Kupası','Confederations Cup':'Konfederasyonlar Kupası','Olympic Games':'Olimpiyat Oyunları','Kirin Cup':'Kirin Kupası',
}
SEHIR = {'Istanbul':'İstanbul','Diyarbakir':'Diyarbakır','Athens':'Atina','Vienna':'Viyana','Rome':'Roma','Moscow':'Moskova','Bucharest':'Bükreş',
 'Sofia':'Sofya','Belgrade':'Belgrad','Tehran':'Tahran','Cairo':'Kahire','Berlin':'Berlin','Prague':'Prag','Warsaw':'Varşova','Brussels':'Brüksel',
 'Copenhagen':'Kopenhag','London':'Londra','Lisbon':'Lizbon','Seville':'Sevilla','Cologne':'Köln','Munich':'Münih','Piraeus':'Pire','Kyiv':'Kiev',
 'Baghdad':'Bağdat','Algiers':'Cezayir','Seoul':'Seul','Geneva':'Cenevre','Naples':'Napoli','Florence':'Floransa','Kyrenia':'Girne','Zürich':'Zürih'}

def main(src):
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'veri-ek', 'milli.json')
    gunler = {}
    eksik = set()
    for r in csv.DictReader(open(src, encoding='utf-8')):
        if 'Turkey' not in (r['home_team'], r['away_team']) or r['home_score'] in ('', 'NA'):
            continue
        for k in (r['home_team'], r['away_team']):
            if k not in ULKE: eksik.add(k)
        ad = lambda k: ('Batı Almanya' if k == 'Germany' and r['date'] < '1990-10-03' else
                        'Sovyetler Birliği' if k == 'Russia' and r['date'] < '1992-01-01' else ULKE.get(k, k))
        gunler.setdefault(r['date'], []).append([ad(r['home_team']), ad(r['away_team']),
            int(r['home_score']), int(r['away_score']), ('RCD Kupası' if '1967-11-25' <= r['date'] <= '1967-11-28' and r['tournament'] == 'Friendly' else TURNUVA.get(r['tournament'], r['tournament'])), SEHIR.get(r['city'], r['city'])])
    json.dump({'kaynak': 'martj42/international_results (CC0) — Türkiye A Milli Takımı maçları', 'gunler': gunler},
              open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(gunler), 'maç günü yazıldı ->', out, '| çevrilmeyen:', sorted(eksik) or 'yok')

if __name__ == '__main__':
    main(sys.argv[1])
