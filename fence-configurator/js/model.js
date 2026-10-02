/** Decorio graph, validation and assembly model. Units: metres. No commercial pricing. */
export const APP_ID='decorio-fence';
export const SCHEMA_VERSION=1;
const EPS=1e-6;
const clone=x=>structuredClone(x);
export const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
export const round=x=>Math.round(x*1e6)/1e6;
export function productVariant(catalog,productId,variantId,dimensions){
 const product=catalog.products.find(p=>p.id===productId);
 let variant=product?.variants.find(v=>v.id===variantId);
 if(!product||!variant)throw Error('Produs sau variantă necunoscută. Configurația nu a fost modificată.');
 if(variant.dimensionBounds){
  variant={...variant};
  if(dimensions!==undefined&&(!dimensions||typeof dimensions!=='object'))throw Error('Dimensiuni personalizate invalide.');
  for(const axis of ['width','height']){const value=dimensions?.[axis]??variant[axis],bounds=variant.dimensionBounds[axis];
   if(!Number.isFinite(value)||value<Math.max(.1,bounds.min??.1)-EPS||value>bounds.max+EPS)throw Error('Dimensiunile sunt în afara limitelor publicate pentru acest produs.');
   variant[axis]=value;
  }
  variant.label=variant.width+' × '+variant.height+' m · la comandă';
 }else if(dimensions!==undefined)throw Error('Dimensiunile unui produs fix nu pot fi modificate.');
 return {product,variant};
}
export function emptyState(catalog){return {appId:APP_ID,schemaVersion:SCHEMA_VERSION,catalogVersion:catalog.version,nodes:[],segments:[],gates:[],name:'Proiect Decorio',options:{dimensions:true}};}
export function initialState(catalog){
 const state=emptyState(catalog),p=catalog.products.find(p=>p.variants.some(v=>v.post)&&p.generator==='mesh3d');
 if(!p)return state;
 const v=p.variants.find(v=>v.height===1.73&&v.finish==='RAL7016')||p.variants[0];
 state.nodes=[{id:'n1',x:0,y:0},{id:'n2',x:v.width*3,y:0},{id:'n3',x:v.width*3,y:v.width*2}];
 state.segments=[{id:'s1',a:'n1',b:'n2',productId:p.id,variantId:v.id},{id:'s2',a:'n2',b:'n3',productId:p.id,variantId:v.id}];return state;
}
export function assertState(input,catalog){
 if(!input||input.appId!==APP_ID)throw Error('Acest fișier aparține altei aplicații, nu configuratorului Decorio.');
 if(input.schemaVersion!==SCHEMA_VERSION)throw Error('Versiunea configurației nu este compatibilă.');
 if(input.catalogVersion!==catalog.version)throw Error('Versiunea catalogului diferă. Importul necesită o migrare explicită.');
 if(!Array.isArray(input.nodes)||!Array.isArray(input.segments)||!Array.isArray(input.gates))throw Error('Structură de configurație invalidă.');
 if(input.nodes.length>300||input.segments.length>300||input.gates.length>100)throw Error('Limita demo-ului este 300 de puncte, 300 de segmente și 100 de porți.');
 if(typeof input.name!=='string'||input.name.length>120)throw Error('Numele proiectului este invalid.');
 if(!input.options||typeof input.options.dimensions!=='boolean')throw Error('Opțiuni de afișare invalide.');
 const ids=new Set();
 for(const n of input.nodes){
  if(typeof n.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(n.id)||ids.has(n.id)||![n.x,n.y].every(x=>Number.isFinite(x)&&Math.abs(x)<=500))throw Error('Punct invalid sau duplicat. Coordonatele trebuie să fie între -500 și 500 m.');
  ids.add(n.id);
 }
 for(let i=0;i<input.nodes.length;i++)for(let j=i+1;j<input.nodes.length;j++)if(distance(input.nodes[i],input.nodes[j])<EPS)throw Error('Puncte suprapuse: folosește același nod.');
 const segmentIds=new Set();
 for(const s of input.segments){
  if(typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(s.id)||segmentIds.has(s.id)||!ids.has(s.a)||!ids.has(s.b)||s.a===s.b)throw Error('Segment invalid sau duplicat.');
  const {product}=productVariant(catalog,s.productId,s.variantId,s.dimensions);
  if(product.kind==='gate'||product.kind==='accessory')throw Error('Acest produs nu poate fi folosit ca segment.');
  segmentIds.add(s.id);
  if(distance(input.nodes.find(n=>n.id===s.a),input.nodes.find(n=>n.id===s.b))<0.1)throw Error('Lungimea minimă a unui segment este 0,1 m.');
 }
 let modules=0;
 for(const n of input.nodes){
  const connected=input.segments.filter(s=>s.a===n.id||s.b===n.id);
  if(new Set(connected.map(s=>s.productId+'|'+s.variantId+'|'+productVariant(catalog,s.productId,s.variantId,s.dimensions).variant.height)).size>1)throw Error('Îmbinarea variantelor diferite nu are o regulă de montaj validată. Folosește trasee separate.');
 }
 for(const s of input.segments){const {product,variant}=productVariant(catalog,s.productId,s.variantId,s.dimensions);modules+=['chainlink','roll-welded'].includes(product.generator)?1:Math.floor(distance(input.nodes.find(n=>n.id===s.a),input.nodes.find(n=>n.id===s.b))/variant.width);}
 if(modules>1500)throw Error('Limita vizualizării este de 1500 de module. Împarte proiectul în zone.');
 validateIntersections(input);
 const gateIds=new Set();
 for(const g of input.gates){
  const s=input.segments.find(s=>s.id===g.segmentId);
  if(!s||typeof g.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(g.id)||gateIds.has(g.id)||!Number.isFinite(g.offset)||g.offset<0||!['left','right'].includes(g.handing))throw Error('Poartă invalidă.');
  gateIds.add(g.id);
  const {product,variant}=productVariant(catalog,g.productId,g.variantId);
  if(product.kind!=='gate'||!product.compatibleWith?.includes(s.productId))throw Error('Compatibilitatea porții cu acest sistem nu este documentată.');
  if(!Number.isFinite(variant.opening))throw Error('Golul de montaj al porții nu este documentat.');
  const panel=productVariant(catalog,s.productId,s.variantId,s.dimensions).variant;
  if(variant.finish!==panel.finish||Math.abs(variant.height-panel.height)>.100001)throw Error('Poarta și panoul trebuie să aibă finisaj și înălțime compatibile.');
  const length=distance(input.nodes.find(n=>n.id===s.a),input.nodes.find(n=>n.id===s.b));
  if(g.offset+variant.opening>length+EPS)throw Error('Poarta depășește segmentul.');
  if(product.generator==='sliding'&&(!Number.isFinite(variant.runback)||g.offset+variant.opening+variant.runback>length+EPS))throw Error('Spațiul lateral necesar culisării nu este disponibil.');
  for(const other of input.gates){
   if(other===g||other.segmentId!==g.segmentId)continue;
   const ov=productVariant(catalog,other.productId,other.variantId).variant;
   if(g.offset<other.offset+ov.opening-EPS&&other.offset<g.offset+variant.opening-EPS)throw Error('Porțile nu se pot suprapune.');
  }
 }
 validateGateClearance(input,catalog);
 return clone(input);
}
// A single-leaf door sweeps a quarter disc. Reject fence crossings in that area.
function validateGateClearance(state,catalog){
 const nodes=new Map(state.nodes.map(n=>[n.id,n]));
 for(const gate of state.gates){
  const {product,variant}=productVariant(catalog,gate.productId,gate.variantId);
  if(product.generator!=='swing')continue;
  const e=state.segments.find(e=>e.id===gate.segmentId),a=nodes.get(e.a),b=nodes.get(e.b),length=distance(a,b),ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,side=gate.handing==='left'?1:-1;
  const pivot={x:a.x+ux*gate.offset,y:a.y+uy*gate.offset},radius=variant.width;
  const local=n=>({x:(n.x-pivot.x)*ux+(n.y-pivot.y)*uy,y:(-(n.x-pivot.x)*uy+(n.y-pivot.y)*ux)*side});
  for(const obstacle of state.segments){
   if(obstacle.id===e.id)continue;
   const p=local(nodes.get(obstacle.a)),q=local(nodes.get(obstacle.b)),dx=q.x-p.x,dy=q.y-p.y;let lo=0,hi=1;
   for(const [v,d] of [[p.x,dx],[p.y,dy]]){if(Math.abs(d)<EPS){if(v<EPS){hi=-1;break;}}else if(d>0)lo=Math.max(lo,(EPS-v)/d);else hi=Math.min(hi,(EPS-v)/d);}
   if(lo>hi)continue;
   const denom=dx*dx+dy*dy,t=Math.max(lo,Math.min(hi,-(p.x*dx+p.y*dy)/denom));
   if(Math.hypot(p.x+t*dx,p.y+t*dy)<radius-EPS)throw Error('Spațiul de deschidere al porții intersectează un alt segment.');
  }
 }
}
function intersect(a,b,c,d){
 const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,den=ux*vy-uy*vx;
 const cross=(x,y)=>x*uy-y*ux;
 if(Math.abs(den)<EPS){
  if(Math.abs(cross(c.x-a.x,c.y-a.y))>EPS)return null;
  const l2=ux*ux+uy*uy,t0=((c.x-a.x)*ux+(c.y-a.y)*uy)/l2,t1=((d.x-a.x)*ux+(d.y-a.y)*uy)/l2;
  return Math.min(1,Math.max(t0,t1))-Math.max(0,Math.min(t0,t1))>EPS?{overlap:true}:null;
 }
 const t=((c.x-a.x)*vy-(c.y-a.y)*vx)/den,u=((c.x-a.x)*uy-(c.y-a.y)*ux)/den;
 if(t<-EPS||t>1+EPS||u<-EPS||u>1+EPS)return null;
 return {t,u,x:round(a.x+t*ux),y:round(a.y+t*uy)};
}
function validateIntersections(state){
 const nodes=new Map(state.nodes.map(n=>[n.id,n]));
 for(let i=0;i<state.segments.length;i++)for(let j=i+1;j<state.segments.length;j++){
  const a=state.segments[i],b=state.segments[j],hit=intersect(nodes.get(a.a),nodes.get(a.b),nodes.get(b.a),nodes.get(b.b));
  if(hit?.overlap)throw Error('Segmentele nu se pot suprapune.');
  if(hit&&![a.a,a.b].some(id=>id===b.a||id===b.b))throw Error('Intersecția trebuie să fie un nod comun. Folosește instrumentul de desen pentru a o împărți.');
 }
}
function nextId(items,prefix){let i=1;while(items.some(x=>x.id===prefix+i))i++;return prefix+i;}
export function addSegment(input,from,to,selection,catalog){
 const s=clone(input);const {product}=productVariant(catalog,selection.productId,selection.variantId,selection.dimensions);
 if(product.kind!=='panel')throw Error('Alege un sistem de împrejmuire cu dimensiuni documentate.');
 function node(point){let n=s.nodes.find(n=>distance(n,point)<0.025);if(!n){n={id:nextId(s.nodes,'n'),x:round(point.x),y:round(point.y)};s.nodes.push(n);}return n;}
 const a=node(from),b=node(to);if(distance(a,b)<0.1)throw Error('Segmentul trebuie să aibă minimum 0,1 m.');
 const added={id:nextId(s.segments,'s'),a:a.id,b:b.id,...selection};s.segments.push(added);
 // Split all crossings and T junctions, keeping explicit shared nodes. Gates may not be split implicitly.
 const cuts=new Map(s.segments.map(e=>[e.id,[{t:0,id:e.a},{t:1,id:e.b}]]));
 const original=[...s.segments];
 for(let i=0;i<original.length;i++)for(let j=i+1;j<original.length;j++){
  const e=original[i],f=original[j],get=id=>s.nodes.find(n=>n.id===id),hit=intersect(get(e.a),get(e.b),get(f.a),get(f.b));
  if(hit?.overlap)throw Error('Segmentele nu se pot suprapune.');
  if(!hit)continue;
  if((hit.t>EPS&&hit.t<1-EPS&&s.gates.some(g=>g.segmentId===e.id))||(hit.u>EPS&&hit.u<1-EPS&&s.gates.some(g=>g.segmentId===f.id)))throw Error('Mută poarta înainte de a împărți acest segment.');
  const n=node(hit);cuts.get(e.id).push({t:hit.t,id:n.id});cuts.get(f.id).push({t:hit.u,id:n.id});
 }
 const segments=[];
 for(const edge of original){const points=[...new Map(cuts.get(edge.id).map(p=>[p.id,p])).values()].sort((a,b)=>a.t-b.t);
  for(let i=1;i<points.length;i++){const id=i===1?edge.id:nextId([...original,...segments],'s');segments.push({...edge,id,a:points[i-1].id,b:points[i].id});}
 }
 s.segments=segments;return assertState(s,catalog);
}
export function moveNode(state,id,point,catalog){const s=clone(state),n=s.nodes.find(n=>n.id===id);if(!n)throw Error('Punct necunoscut.');Object.assign(n,{x:round(point.x),y:round(point.y)});return assertState(s,catalog);}
export function deleteNode(state,id,catalog){const s=clone(state);s.nodes=s.nodes.filter(n=>n.id!==id);s.segments=s.segments.filter(e=>e.a!==id&&e.b!==id);s.gates=s.gates.filter(g=>s.segments.some(e=>e.id===g.segmentId));return assertState(s,catalog);}
export function deleteSegment(state,id,catalog){const s=clone(state);s.segments=s.segments.filter(e=>e.id!==id);s.gates=s.gates.filter(g=>g.segmentId!==id);s.nodes=s.nodes.filter(n=>s.segments.some(e=>e.a===n.id||e.b===n.id));return assertState(s,catalog);}
export function changeSegment(state,id,selection,catalog){const s=clone(state),e=s.segments.find(e=>e.id===id);if(!e)throw Error('Segment necunoscut.');delete e.dimensions;Object.assign(e,selection);return assertState(s,catalog);}
export function setSegmentLength(state,id,length,catalog){if(!Number.isFinite(length)||length<0.1||length>500)throw Error('Lungime invalidă.');const e=state.segments.find(e=>e.id===id),a=state.nodes.find(n=>n.id===e.a),b=state.nodes.find(n=>n.id===e.b),d=distance(a,b);return moveNode(state,b.id,{x:a.x+(b.x-a.x)*length/d,y:a.y+(b.y-a.y)*length/d},catalog);}
export function deriveAssembly(state,catalog){
 assertState(state,catalog);
 const nodes=new Map(state.nodes.map(n=>[n.id,n]));const parts=[],rows=new Map(),issues=[],posts=new Map();let totalLength=0;
 const issue=(code,message,segmentId='')=>{if(!issues.some(x=>x.code===code&&x.segmentId===segmentId))issues.push({code,message,segmentId});};
 const bom=(key,label,qty,unit,source,notes='',code='')=>{if(qty<=0)return;const row=rows.get(key)||{id:key,code,label,quantity:0,unit,source,notes};row.quantity=round(row.quantity+qty);rows.set(key,row);};
 for(const e of state.segments){
  const a=nodes.get(e.a),b=nodes.get(e.b),length=distance(a,b);totalLength+=length;
  const {product:p,variant:v}=productVariant(catalog,e.productId,e.variantId,e.dimensions);
  const at=t=>({x:a.x+(b.x-a.x)*t/length,y:a.y+(b.y-a.y)*t/length});
  if(p.limitations?.length)issue(p.id,p.limitations.join(' '),e.id);
  const gates=state.gates.filter(g=>g.segmentId===e.id).sort((a,b)=>a.offset-b.offset);const ranges=[];let start=0;
  for(const g of gates){const {product:gp,variant:gv}=productVariant(catalog,g.productId,g.variantId);ranges.push([start,g.offset]);parts.push({kind:'gate',generator:gp.generator,a:at(g.offset),b:at(g.offset+gv.opening),variant:gv,product:gp,segmentId:e.id,handing:g.handing});bom(gp.id+gv.id,gp.name+' · '+gv.label,1,'set',gp.source,'Componentele incluse nu sunt numărate separat.',gv.sku||'');start=g.offset+gv.opening;issue('gate-foundation','Fundația și spațiul de operare al porții necesită validare pentru amplasament.',e.id);}
  ranges.push([start,length]);
  const emitPost=(point,role='intermediar')=>{
   if(!v.post){issue('posts-'+p.id,'Stâlpii, fundațiile și prinderile acestui sistem necesită confirmare.',e.id);return;}
   const key=round(point.x)+','+round(point.y);let post=posts.get(key);
   if(post&&post.productId!==p.id){issue('mixed-'+key,'Îmbinarea între sisteme diferite necesită stâlpi separați și confirmarea montajului.',e.id);return;}
   if(!post){post={kind:'post',point,role,productId:p.id,variant:v,segments:new Set(),product:p};posts.set(key,post);}post.segments.add(e.id);
  };
  for(const [start,end] of ranges){const available=end-start;if(available<EPS)continue;
   if(['chainlink','roll-welded'].includes(p.generator)){
    parts.push({kind:'panel',generator:p.generator,a:at(start),b:at(end),variant:v,product:p,segmentId:e.id});
    bom(p.id+v.id+(v.dimensionBounds?'-'+v.width+'x'+v.height:''),p.name+' · '+v.label,available,'m',p.source,'Lungime netă. Rolele se rotunjesc pe variantă; nu include pierderi și suprapuneri.',v.sku||'');
    issue('roll-mount','Pasul stâlpilor, contravântuirile și cantitățile de sârmă trebuie confirmate.',e.id);
   }else{
    const count=Math.floor((available+EPS)/v.width),rest=round(available-count*v.width);
    for(let i=0;i<count;i++){const left=start+i*v.width;parts.push({kind:'panel',generator:p.generator,a:at(left),b:at(left+v.width),variant:v,product:p,segmentId:e.id});emitPost(at(left));}
    if(count)emitPost(at(start+count*v.width));
    bom(p.id+v.id+(v.dimensionBounds?'-'+v.width+'x'+v.height:''),p.name+' · '+v.label,count,'buc',p.source,v.dimensionBounds?'Dimensiune solicitată la comandă; disponibilitate de confirmat.':'Dimensiune fixă; fără debitare implicită.',v.sku||'');
    if(rest>EPS){issue('remainder','Rest de '+rest.toFixed(3)+' m: ajustează lungimea la '+(length-rest).toFixed(3)+' m sau la '+(length-rest+v.width).toFixed(3)+' m. Debitarea nu este validată.',e.id);parts.push({kind:'gap',a:at(start+count*v.width),b:at(end),segmentId:e.id});}
   }
  }
 }
 for(const [key,post] of posts){
  const degree=post.segments.size;post.role=degree===1?'terminal / intermediar':degree===2?'colț / îmbinare':'ramificație';
  if(degree>2)issue('branch-'+key,'Prinderea la ramificația cu '+degree+' segmente necesită confirmare.');
  parts.push({...post,segments:[...post.segments]});const v=post.variant,p=post.product;
  bom(p.id+'-post-'+v.post.height+'-'+v.finish,v.post.name+' · '+v.post.height+' m · '+v.finish,1,'buc',v.post.source,v.post.notes||'Include capacul conform catalogului; fundația nu este dimensionată.');
  if(v.post.clamps)bom(p.id+'-clamp-'+v.finish,'Set prindere '+v.post.system+' · '+v.finish,v.post.clamps,'set',v.post.source,'Tip terminal/intermediar/colț de confirmat la noduri; număr conform tabelului.');
 }
 for(const row of [...rows.values()]){
  if(row.unit==='m'){const p=catalog.products.find(p=>p.variants.some(v=>p.id+v.id===row.id)),v=p?.variants.find(v=>p.id+v.id===row.id);if(v?.rollLength){row.netLength=row.quantity;row.quantity=Math.ceil(row.quantity/v.rollLength);row.unit='role';row.notes+=' '+v.rollLength+' m/rolă; necesar net '+row.netLength.toFixed(2)+' m.';}}
 }
 if(state.segments.length)issue('mounting','Plan de cantități preliminar: jocurile de montaj, fundațiile și adecvarea la amplasament trebuie confirmate.');
 return {parts,items:[...rows.values()],issues,totalLength:round(totalLength),complete:issues.length===0&&state.segments.length>0};
}
export function csv(assembly,state){
 const escape=s=>'"'+String(s??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const rows=[['Proiect',state.name],['Stare',assembly.complete?'Complet':'Listă preliminară / incompletă'],[],['Cod produs','Denumire și variantă','Cantitate','Unitate','Observații','Sursă'],...assembly.items.map(r=>[r.code,r.label,r.quantity,r.unit,r.notes,r.source.url+(r.source.page?'#page='+r.source.page:'')]),[],['De confirmat'],...assembly.issues.map(i=>[i.segmentId,i.message])];
 return '\uFEFF'+rows.map(row=>row.map(escape).join(';')).join('\r\n');
}

/** Atomically change the selected target, preserving geometry and validating gates. */
export function applyProduct(state,selected,selection,scope,catalog){
 const next=clone(state);
 if(!['all','connected','segment'].includes(scope))throw Error('Țintă de aplicare necunoscută.');
 const edge=next.segments.find(s=>s.id===selected);
 if(scope!=='all'&&!edge)throw Error('Selectează un segment din plan.');
 const ids=new Set(scope==='all'?next.segments.map(s=>s.id):[selected]);
 if(scope==='connected'){
  const nodes=new Set([edge.a,edge.b]);let changed=true;
  while(changed){changed=false;for(const s of next.segments)if(!ids.has(s.id)&&(nodes.has(s.a)||nodes.has(s.b))){ids.add(s.id);nodes.add(s.a);nodes.add(s.b);changed=true;}}
 }
 for(const s of next.segments)if(ids.has(s.id)){delete s.dimensions;Object.assign(s,selection);}
 return assertState(next,catalog);
}
