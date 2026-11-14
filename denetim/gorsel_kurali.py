import json,os,glob,random,re,collections
from urllib.parse import unquote
ROOT=os.path.expanduser('~/mnt/kadran/public/data')
random.seed(11)
files=random.sample(sorted(glob.glob(f'{ROOT}/*/*.json')),900)
ENTITY={'Vikipedi (Güncel olaylar)','Vikipedi','Vikipedi (dünya — olaylar)'}
EVBODY={'Vikipedi (gün — olaylar)','Vikipedi — Tarihte bugün','Vikipedi (Türkiye yıl makalesi)','Vikipedi (yıl makalesi)'}
WDS={'Wikidata (Türkiye olayı)','Wikidata (dünya olayı)','Wikidata / Vikipedi'}
GENERIC=re.compile(r'(\.svg|flag|bayra|map|harita|locator|location|logo|seal|coat_of_arms|arma|emblem|collage|fallback|amp_default|default\.|icon|banner|\bwiki)',re.I)
YR=re.compile(r'(19[0-9]\d|20[0-2]\d)')
keep=collections.Counter(); ex=collections.defaultdict(list)
for f in files:
    d=json.load(open(f)); iso=os.path.basename(f)[:10]; Y=int(iso[:4])
    for e in d.get('events') or []:
        u=(e.get('image') or {}).get('url') or ''
        if not u or (e.get('image') or {}).get('placeholder'): continue
        s=(e.get('sources') or [{}])[0].get('name','?')
        fn=unquote(u.split('/')[-1])
        fut=any(int(y)>Y for y in YR.findall(fn))
        wm='wikimedia' in u or 'wikipedia' in u
        if GENERIC.search(fn) or fut: k='red_genel_veya_gelecek'
        elif s in ENTITY or s in EVBODY: k='red_madde_gorseli'
        elif s in WDS: k='kabul_wikidata'
        elif not wm: k='kabul_haber_sitesi'
        else: k='red_haber_stok'
        keep[k]+=1
        if len(ex[k])<14: ex[k].append((iso,s[:22],e.get('title','')[:60],fn[:70]))
print(keep)
for k in ['kabul_wikidata','kabul_haber_sitesi','red_haber_stok']:
    print('==',k); [print('  ',x) for x in ex[k]]
