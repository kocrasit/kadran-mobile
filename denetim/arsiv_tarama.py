import json, os, re, sys, glob, collections
from datetime import date
ROOT=os.path.expanduser('~/mnt/kadran/public/data')
dec=sys.argv[1]
AY={'Oca':1,'Şub':2,'Mar':3,'Nis':4,'May':5,'Haz':6,'Tem':7,'Ağu':8,'Eyl':9,'Eki':10,'Kas':11,'Ara':12}
YR=re.compile(r'\b(19[0-9]\d|20[0-2]\d)\b')
DT=re.compile(r'(\d{1,2}) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara) (\d{4})')
def tarih(s):
    m=DT.findall(s or '')
    return [date(int(y),AY[a],int(g)) for g,a,y in m if 1<=int(g)<=31]
out=collections.defaultdict(list); cnt=collections.Counter()
econ={}; champs={}; imgs=collections.defaultdict(set); songs=collections.defaultdict(set); weather=[]
for f in sorted(glob.glob(f'{ROOT}/{dec}/*.json')):
    iso=os.path.basename(f)[:10]; Y=int(iso[:4]); D=date.fromisoformat(iso)
    try: d=json.load(open(f))
    except Exception as e: out['bozuk_dosya'].append((iso,str(e)[:80])); continue
    cnt['gun']+=1
    for e in d.get('events') or []:
        cnt['olay']+=1
        t=e.get('title',''); b=e.get('body') or ''
        ty=[int(x) for x in YR.findall(t)]
        if ty and Y not in ty and all(abs(y-Y)>0 for y in ty): out['olay_baslik_baska_yil'].append((iso,e.get('scope'),t[:110]))
        fut=[int(x) for x in YR.findall(t+' '+b) if int(x)>Y]
        if fut: out['olay_gelecek_yil'].append((iso,e.get('scope'),t[:80],b[:140],fut[:3]))
        im=(e.get('image') or {})
        if im.get('url') and not im.get('placeholder'):
            cnt['olay_gorselli']+=1; imgs[im['url']].add((iso,t[:60]))
    for s in d.get('music') or []:
        songs[(s.get('title',''),s.get('artist',''))].add(Y)
    for tv in d.get('tv') or []:
        n=tv.get('note') or ''
        ts=tarih(n)
        if len(ts)>=2 and not (ts[0]<=D<=ts[1]): out['dizi_yayin_disi'].append((iso,tv.get('program'),n[:90]))
        elif len(ts)==1 and 'yayınlandı' in n and ts[0]>D: out['dizi_yayin_disi'].append((iso,tv.get('program'),n[:90]))
    for c in d.get('cinema') or []:
        ts=tarih(c.get('note'))
        if ts and ts[0]>D: out['film_vizyondan_once'].append((iso,c.get('title'),c.get('note','')[:70]))
        elif ts and (D-ts[0]).days>400: out['film_cok_eski'].append((iso,c.get('title'),c.get('note','')[:70]))
    for c in d.get('cultureMisc') or []:
        ts=tarih(c.get('note'))
        if ts and ts[0]>D: out['esya_cikmadan_once'].append((iso,c.get('title'),(c.get('note') or '')[:70]))
    for p in d.get('notableDeaths') or []:
        if p.get('bornYear') and p['bornYear']>Y: out['vefat_dogumdan_once'].append((iso,p.get('name'),p.get('bornYear')))
    for p in d.get('notableBirths') or []:
        if p.get('bornYear') and p['bornYear']>Y: cnt['dogan_gelecekte']+=1
    e=d.get('economy') or {}
    econ[iso]={k:(e.get(k) or {}).get('value') for k in ('usdTry','eurTry','goldGram')}
    for w in d.get('weather') or []:
        a,b=w.get('tempMin'),w.get('tempMax')
        if a is not None and b is not None and (a>b or a<-35 or b>47): out['hava_tuhaf'].append((iso,w.get('city'),a,b))
    tod=d.get('turkeyOfDay') or {}
    if tod and tod.get('year') and tod['year']!=Y: out['tod_yil_farkli'].append((iso,tod['year']))
    for p in tod.get('photos') or []: imgs['TOD:'+p.get('url','')].add((iso,(p.get('alt') or '')[:60]))
    h=(d.get('headline') or {}).get('value','')
    if 'o güne dair kayıtlar' in h: cnt['bos_manset']+=1
    for s in d.get('sports') or []:
        m=re.search(r'Sezon şampiyonu:\s*(.+)$', s.get('detail') or '')
        if m: champs.setdefault(s.get('title'),set()).add(m.group(1).strip())
    nf=(d.get('newspaperFront') or {}).get('provider'); cnt['gazete_'+str(nf)]+=1
res={'say':cnt,'bulgu':{k:v[:4000] for k,v in out.items()},'bulgu_say':{k:len(v) for k,v in out.items()},
 'econ':econ,'champs':{k:sorted(v) for k,v in champs.items()},
 'imgs':{k:sorted(v)[:12] for k,v in imgs.items() if len(v)>1},'img_say':len(imgs),
 'songs':{f'{a}|{b}':sorted(v) for (a,b),v in songs.items()}}
json.dump(res,open(os.path.expanduser(f'~/den/a1_{dec}.json'),'w'),ensure_ascii=False,default=list)
print(dec,dict(cnt),{k:len(v) for k,v in out.items()})
