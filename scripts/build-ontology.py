"""Compile model properties from sourced commercial tuples; visuals are authored separately."""
import json,re,hashlib,unicodedata
from pathlib import Path
from html.parser import HTMLParser
R=Path(__file__).resolve().parents[1]
old=json.loads((R/'catalog/catalog.json').read_text()); raw=json.loads((R/'catalog/sources/inventory.json').read_text())
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn')
def slug(s):return re.sub('[^a-z0-9]+','-',norm(s)).strip('-')
class Gallery(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.logo=''
 def handle_starttag(self,t,a):
  a=dict(a);u=a.get('src','')
  if t=='img' and 'logo' in a.get('alt','').lower() and not self.logo:self.logo='https://decorio.ro'+u if u.startswith('/') else u
  if t=='img' and u.startswith('https://cdn.decorio.ro/') and not any(x in u for x in ['256x256','NETOPIA','apple','google']):
   if u not in self.images:self.images.append(u)
photos={};logo=''
for p in raw['products']:
 path=R/'catalog/sources'/(hashlib.sha256(p['url'].encode()).hexdigest()[:16]+'.html')
 if path.exists():
  g=Gallery();g.feed(path.read_text().split('Explorează mai mult')[0]);photos[p['url']]=g.images[:5];logo=logo or g.logo
models={};evidence={}
def ev(src,field):
 id='ev-'+hashlib.sha256((json.dumps(src,sort_keys=True)+field).encode()).hexdigest()[:12];evidence[id]={**src,'field':field};return id
def metric_dimension(text):
 text=str(text).strip().lower().replace(',','.').replace('–','-').replace('—','-')
 match=re.fullmatch(r'(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(mm|m)?',text)
 if not match:return None
 scale=1 if match[3]=='m' else .001
 low=float(match[1])*scale;high=float(match[2] or match[1])*scale
 return {'min':round(low,4),'max':round(high,4)} if 0<low<=high else None
def documented_gate(p):
 if p['kind']!='gate' or p['variants']:return
 spec={norm(k):v for k,v in p['specifications'].items()}
 w=metric_dimension(spec.get('deschidere (lungime)',spec.get('lungime',spec.get('lungime (mm)',''))))
 h=metric_dimension(spec.get('inaltime',spec.get('inaltime (mm)','')))
 if not w or not h:return
 # Conflicting duplicated fields are not silently resolved by ordering the keys.
 for canonical,alternate,bounds in [('inaltime','inaltime (mm)',h),('lungime','lungime (mm)',w)]:
  other=metric_dimension(spec.get(alternate,''))
  if canonical in spec and other and other!=bounds:
   p.setdefault('conflicts',[]).append({'field':canonical,'values':[spec[canonical],spec[alternate]],'reason':'Valori incompatibile în aceeași pagină.'});return
 fixed=w['min']==w['max'] and h['min']==h['max']
 color=spec.get('culoare','')
 if not color:
  named=re.search(r'\b(Antracit|Verde|Alb|Negru)\b',p['name'],re.I)
  if named:color=named[1].capitalize()
 ral=re.search(r'RAL\s*(\d{4})',color,re.I)
 finish='RAL'+ral[1] if ral else color or ('zinc' if 'zinc' in norm(spec.get('finisaj','')) and 'pvc' not in norm(spec.get('finisaj','')) and not spec.get('culori standard') else 'De confirmat')
 p['variants']=[{'id':'documented-envelope','width':w['max'],'height':h['max'],'finish':finish,'color':'#66716c','depth':.06,'label':'Dimensiuni publicate','sku':p.get('sku','') if fixed else '',**({} if fixed else {'dimensionBounds':{'width':w,'height':h}})}]
 p['limitations']=['Golul util, rosturile, stâlpii și spațiul de operare trebuie confirmate; dimensiunile publicate nu sunt convertite automat în gol de montaj.']
 p['envelopeOnly']=True
# Group only explicitly named commercial model series. Mesh/wire construction remains an axis.
def identity(p):
 n=p['name'];lo=norm(n)
 for pat in [r'(Vega B Light)',r'(Vega B)(?! Light)',r'(Strong Barrier S)',r'(Strong Barrier)(?! S)',r'(Eco Barrier)',r'(Panou Dublu-Fir 2D Super)',r'(Panou Dublu-Fir 2D)(?! Super)',r'(Europlast|Voliplast|Volifort|Flexyplast|Flexyfort|Multiplast|Hortaplast|Promoplast|Forteplast|Multifort|Galvafield|Farmerfence Heavy|Farmerfence Light)\b']:
  m=re.search(pat,n,re.I)
  if m:return p['family']+'-'+slug(m[1]),m[1]
 return p['id'],n
for p in old['products']:
 documented_gate(p)
 mid,name=identity(p)
 m=models.setdefault(mid,{'id':mid,'name':name,'family':p['family'],'kind':p['kind'],'inScope':p['inScope'],'sourceProductIds':[],'sources':[],'images':[],'parameters':[],'commercialVariants':[],'limitations':[],'visual':None,'assemblyRules':[]})
 m['sourceProductIds'].append(p['id']);m['sources'].append(p['source']);m['images']+=photos.get(p['source']['url'],[])
 # PDF-backed products keep their original gallery using the inventory URL.
 if not m['images']:
  rp=next((x for x in raw['products'] if x['name']==p['name']),None)
  if rp:m['images']+=photos.get(rp['url'],[])
 for v in p['variants']:
  params={'width':v['width'],'height':v['height'],'finish':v['finish']}
  # Fixed commercial colors are known only for published RAL/name variants.
  params['color']=v['finish'] if v['finish'].startswith('RAL') else ('zinc' if v['finish']=='zinc' else v['finish'])
  match=re.search(r'(\d[/]\d[/]\d)\s*mm',p['name'])
  if match:params['wire']=match[1]
  elif re.search(r'(?:fir|Plasa[^,]*?)\s*(\d+(?:[.,]\d+)?)\s*mm',p['name'],re.I):
   params['wire']=re.search(r'(?:fir|Plasa[^,]*?)\s*(\d+(?:[.,]\d+)?)\s*mm',p['name'],re.I)[1].replace(',','.')
  # Finish is a treatment, not another copy of the color axis.
  if v['finish'].startswith('RAL'):params['finish']='Acoperit colorat'
  elif v['finish']=='zinc':params['finish']='Zincat'
  elif p.get('envelopeOnly') and p['specifications'].get('Finisaj'):params['finish']=p['specifications']['Finisaj']
  for k in ['meshX','meshY']:
   if k in v:params[k]=v[k]
  m['commercialVariants'].append({'id':p['id']+':'+v['id'],'productId':p['id'],'variantId':v['id'],'sku':v.get('sku') or p.get('sku',''),'parameters':params,'bounds':v.get('dimensionBounds'),'specifications':p['specifications'],'source':p['source'],'evidence':[ev(p['source'],'dimensions'),ev(p['source'],'finish')],'legacy':v})
 m['limitations']+=p['limitations']
 if p.get('conflicts'):m.setdefault('conflicts',[]).extend(p['conflicts'])
 # Preserve sourced mounting facts independently of the shape.
 for v in p['variants']:
  if v.get('post'):m['assemblyRules'].append({'id':p['id']+':'+v['id'],'type':'post-table','parameters':{'height':v['height']},'data':v['post'],'evidence':[ev(v['post']['source'],'post-and-fixings')]})
 m.setdefault('specifications',{}).update(p['specifications'])
 if p.get('envelopeOnly'):m['envelopeOnly']=True
labels={'width':'Lățime panou','height':'Înălțime','color':'Culoare','finish':'Finisaj','wire':'Diametru / structură fir','meshX':'Ochi orizontal','meshY':'Ochi vertical'}
colors={'RAL7016':'#383e42','RAL6005':'#234c3b','RAL9005':'#242626','RAL9010':'#ecece8','RAL9016':'#f1f0ea','RAL5010':'#244c7e','RAL7030':'#928e85','RAL8014':'#68422d','zinc':'#a7acb0','Argintiu zincat':'#a7acb0','Antracit':'#383e42','Gri deschis':'#adb0b0','Verde':'#234c3b','Albastru':'#244c7e','Alb':'#ecece8','lemn':'#aa8152'}
visuals=json.loads((R/'catalog/visual-definitions.json').read_text()) if (R/'catalog/visual-definitions.json').exists() else {}
for m in models.values():
 m['images']=list(dict.fromkeys(m['images']))[:5];m['limitations']=list(dict.fromkeys(m['limitations']))
 vs=m['commercialVariants'];spec={norm(k):v for k,v in m['specifications'].items()}
 if m['id'] in ['panouri-bordurate-vega-b','panouri-bordurate-vega-b-light']:
  for variant in vs:variant['parameters']['wire']=5 if m['id']=='panouri-bordurate-vega-b' else 4
 custom=vs and all(v['bounds'] for v in vs)
 if custom:
  # These published colors are independent choices for a made-to-order model, not invented SKUs.
  color_text=spec.get('culori standard','')
  codes=re.findall(r'RAL\s*(\d{4})',color_text,re.I)
  cs=['RAL'+x for x in codes] if codes else [x.strip() for x in color_text.split(',') if x.strip()]
  if codes and 'argintiu' in norm(color_text):cs.append('Argintiu zincat')
  if cs:
   for v in vs:v['parameters']['color']=cs[0]
   m['customColors']=cs
  finish=spec.get('finisaj') or 'Finisaj de confirmat'
  if finish:
   for v in vs:v['parameters']['finish']=finish
 for key in ['width','height','color','finish','wire','meshX','meshY']:
  vals=list(dict.fromkeys(v['parameters'][key] for v in vs if key in v['parameters']))
  if not vals:continue
  values=m.get('customColors',vals) if key=='color' else vals
  pd={'id':key,'label':labels[key],'type':'derived' if key=='finish' and not custom else 'fixed' if len(values)==1 else ('color' if key=='color' else 'enum'),'values':values,'evidence':list(dict.fromkeys(ev(s,key) for s in m['sources']))}
  if key in ['width','height','meshX','meshY']:pd['unit']='m'
  if key=='wire':pd['unit']='mm'
  if key=='wire' and m['id'] in ['panouri-bordurate-vega-b','panouri-bordurate-vega-b-light']:pd['evidence']=[ev({'url':'https://cdn.decorio.ro/catalog-panouri-bordurate.pdf','page':10 if m['id'].endswith('light') else 4,'retrievedAt':'2026-10-02'},'wire-diameter')]
  if key=='color':
   pd['swatches']={v:colors.get(v,'#66716c') for v in values}
   if custom and any('orice culoare' in norm(value) for key,value in spec.items() if 'culo' in key):pd.update(type='color',allowRequestedRal=True)
  if custom and key in ['width','height']:
   b=vs[0]['bounds'][key];pd.update(type='number',min=b['min'],max=b['max'],step=.01)
   if b['min']==b['max']:pd['type']='fixed'
  if m['kind']=='gate' and key=='width':pd['label']='Lățime publicată (gol de montaj de confirmat)'
  m['parameters'].append(pd)
 # Named decorative models have individual visual specifications; unsupported names never use a slat fallback.
 code=re.search(r'(AL\.\d+|10\.[\w+]+|VA\.\d+)',m['name'],re.I)
 if code and code[1]=='10.200':
  code=re.search(r'(10\.200V[12])',m['name'].replace(' ',''),re.I)
 p=next(p for p in old['products'] if p['id']==m['sourceProductIds'][0])
 if m['id'] in visuals:m['visual']=visuals[m['id']]
 elif code and code[1].upper() in visuals and m['kind']=='panel':m['visual']=visuals[code[1].upper()]
 elif code and code[1].upper() in visuals and m['kind']=='gate' and vs:
  m['visual']={'type':'gate-preview','infill':visuals[code[1].upper()],'leaves':2 if m['family']=='porti-batante-auto' else 4 if m['family']=='porti-bi-fold' else 1,'sliding':m['family']=='porti-culisante-in-consola','status':'reconstructed','sources':m['sources'],'estimated':['Desenul aparține modelului; secțiunile cadrului, rosturile și mecanismul sunt estimări vizuale, fără validare de montaj.']}
 elif p['generator'] not in ['slats','bars'] and vs and not m.get('envelopeOnly'):
  m['visual']={'type':p['generator'],'status':'schematic','evidence':[ev(p['source'],'visual-envelope')],'estimated':['Geometrie schematică; detaliile constructive necesită verificare vizuală.']}
 if m['id']=='panouri-bordurate-vega-b' or m['id']=='panouri-bordurate-vega-b-light':
  m['visual']={'type':'mesh3d','status':'reconstructed','evidence':[ev({'url':'https://cdn.decorio.ro/catalog-panouri-bordurate.pdf','page':4,'retrievedAt':'2026-10-02'},'mesh-and-bends')],'estimated':['Adâncimea nervurilor este estimată din referința vizuală.']}
 if m['visual'] and p['generator']=='mobile':
  tube_v=metric_dimension(spec.get('diametru tub vertical',''));tube_h=metric_dimension(spec.get('diametru tub orizontal',''))
  if tube_v and tube_h:m['visual'].update(type='mobile-frame',tubeVertical=tube_v['min'],tubeHorizontal=tube_h['min'],status='reconstructed')
  for key,field in [('wireVertical','grosime fir vertical'),('wireHorizontal','grosime fir orizontal')]:
   size=metric_dimension(spec.get(field,''))
   if size:m['visual'][key]=size['min']*1000
 if m['visual'] and m['id']=='d-969055e77cc9':m['visual'].update(type='transparent-acoustic',status='reconstructed')
 m['coverage']={'parameters':bool(vs),'visual':m['visual']['status'] if m['visual'] else 'unavailable','mounting':'partial' if m['assemblyRules'] else 'unconfirmed','bom':'partial'}
 m['coverage']['missing']=(['Proprietățile și gruparea variantelor nu sunt încă implementate; existența acestei intrări nu dovedește lipsa documentației.'] if not vs else [])+(['Reconstrucție 3D neimplementată / nerevizuită.'] if not m['visual'] or m['visual']['status']=='schematic' else [])+(['Compatibilitățile și montajul complet nu sunt încă validate.'] if not m['assemblyRules'] else ['Pasul montat, rosturile și prinderile la noduri nu sunt încă validate.'])
 m['defaults']={**vs[0]['parameters']} if vs else {}
 if custom:
  for k in ['width','height']:
   pd=next(p for p in m['parameters'] if p['id']==k);m['defaults'][k]=max(pd['min'] or 0,min(pd['max'],2 if k=='width' else 1.5))
 m['legacyGenerator']=p['generator']
 m['compatibleWith']=p.get('compatibleWith',[])
 m['custom']=bool(custom)
 if custom and m['kind']!='gate':m['limitations']=['Dimensiuni la comandă: detaliile de montaj necesită confirmare.'+(' Limite minime nepublicate.' if any(v['bounds'][k]['min'] is None for v in vs for k in ['width','height']) else '')]
 if m['visual'] and m['visual'].get('sources'):m['visual']['evidence']=[ev(s,'visual-design') for s in m['visual']['sources']]
 if m['legacyGenerator'] in ['chainlink','roll-welded']:
  for pd in m['parameters']:
   if pd['id']=='width':pd['label']='Lungime rolă'
 for pd in m['parameters']:
  if all(isinstance(v,(float,int)) for v in pd['values']):pd['values'].sort()
 if m['custom'] and '3 texturi' in spec.get('textura','').lower():m['limitations'].append('Sunt menționate trei texturi, fără identificatori și referințe individuale; selecția lor necesită documentație.')
 m['material']=spec.get('material','Material de confirmat')

result={'schemaVersion':2,'version':'2026-10-02.4','reviewedAt':'2026-10-02','logoUrl':logo,'families':old['families'],'models':list(models.values()),'evidence':evidence}
(R/'catalog/ontology.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(len(models),'models;',sum(bool(m['parameters']) for m in models.values()),'with parameters')
