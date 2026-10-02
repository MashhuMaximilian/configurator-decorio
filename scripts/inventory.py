"""Read public category/product pages. Does not access email-gated catalogs."""
import urllib.request,urllib.parse,concurrent.futures,json,re,time,hashlib
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'catalog/sources'; OUT.mkdir(parents=True,exist_ok=True)
HEAD={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','Accept':'text/html','Referer':'https://decorio.ro/'}
class Page(HTMLParser):
 def __init__(self): super().__init__();self.links=[];self.active=None;self.skip=0;self.text=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t in ['script','style']:self.skip+=1
  if t=='a':self.active={'href':a.get('href',''),'text':''}
 def handle_endtag(self,t):
  if t in ['script','style']: self.skip=max(0,self.skip-1)
  if t=='a' and self.active:self.links.append(self.active);self.active=None
 def handle_data(self,s):
  if not self.skip:
   if self.active:self.active['text']+=s
   if s.strip():self.text.append(s.strip())
def get(path):
 url='https://decorio.ro'+path; fn=OUT/(hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
 try:
  if fn.exists():s=fn.read_text()
  else:
   s=urllib.request.urlopen(urllib.request.Request(url,headers=HEAD),timeout=30).read().decode();fn.write_text(s)
  p=Page();p.feed(s);return path,p,None
 except Exception as e:return path,None,str(e)
pending={'/category'};seen=set();products={};cats=[];fail=[]
while pending:
 batch=sorted(pending-seen);pending=set()
 if not batch:break
 for path,p,error in concurrent.futures.ThreadPoolExecutor(4).map(get,batch):
  seen.add(path)
  if error:fail.append({'url':path,'error':error});continue
  cats.append({'url':'https://decorio.ro'+path,'title':next((x for x in p.text if 'produse' in x.lower()),''),'products':len([l for l in p.links if l['href'].startswith('/product/')])})
  for l in p.links:
   href=l['href']
   if href.startswith('/category/') and '?' not in href and href not in seen:pending.add(href)
   if href.startswith('/product/'):
    record=products.setdefault(href,{'url':'https://decorio.ro'+href,'name':'','categories':[]})
    if l['text'].strip():record['name']=l['text'].strip()
    if path not in record['categories']:record['categories'].append(path)
 print('Categories',len(seen),'products',len(products),'next',len(pending),flush=True)
(OUT/'inventory.json').write_text(json.dumps({'reviewedAt':'2026-10-02','categories':cats,'products':list(products.values()),'failures':fail},ensure_ascii=False,indent=2))
print('Fetching public product evidence',flush=True)
for path,p,error in concurrent.futures.ThreadPoolExecutor(4).map(get,sorted(products)):
 if error:fail.append({'url':path,'error':error});continue
 products[path]['text']='\n'.join(p.text)
(OUT/'inventory.json').write_text(json.dumps({'reviewedAt':'2026-10-02','categories':cats,'products':list(products.values()),'failures':fail},ensure_ascii=False,indent=2))
print('DONE',len(products),'products;',len(fail),'failed pages',flush=True)
