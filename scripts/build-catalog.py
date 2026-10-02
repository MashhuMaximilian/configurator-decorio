"""Compile only explicit product dimensions. Never cross-product ambiguous option lists."""
import json,re,hashlib,unicodedata
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=json.loads((R/'catalog/sources/inventory.json').read_text());products=[];families={}
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn')
def measure(s):
 m=re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\s*',s or '',re.I)
 return float(m[1].replace(',','.'))*{'mm':.001,'cm':.01,'m':1}[m[2].lower()] if m else None
for raw in D['products']:
 text=raw.get('text','');name=raw['name'];url=raw['url'];own=text.split('Explorează mai mult')[0].split('Produse similare\nDescriere produs')[-1] if False else text.split('Drepturile tale privind')[0]
 cats=sorted({re.sub(r'/pagina/\d+$','',c) for c in raw['categories']},key=lambda s:(len(s.split('/')),len(s)),reverse=True)
 cat=cats[0] if cats else '/category/alte-produse';family=cat.split('/')[-1];label=family.replace('-',' ').capitalize()
 excluded=any(k in cat for k in ['scari-metalice','balustrade-si-protectii','edge-protection','plase-pentru-constructii','echipamente-montare','gabioane-ornamentale','/grilaje'])
 kind='panel' if any(k in cat for k in ['/panouri','/plase/','gard-mobil','gard-opac','garduri-din-gabioane','partitionari-industriale']) else 'accessory'
 if '/porti/' in cat or '/porti-santier' in cat:kind='gate'
 if any(k in cat for k in ['accesorii','siguranta-activa']):kind='accessory'
 fields={}
 if 'Specificații tehnice\n' in own:
  lines=own.rsplit('Specificații tehnice\n',1)[1].split('Documente și fișe tehnice')[0].strip().split('\n')
  fields={lines[i]:lines[i+1] for i in range(0,len(lines)-1,2)}
 sku=''
 m=re.search(r'Mărire\n([^\n]+)\n',own)
 if m:sku=m[1]
 source={'url':url,'retrievedAt':'2026-10-02','section':'Specificații tehnice / denumire produs','sha256':hashlib.sha256(own.encode()).hexdigest()}
 p={'id':'d-'+hashlib.sha256(url.encode()).hexdigest()[:12],'sku':sku,'name':name,'family':family,'kind':kind,'source':source,'specifications':fields,'status':'needs-data','variants':[],'limitations':[],'inScope':not excluded}
 low=norm(name);generator='mesh3d'
 if 'dublu' in low:generator='mesh2d'
 if 'rezidential' in low or 'aluminiu' in low:generator='slats'
 if 'bare' in low:generator='bars'
 if '/plase/' in cat:generator='chainlink'
 if 'gabion' in low:generator='gabion'
 if 'fonoabsorb' in low:generator='acoustic'
 if 'gard-mobil' in cat or 'gard-opac' in cat:generator='mobile'
 if 'partitionari-industriale' in cat:generator='industrial'
 if kind=='gate':generator='sliding' if 'culisant' in low else 'swing'
 if family=='plase-innodate':generator='roll-welded'
 if family=='plase-sudate':generator='roll-welded'
 if family=='gard-opac-santier':generator='solid'
 p['generator']=generator
 fieldsNorm={norm(k):v for k,v in fields.items()}
 width=measure(fieldsNorm.get('lungime',fieldsNorm.get('lungime panou',fieldsNorm.get('latime',fieldsNorm.get('lungime rola','')))));height=measure(fieldsNorm.get('inaltime',fieldsNorm.get('inaltime panou',fieldsNorm.get('inaltime gard',''))))
 if not height:
  m=re.search(r'(\d+[.,]\d+)\s*m\b',low)
  if m:height=float(m[1].replace(',','.'))
 if 'l=2 m' in low:width=2
 m=re.search(r'(\d+[.,]\d+)\s*x\s*(\d+[.,]\d+)\s*m\b',low)
 if m and kind=='panel':height,width=map(lambda s:float(s.replace(',','.')),m.groups())
 finish='RAL7016' if 'antracit' in low else 'RAL6005' if 'verde' in low else 'RAL8014' if 'maro' in low else 'zinc' if 'zn ' in low or 'zinc' in norm(fields.get('Finisaj','')) else 'standard'
 color={'RAL7016':'#343b3d','RAL6005':'#174936','RAL8014':'#68422d','zinc':'#a4a9ac','standard':'#777c7e'}[finish]
 if kind=='panel' and width and height and width<=100 and height<=6 and not excluded:
  v={'id':'default','sku':sku,'width':width,'height':height,'finish':finish,'color':color,'label':f'{width:g} × {height:g} m · {finish}','depth':measure(fields.get('Grosime','')) or .045}
  if generator in ['chainlink','roll-welded']:v['rollLength']=width
  # Mounting data only for exact named VEGA B variants in the official table.
  if 'vega b ' in low and width==2.5:
   heights=[1.03,1.23,1.53,1.73,2.03,2.23,2.43];posts=[1.5,1.7,2,2.4,2.6,2.8,3.2];clamps=[2,2,3,3,4,4,4]
   if height in heights:
    i=heights.index(height);v['post']={'name':'Stâlp OMEGA 60 × 40 mm','system':'OMEGA','height':posts[i],'clamps':clamps[i],'source':{'url':'https://cdn.decorio.ro/catalog-panouri-bordurate.pdf','page':10 if 'light' in low else 4,'retrievedAt':'2026-10-02'}}
  p['variants']=[v];p['status']='partial';p['limitations']=['Dimensiunile produsului sunt documentate; montajul complet și compatibilitatea accesoriilor necesită confirmare.']
 elif kind=='accessory':p['status']='reference';p['limitations']=['Accesoriu inventariat. Cantitatea și compatibilitatea se confirmă pentru sistemul ales.']
 elif excluded:p['status']='out-of-scope';p['limitations']=['Produs inventariat, în afara sistemelor de împrejmuire configurate în acest demo.']
 else:p['limitations']=['Date insuficiente pentru un modul configurabil: dimensiuni, goluri de montaj sau combinații de variante neconfirmate.']
 if 'solutie completa' in low or 'complet cu soclu' in low:
  p['limitations']=['Kit complet: componența cantitativă și regulile de capăt/colț necesită confirmare. Nu se adaugă separat componente presupuse incluse.'];p['variants']=[];p['status']='needs-data'
 # Explicit PDF dimension tuples for Noistop; no Cartesian product of website lists.
 if low.startswith('noistop steel') or low.startswith('noistop wood'):
  wood=low.startswith('noistop wood');pairs=[(1,1),(2,1),(2,.9),(2,.45)] if wood else [(1,1),(2,1),(2,.9),(2,.45),(3,.6),(3,.4)]
  p['variants']=[{'id':f'w{int(w*1000)}h{int(h*1000)}','width':w,'height':h,'depth':.17 if wood else .11,'finish':'lemn' if wood else 'zinc','color':'#ad8b62' if wood else '#9ca48e','label':f'{w:g} × {h:g} m'} for w,h in pairs]
  p['status']='partial';p['source']={'url':'https://cdn.decorio.ro/Catalog_Noistop.pdf','page':11 if wood else 9,'retrievedAt':'2026-10-02'};p['limitations']=['Module simple. Suprapunerea pe înălțime, stâlpii și fixarea necesită un proiect de montaj.']
 # Numeric contradictions between title and product specs remain visible, not validated.
 title_roll=re.search(r'rola\s+(\d+(?:[.,]\d+)?)\s*m\b',low)
 if title_roll and width and generator in ['chainlink','roll-welded'] and abs(float(title_roll[1].replace(',','.'))-width)>.001:
  p['conflicts']=[{'field':'rollLength','title':title_roll[1]+' m','specification':str(width)+' m'}]
  p['variants']=[];p['limitations']=['Conflict între lungimea rolei din titlu și fișa produsului. Este necesară confirmarea Decorio.']
 if kind=='panel' and not p['variants']:p['status']='needs-data'
 products.append(p)
 f=families.setdefault(family,{'id':family,'name':label,'source':{'url':'https://decorio.ro'+cat,'retrievedAt':'2026-10-02'},'status':'inventoried','limitations':['Vezi limitele fiecărui produs.']})
# Record product-page/PDF conflicts rather than silently selecting a measurement.
documents=json.loads((R/'catalog/documents.json').read_text())
for p in products:
 f={norm(k):v for k,v in p['specifications'].items()}
 for v in p['variants']:
  for key,field in [('meshX','dimensiune ochi orizontal'),('meshY','dimensiune ochi vertical')]:
   value=measure(f.get(field,''))
   if value:v[key]=value
  mesh=re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm\s*',f.get('dimensiune ochi',''))
  if mesh:v['meshX'],v['meshY']=[float(x.replace(',','.'))*.001 for x in mesh.groups()]
  specific=f.get('culoare','')
  if specific and ',' not in specific and ' si ' not in norm(specific):
   ral=re.search(r'RAL\s*(\d{4})',specific,re.I)
   if ral:
    v['finish']='RAL'+ral[1];v['color']={'6005':'#174936','7016':'#343b3d','9005':'#242626','9010':'#eeeee5'}.get(ral[1],v['color'])
    v['label']=f"{v['width']:g} × {v['height']:g} m · {v['finish']}"
 attached=[d for d in documents if p['source']['url'] in d['pages']]
 pdf=next((d for d in attached if d['file']=='0c02e0f6-fcd4-47ff-a58a-0c07a6df808a.pdf'),None)
 if pdf and measure(f.get('lungime','')) and measure(f['lungime'])!=2.5:
  p['conflicts']=[{'field':'width','website':f['lungime'],'pdf':'2500 mm','source':{'url':pdf['url'],'page':2,'retrievedAt':'2026-10-02'}}]
  p['variants']=[];p['status']='needs-data';p['limitations']=['Conflict: fișa produsului publică 2510 mm, iar fișa VEGA 2D Super atașată publică 2500 mm. Lățimea de calcul necesită confirmare.']
 if norm(p['name']).startswith('plusar') and f.get('lungime panou')=='2000 m':
  p['conflicts']=[{'field':'width','website':'2000 m','pdf':'2000 mm','source':{'url':'https://cdn.decorio.ro/8d9bcd39-af8c-4711-8c97-019658bf5c59.pdf','page':2,'retrievedAt':'2026-10-02'}}]
  p['limitations']=['Unitate contradictorie: pagina indică 2000 m, desenul catalogului indică 2000 mm. Nu validăm tacit corecția.']

# Continuous dimensions are allowed only when the product page explicitly gives ranges/maxima.
def bounds(value):
 value=norm(value or '').strip()
 m=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)',value)
 if m:
  lo,hi=[measure(m[i]+' '+m[3]) for i in [1,2]]
  return {'min':lo,'max':hi} if 0<lo<=hi<=6 else None
 m=re.fullmatch(r'(?:max|pana la)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)(?: / panou)?',value)
 if m:
  hi=measure(m[1]+' '+m[2]);return {'min':None,'max':hi} if hi and hi<=6 else None
 v=measure(value)
 return {'min':v,'max':v} if v and v<=6 else None
for p in products:
 if p['kind']!='panel' or p['variants'] or not p['inScope']:continue
 f={norm(k):v for k,v in p['specifications'].items()}
 w=bounds(f.get('lungime',f.get('lungime panou','')));h=bounds(f.get('inaltime',''))
 if w and h and ('max' in norm(f.get('lungime','')) or w['min']!=w['max'] or h['min']!=h['max']):
  p['variants']=[{'id':'custom','width':w['max'],'height':h['max'],'depth':measure(f.get('grosime','')) or .045,'finish':'la-comanda','color':'#46504d','label':'Dimensiuni la comandă · finisaj de confirmat','dimensionBounds':{'width':w,'height':h}}]
  p['status']='partial';p['limitations']=['Anvelopă schematică în limitele publicate. Modelul decorativ, dimensiunile minime nepublicate, finisajul și montajul se confirmă cu Decorio. Nu reprezintă un produs standard de stoc.']
 # Explicit lists of heights paired with one fixed width.
 elif w and w['min']==w['max'] and re.fullmatch(r'[0-9., mm]+',f.get('inaltime','')):
  heights=[measure(t.strip()) for t in f['inaltime'].split(',')]
  if heights and all(heights):
   p['variants']=[{'id':f'h{round(h*1000)}','width':w['max'],'height':h,'depth':.04,'finish':'de-confirmat','color':'#75807a','label':f"{w['max']:g} × {h:g} m · finisaj de confirmat"} for h in heights]
   p['status']='partial';p['limitations']=['Dimensiuni publicate. Finisajul și montajul se confirmă. Reprezentare schematică.']

# Noistop Essential has explicit dimensions in the table on PDF page 6.
p=next((p for p in products if norm(p['name']).startswith('noistop essential')),None)
if p:
 p['variants']=[{'id':f'{int(w*1000)}-{int(h*1000)}-{ral}','width':w,'height':h,'depth':.06,'finish':ral,'color':color,'label':f'{w:g} × {h:g} m · {ral}'} for w in [.6,1.2,2.4] for h in [.5,.9,1] for ral,color in [('RAL9005','#222625'),('RAL7016','#383e40')]]
 p.update(status='partial',source={'url':'https://cdn.decorio.ro/Catalog_Noistop.pdf','page':6,'retrievedAt':'2026-10-02'},limitations=['Module individuale. Suprapunerea, placarea cu lemn, stâlpii și fixarea trebuie confirmate.'])
# Machine guarding: only the explicitly stated smallest/largest standard widths.
for model,depth,post in [('ST20',.019,{'name':'Stâlp Troax 60 × 40 mm','system':'Smart Fix'}),('ST30',.03,{'name':'Stâlp Troax 80 × 80 mm','system':'Strong Fix'})]:
 src={'url':'https://cdn.decorio.ro/b6ac1647-9bf9-49a8-9071-7e504016522a.pdf','page':7 if model=='ST20' else 8,'retrievedAt':'2026-10-02'}
 variants=[{'id':f'{int(w*1000)}-{int(h*1000)}','width':w,'height':h,'depth':depth,'groundClearance':.15,'finish':'RAL7037','color':'#85898a','meshX':.02,'meshY':.1,'label':f'{w:g} × {h:g} m · RAL7037','post':dict(post,height=round(h+.15,2),source=src,notes='Fixarea în pardoseală și consolele nu sunt cuantificate.')} for w in [.2,1.5] for h in [1.25,2.05,2.35]]
 products.append({'id':'troax-'+model.lower(),'name':'Troax '+model+' – protecție utilaje','family':'machine-guarding','kind':'panel','generator':'industrial','inScope':True,'status':'partial','source':src,'specifications':{},'variants':variants,'limitations':['Sunt modelate lățimile standard de capăt 200 și 1500 mm menționate explicit. Alte șase lățimi nu sunt enumerate în sursă. Consolele, ancorele și distanțele de siguranță necesită proiect.']})

# Exact modular gabion kit, inventoried as ornamental but usable as a single illustrative module, not a retaining structure.
p=next((p for p in products if p['sku']=='8572786'),None)
if p:
 p.update(inScope=True,kind='panel',generator='gabion',status='partial',limitations=['Umplutura de piatră, fixarea și stabilitatea ansamblului necesită confirmare.'])
 p['variants']=[{'id':'1200-600-120','width':1.2,'height':.6,'depth':.12,'finish':'zinc','color':'#939b9d','label':'1,2 × 0,6 × 0,12 m','sku':'8572786','included':[{'name':'Panou 1200 × 600 mm','quantity':2},{'name':'Panou 600 × 120 mm','quantity':2},{'name':'Panou 1200 × 120 mm','quantity':2},{'name':'Clemă 12,3 mm','quantity':14},{'name':'Capsă 16 × 2 mm','quantity':180}]}]
# Warehouse panel dimensions from PDF page 6, with the explicit 1.1 m height exceptions.
warehouse_source={'url':'https://cdn.decorio.ro/5e51654f-c2c3-4a94-80d6-5cd180c8f7f9.pdf','page':6,'retrievedAt':'2026-10-02'}
for model, widths, heights in [('UR 350',[.2,.3,.5,.7,.8,1,1.2,1.5],[.8,1.1,2.2]),('UX 450',[.2,.3,.5,.7,.8,1,1.2,1.5],[.8,2.2]),('UR 325',[.2,.3,.7,.8,1,1.2,1.5],[.8,1.1,2.2]),('UR 300',[.2,.3,.7,.8,1,1.2,1.5],[1.1,2.2]),('UR SP',[.2,.3,.7,.8,1,1.2],[2.2])]:
 variants=[{'id':f'{int(w*1000)}-{int(h*1000)}','width':w,'height':h,'depth':.019,'finish':'RAL7037','color':'#85898a','label':f'{w:g} × {h:g} m · RAL 7037','meshX':.025 if model=='UR 325' else .05,'meshY':.1 if model=='UR 300' else .05} for w in widths for h in heights if h!=1.1 or w in [.7,1.2,1.5]]
 products.append({'id':'troax-'+model.lower().replace(' ','-'),'name':'Troax '+model,'family':'partitionare-depozite','kind':'panel','generator':'solid' if model=='UR SP' else 'industrial','inScope':True,'status':'partial','source':warehouse_source,'variants':variants,'specifications':{},'limitations':['Stâlpii, fixarea în pardoseală și distanțele de siguranță necesită proiect de montaj.']})
products.append({'id':'troax-single-hinged','name':'Troax – ușă batantă simplă pentru compartimentări','family':'partitionare-depozite','kind':'gate','generator':'swing','inScope':True,'status':'partial','source':dict(warehouse_source,page=7),'compatibleWith':['troax-ur-350','troax-ux-450','troax-ur-325','troax-ur-300','troax-ur-sp'],'specifications':{},'limitations':['Alegerea încuietorii și accesoriilor de siguranță se confirmă.'],'variants':[{'id':str(w),'width':w-.02,'opening':w,'height':2.1,'depth':.03,'finish':'RAL7037','color':'#85898a','label':f'Gol {w:g} m · foaie {w-.02:g} × 2,1 m','leaves':1} for w in [1,1.2]]})
catalog={'version':'2026-10-02.2','reviewedAt':'2026-10-02','families':sorted(families.values(),key=lambda f:f['name']),'products':products,'policy':'Only explicit documented variants; no inferred product compatibility or commercial prices.'}
(R/'catalog/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
# Keep inventory facts, not full marketing-page copies, in version control.
(R/'catalog/inventory.json').write_text(json.dumps({'reviewedAt':D['reviewedAt'],'categoryPages':len(D['categories']),'failures':D['failures'],'products':[{k:v for k,v in p.items() if k!='text'} for p in D['products']]},ensure_ascii=False,indent=2)+'\n')
print(len(products),'inventoried;',sum(bool(p['variants']) for p in products),'with documented geometry;',sum(len(p['variants']) for p in products),'variants')
