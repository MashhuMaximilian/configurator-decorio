import json,re,hashlib,html,urllib.request,subprocess,concurrent.futures
from pathlib import Path
R=Path(__file__).resolve().parents[1];S=R/'catalog/sources';D=json.loads((S/'inventory.json').read_text());docs={}
for p in D['products']:
 if not any(any(k in c for k in ['/panouri/','/partitionari-industriale','/organizare-santier/gard','/porti/porti-batante','/gabioane-si-grilaje/garduri']) for c in p['categories']):continue
 f=S/(hashlib.sha256(p['url'].encode()).hexdigest()[:16]+'.html')
 for u in re.findall(r'href="(https://cdn.decorio.ro/[^\"]+\.pdf)"',f.read_text()):docs.setdefault(html.unescape(u),[]).append(p['url'])
def get(item):
 u,pages=item;file=S/u.rsplit('/',1)[-1]
 try:
  if not file.exists():file.write_bytes(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0','Referer':'https://decorio.ro/'}),timeout=45).read())
  subprocess.run(['pdftotext','-layout',str(file),str(file.with_suffix('.txt'))],capture_output=True)
  return {'url':u,'pages':pages,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'retrievedAt':'2026-10-02','file':file.name}
 except Exception as e:return {'url':u,'error':str(e),'pages':pages}
result=list(concurrent.futures.ThreadPoolExecutor(4).map(get,docs.items()));(R/'catalog/documents.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(len(result),'public documents',sum('error' in d for d in result),'errors')
