import {APP_ID,emptyState,assertState,addSegment,moveNode,deleteNode,deleteSegment,applyProduct,setSegmentLength,deriveAssembly,previewAssembly,csv,distance} from './project.js';
import {modelById,resolveProduct,defaultProduct,configureParameter,availableValues,parameterAlternatives,hasModelVisual} from './ontology.js';
import {DecorioViewer} from './viewer.js';
import {PlanEditor} from './editor.js';
import {SharedUndoManager} from '../../shared-ui/src/history/undoManager.js';
import {mountStandaloneConfiguratorShell} from '../../shared-ui/src/standaloneShell.js';
import {bindPanelAccordions,bindPanelRange} from '../../shared-ui/src/components/panelControls.js';
import {resolveSharedTools} from '../../shared-ui/src/tools/registry.js';
const $=s=>document.querySelector(s),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;},option=(value,label)=>{const o=el('option',label);o.value=value;return o;};
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const allowed=['decorio.360configurator.ro','decorio.360configurator.com','decorio.360konfigurator.de'];
let catalog,state,assembly,product,viewer,editor,shell,selected='',selectedNode='',context='product',viewMode='3d',future=[],cleanupControls=[],catalogLimit=36,cloudReady=false,toastTimer;
const history=new SharedUndoManager({capture:()=>structuredClone(state),restore:snapshot=>{future.push(structuredClone(state));state=assertState(snapshot,catalog);refresh();persist();}});
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=String(text);$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,8000);}
function failure(error){notify(error.message||error);console.warn(error);}
function attempt(fn){return (...args)=>{try{const p=fn(...args);p?.catch?.(failure);}catch(e){failure(e);}};}
function action(id,fn){$(id).addEventListener('click',attempt(fn));}
function persist(){try{if(!shell?.authUser)localStorage.setItem(APP_ID+':v2:guest-draft',JSON.stringify(state));}catch{notify('Exportă JSON pentru a păstra proiectul; stocarea locală nu este disponibilă.');}}
function commit(next){next=assertState(next,catalog);if(JSON.stringify(next)===JSON.stringify(state))return;history.record();future=[];state=next;refresh();persist();shell?.markDirty();}
function refresh(){
 shell?.setProjectName(state.name);
 if(!state.segments.some(e=>e.id===selected))selected=state.segments[0]?.id||'';
 assembly=deriveAssembly(state,catalog);$('#segment-count').textContent=state.segments.length;$('#total-length').textContent=assembly.totalLength.toFixed(2)+' m';$('#redo').disabled=!future.length;
 $('#segment-select').replaceChildren(...state.segments.map(s=>option(s.id,s.id+' · '+modelById(catalog,s.modelId).name)));$('#segment-select').value=selected;
 const edge=state.segments.find(e=>e.id===selected);$('#segment-length').value=edge?distance(state.nodes.find(n=>n.id===edge.a),state.nodes.find(n=>n.id===edge.b)).toFixed(3):'';
 const node=state.nodes.find(n=>n.id===selectedNode);$('#node-controls').hidden=!node;if(node){$('#node-x').value=node.x;$('#node-y').value=node.y;}
 for(const id of ['#set-length','#delete-segment'])$(id).disabled=!edge;
 $('#apply-label').hidden=$('#apply-product').hidden=!state.segments.length;renderGates();editor?.render(state,selected,assembly);renderScene();
}
function renderScene(fit=false){
 $('#view-switch').hidden=context!=='project';$('#layout-controls').hidden=context!=='project';$('#plan-tools').hidden=context!=='project'||viewMode!=='2d';
 document.querySelectorAll('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.context===context)));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===viewMode)));
 const model=modelById(catalog,product.modelId),isPlan=context==='project'&&viewMode==='2d',missing=context==='product'&&(!hasModelVisual(model)||!model.parameters.length);
 $('#editor').hidden=!isPlan;$('#viewer').hidden=isPlan||missing;$('#reference-only').hidden=!missing;
 if(missing){$('#reference-photo').src=model.images[0]||'';$('#reference-photo').hidden=!model.images.length;$('#reference-reason').textContent='Referință foto · '+(model.parameters.length?'Reconstrucția acestui model nu este încă verificată.':'Configurarea acestui model nu este încă implementată; consultă proprietățile publicate în Documentație.');}
 $('#front').hidden=isPlan||missing;
 $('#scene-title').textContent=context==='product'?model.name:state.name;
 $('#scene-note').textContent=context==='product'?(model.visual?.estimated?.join(' ')||'Referință din catalogul Decorio.'):assembly.issues.length?'Amplasare preliminară · verifică montajul și resturile în Componente.':'';
 if(!isPlan&&!missing){viewer?.render(context==='product'?previewAssembly(catalog,product):assembly,context==='product'?{nodes:[],segments:[],options:{dimensions:state.options.dimensions}}:state,{fit,selected:context==='project'?selected:''});}
 if(isPlan)editor?.render(state,selected,assembly);
}
function setContext(value){context=value;if(context==='project'&&!editor.hasFitted){editor.fit(state);editor.hasFitted=true;}renderScene(true);}
function mobilePanel(name){document.body.dataset.mobilePanel=name;document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));if(name==='layout'){context='project';viewMode='2d';renderScene();}}
function renderCatalog(){
 const family=$('#family').value,q=$('#search').value.trim().toLocaleLowerCase('ro');
 const rank=id=>['panouri-bordurate-vega-b','d-dd44fd6ecf24','d-94a19ed2e5ef'].indexOf(id);
 const models=catalog.models.filter(m=>m.inScope&&(!family||m.family===family)&&(!q||m.name.toLocaleLowerCase('ro').includes(q)||m.commercialVariants.some(v=>v.sku.toLowerCase().includes(q)))).sort((a,b)=>(rank(a.id)<0?99:rank(a.id))-(rank(b.id)<0?99:rank(b.id))||(a.kind==='panel'?0:a.kind==='gate'?1:2)-(b.kind==='panel'?0:b.kind==='gate'?1:2)||Number(hasModelVisual(b))-Number(hasModelVisual(a))||Number(Boolean(b.parameters.length))-Number(Boolean(a.parameters.length))||a.name.localeCompare(b.name,'ro'));
 $('#product-count').textContent=models.length+' modele';$('#more-products').hidden=models.length<=catalogLimit;
 $('#products').replaceChildren(...models.slice(0,catalogLimit).map(model=>{const b=el('button',undefined,'product-card');b.setAttribute('aria-pressed',String(model.id===product.modelId));b.setAttribute('aria-label',model.name);b.dataset.model=model.id;if(model.images[0]){const img=el('img');img.src=model.images[0];img.alt='';img.loading='lazy';img.onerror=()=>{img.hidden=true;};b.append(img);}b.append(el('strong',model.name.replace(/^Panou Rezidential /,'')),el('small',model.parameters.length?(hasModelVisual(model)?'Proprietăți și previzualizare':'Proprietăți · referință foto'):'Referință · configurare în curs'));b.onclick=()=>chooseProduct(model.id);return b;}));
 if(!models.length)$('#products').append(el('p','Nu există rezultate pentru această căutare.'));
}
function chooseProduct(id){product=defaultProduct(catalog,id);context='product';$('#editing-context').textContent='PREVIZUALIZARE PRODUS';renderCatalog();renderProperties();renderScene(true);mobilePanel('properties');$('.properties-panel').scrollTop=0;}
function changeProperty(key,value){
 try{product=configureParameter(catalog,product,key,value);$('#parameter-error').hidden=true;context='product';const model=modelById(catalog,product.modelId);if(!(model.custom&&model.parameters.find(p=>p.id===key)?.type==='number'))renderProperties();renderScene(['width','height'].includes(key));}
 catch(error){$('#parameter-error').textContent=error.message;$('#parameter-error').hidden=false;renderProperties(false);
  const alternatives=parameterAlternatives(catalog,product,key,value);
  if(alternatives.length)modal('Această opțiune necesită alte proprietăți',host=>{
   host.append(el('p','Selecția curentă rămâne neschimbată. Alege una dintre combinațiile publicate pentru a aplica modificările împreună.'));
   for(const proposal of alternatives){const b=el('button',proposal.changes.map(c=>c.label+': '+c.from+' → '+c.to+(c.unit?' '+c.unit:'')).join(' · '),'parameter-proposal');b.onclick=()=>{product=proposal.selection;context='product';renderProperties();renderScene(true);$('#dialog').close();};host.append(b);}
  });
 }
}
function renderProperties(clearError=true){
 cleanupControls.forEach(fn=>fn());cleanupControls=[];
 const model=modelById(catalog,product.modelId);$('#product-name').textContent=model.name;$('#parameters').replaceChildren();if(clearError)$('#parameter-error').hidden=true;
 const resolved=model.parameters.length?resolveProduct(catalog,product):null;
 for(const d of model.parameters){
  const value=resolved?.parameters[d.id],wrap=el('div',undefined,'parameter'),label=el('label',d.label+(d.unit?' ('+d.unit+')':''),'control-label');label.htmlFor='param-'+d.id;wrap.append(label);
  if(d.type==='fixed'||d.type==='derived'){wrap.append(el('div',String(value)+(d.unit?' '+d.unit:''),'fixed-value'));}
  else if(d.type==='number'){
   wrap.classList.add('range-control');const row=el('div',undefined,'range-row'),range=el('input'),number=el('input');range.type='range';number.type='number';number.id='param-'+d.id;number.className='number-input';range.setAttribute('aria-label',d.label+' curseur');
   for(const control of [range,number]){control.min=d.min??d.step;control.max=d.max;control.step=d.step;control.value=value;}
   row.append(range,number);wrap.append(row,el('small',(d.min===null?'Minim nepublicat':'Min. '+d.min+' m')+' · max. '+d.max+' m'));
   // Common presentation binder; commit on change only, never clamp an invalid request silently.
   cleanupControls.push(bindPanelRange(wrap,{clamp:false,onInvalid:()=>{ $('#parameter-error').textContent=d.label+': valoare în afara limitelor publicate; modificarea nu a fost aplicată.';$('#parameter-error').hidden=false;},onChange:(v,{immediate})=>{if(immediate&&v!==product.parameters[d.id])changeProperty(d.id,v);}}));
  }else if(d.type==='color'){
   const palette=el('div',undefined,'palette'),valid=availableValues(model,product.parameters,d.id);palette.setAttribute('role','group');palette.setAttribute('aria-label',d.label);
   for(const v of d.values){const b=el('button',undefined,'swatch');b.style.setProperty('--swatch',d.swatches[v]);b.title=v;b.setAttribute('aria-label','Culoare '+v);b.setAttribute('aria-pressed',String(v===value));if(!valid.includes(v)){b.classList.add('requires-change');b.title=v+' · necesită modificarea altor proprietăți';}b.append(el('i'));b.onclick=()=>changeProperty(d.id,v);palette.append(b);}wrap.append(palette,el('small',String(value)));
   if(d.allowRequestedRal){const input=el('input'),apply=el('button','Aplică codul RAL');input.type='text';input.placeholder='RAL 7021';input.setAttribute('aria-label','Cod RAL la comandă');input.value=d.values.includes(value)?'':value;apply.onclick=()=>changeProperty(d.id,input.value.toUpperCase().replaceAll(' ',''));wrap.append(input,apply,el('small','Codul solicitat se păstrează în proiect. Pentru culorile fără mostră digitală se afișează gri neutru; nuanța și textura se confirmă pe mostră.'));}
  }else{
   const select=el('select');select.id='param-'+d.id;const valid=availableValues(model,product.parameters,d.id);
   for(const v of d.values){const o=option(v,String(v)+(d.unit?' '+d.unit:'')+(!valid.includes(v)?' · necesită alte opțiuni':''));select.append(o);}select.value=value;select.onchange=()=>changeProperty(d.id,typeof d.values[0]==='number'?Number(select.value):select.value);wrap.append(select);
  }
  $('#parameters').append(wrap);
 }
 $('#sku').textContent=resolved?(resolved.commercial?.sku?'Cod publicat: '+resolved.commercial.sku:model.custom?'Produs la comandă · dimensiunile solicitate sunt păstrate.':'Cod comercial nepublicat'):'Configurarea nu este disponibilă pentru acest model.';
 $('#draw-product').disabled=!resolved||model.kind!=='panel'||!hasModelVisual(model);$('#apply-product').disabled=$('#draw-product').disabled;
 $('#product-notes').textContent=[...model.limitations,...(model.visual?.estimated||[])].join(' ');$('#product-source').href=(resolved?.source||model.sources[0]).url;$('#product-photo').src=model.images[0]||'';$('#product-photo').hidden=!model.images.length;
 $('#product-specs').replaceChildren(...Object.entries(resolved?.sourceVariant.specifications||model.specifications).flatMap(([k,v])=>[el('dt',k),el('dd',v)]));
 $('#kit-included').replaceChildren(...(resolved?.variant.included||[]).map(x=>el('p','Inclus în kit: '+x.quantity+' × '+x.name)));
}
function selectSegment(id){selected=id;selectedNode='';$('#node-controls').hidden=true;const edge=state.segments.find(s=>s.id===id);if(edge){product={modelId:edge.modelId,parameters:{...edge.parameters}};$('#editing-context').textContent='SEGMENT '+id+' · APLICĂ EXPLICIT MODIFICĂRILE';renderProperties();renderCatalog();}refresh();}
function renderGates(){
 const segment=state.segments.find(s=>s.id===selected),choices=[];
 if(segment){const panel=resolveProduct(catalog,segment);for(const model of catalog.models.filter(m=>m.kind==='gate'&&m.compatibleWith.some(id=>panel.model.sourceProductIds.includes(id))))for(const v of model.commercialVariants)if(v.parameters.color===segment.parameters.color&&Math.abs(v.parameters.height-segment.parameters.height)<=.100001)choices.push({modelId:model.id,parameters:v.parameters,label:model.name+' · '+v.legacy.label});}
 $('#gate-product').replaceChildren(...choices.map((c,i)=>option(i,c.label)));$('#gate-product').choices=choices;$('#add-gate').disabled=!choices.length;
 if(!choices.length)$('#gate-product').append(option('','Montaj compatibil încă neconfirmat'));
 $('#gate-list').replaceChildren(...state.gates.filter(g=>g.segmentId===selected).map(g=>{const b=el('button','Elimină '+modelById(catalog,g.modelId).name);b.onclick=()=>commit({...state,gates:state.gates.filter(x=>x.id!==g.id)});return b;}));
}
function modal(title,content){$('#dialog-title').textContent=title;$('#dialog-content').replaceChildren();content($('#dialog-content'));if(!$('#dialog').open)$('#dialog').showModal();}
function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showBom(){modal('Componente și proiect',host=>{host.append(el('p',state.name+' · '+assembly.totalLength.toFixed(2)+' m'),el('p','Listă preliminară. Montajul și componentele neconfirmate sunt indicate mai jos.'));
 const buttons=el('div',undefined,'export-actions');for(const [label,fn] of [['Export CSV',()=>download('decorio-componente.csv','text/csv;charset=utf-8',csv(assembly,state))],['Export JSON',()=>download('decorio-proiect.json','application/json',JSON.stringify(state,null,2))],['Import JSON',()=>$('#import-json').click()]]){const b=el('button',label);b.onclick=fn;buttons.append(b);}host.append(buttons);
 const table=el('table'),head=el('tr');['Produs / variantă','Cantitate','Observații'].forEach(v=>head.append(el('th',v)));table.append(head);
 for(const item of assembly.items){const row=el('tr');[item.label+(item.code?' · '+item.code:''),item.quantity+' '+item.unit,item.notes].forEach(v=>row.append(el('td',v)));table.append(row);}host.append(table);
 const list=el('ul');assembly.issues.forEach(i=>list.append(el('li',(i.segmentId?i.segmentId+': ':'')+i.message)));host.append(list);
 });}
async function init(){
 if(!local&&!allowed.includes(location.hostname))throw Error('Instanța este rezervată Decorio.');
 catalog=await fetch('./ontology.json').then(r=>{if(!r.ok)throw Error('Catalogul nu poate fi încărcat.');return r.json();});state=emptyState(catalog);product=defaultProduct(catalog,'panouri-bordurate-vega-b');
 try{const draft=localStorage.getItem(APP_ID+':v2:guest-draft');if(draft)state=assertState(JSON.parse(draft),catalog);}catch(error){notify('Proiectul local nu a fost restaurat: '+error.message);}
 viewer=new DecorioViewer($('#viewer'));viewer.onSelect=selectSegment;
 editor=new PlanEditor($('#plan'),{add:(a,b)=>{const next=addSegment(state,a,b,product,catalog);selected=next.segments.at(-1).id;commit(next);},move:(id,p)=>commit(moveNode(state,id,p,catalog)),selectSegment,selectNode:id=>{selectedNode=id;const n=state.nodes.find(n=>n.id===id);$('#node-controls').hidden=false;$('#node-x').value=n.x;$('#node-y').value=n.y;},error:failure,mode:mode=>{for(const id of ['draw','select','pan'])$('#'+id).setAttribute('aria-pressed',String(id===mode));$('#drawing-status').textContent=mode==='draw'?'Apasă pentru puncte · Escape pentru încheiere.':mode==='pan'?'Trage pentru deplasarea planului.':'Selectează un segment sau trage un punct.';},preview:(length,angle)=>{$('#drawing-status').textContent=length.toFixed(2)+' m · '+angle.toFixed(0)+'° · click pentru confirmare';}});
 $('#family').replaceChildren(option('','Toate familiile'),...catalog.families.filter(f=>catalog.models.some(m=>m.family===f.id&&m.inScope)).map(f=>option(f.id,f.name)));
 bindPanelAccordions($('.properties-panel'));renderCatalog();renderProperties();refresh();renderScene(true);
 if(!local){try{const {requireTenantConfiguratorAccess}=await import('../../shared-ui/src/tenantBootstrap.js');const tenant=await requireTenantConfiguratorAccess('fence');cloudReady=tenant?.isTenant===true&&tenant.slug==='decorio'&&tenant.exists===true&&tenant.status==='active';}catch(error){notify(error.message);}}
 $('#connection-status').textContent=local?'Preview local · proiectul poate fi exportat JSON.':cloudReady?'Decorio conectat · autentifică-te pentru salvare.':'Tenant Decorio în așteptare · salvarea în cont este indisponibilă.';
 shell=mountStandaloneConfiguratorShell({productType:'Fence',productId:'fence',defaultProjectName:'Proiect Decorio',brandSrc:catalog.logoUrl||'/shared-ui/assets/360CONFIGURATOR.png',brandAlt:'Decorio',storagePrefix:'decorio:fence:v2',fixedPreferences:{locale:'ro-RO',units:'metric'},capabilities:{cart:false,bookDemo:false,ar:false,language:false,analytics:false,authentication:cloudReady,save:cloudReady,share:cloudReady,undo:true,reset:true},tools:{items:resolveSharedTools(['camera',{id:'dimensions',active:true}]),placement:{side:'left',direction:'down'}},callbacks:{onProjectNameChange:name=>{state={...state,name};persist();renderScene();},captureState:()=>structuredClone(state),restoreState:snapshot=>{state=assertState(snapshot,catalog);history.clear();future=[];context='project';refresh();viewer.fit();editor.fit(state);return true;},resetConfiguration:()=>{commit(emptyState(catalog));editor.setMode('select');return true;},onUndo:()=>history.undo(),onToolAction:({toolId})=>{if(toolId==='camera')viewer.fit();if(toolId==='dimensions'){commit({...state,options:{dimensions:!state.options.dimensions}});}},getShareUrl:async()=>{const {createShareUrl}=await import('../../shared-ui/src/shareState.js');return createShareUrl({productType:'fence',state});},onPreferenceChange:(name,value)=>{if(name==='quality')viewer.surface.setQuality(value);}}});shell.setProjectName(state.name);
}
$('#family').onchange=()=>{catalogLimit=36;renderCatalog();};$('#search').oninput=()=>{catalogLimit=36;renderCatalog();};action('#more-products',()=>{catalogLimit+=36;renderCatalog();});
for(const b of document.querySelectorAll('[data-context]'))b.onclick=()=>setContext(b.dataset.context);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{viewMode=b.dataset.view;renderScene(true);};
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>mobilePanel(b.dataset.panel);
action('#draw-product',()=>{context='project';viewMode='2d';mobilePanel('layout');editor.setMode('draw');});
action('#apply-product',()=>{commit(applyProduct(state,selected,product,$('#apply-scope').value,catalog));setContext('project');notify('Produsul configurat a fost aplicat.');});
action('#draw',()=>editor.setMode('draw'));action('#select',()=>editor.setMode('select'));action('#pan',()=>editor.setMode('pan'));
action('#numeric-segment',()=>editor.addNumeric(Number($('#draw-length').value),Number($('#draw-angle').value)));
action('#zoom-in',()=>editor.zoom(1.2));action('#zoom-out',()=>editor.zoom(1/1.2));
action('#fit',()=>{viewer.fit();editor.fit(state);});action('#front',()=>viewer.front());
$('#segment-select').onchange=()=>selectSegment($('#segment-select').value);
action('#set-length',()=>commit(setSegmentLength(state,selected,Number($('#segment-length').value),catalog)));
action('#delete-segment',()=>commit(deleteSegment(state,selected,catalog)));
action('#move-node',()=>commit(moveNode(state,selectedNode,{x:Number($('#node-x').value),y:Number($('#node-y').value)},catalog)));
action('#delete-node',()=>{commit(deleteNode(state,selectedNode,catalog));$('#node-controls').hidden=true;});
action('#add-gate',()=>{const g=$('#gate-product').choices[Number($('#gate-product').value)];commit({...state,gates:[...state.gates,{id:'g'+crypto.randomUUID().replaceAll('-',''),segmentId:selected,modelId:g.modelId,parameters:g.parameters,offset:Number($('#gate-offset').value),handing:$('#gate-hand').value}]});});
action('#redo',()=>{if(future.length){history.record();state=future.pop();refresh();persist();}});
action('#show-bom',showBom);action('#close-dialog',()=>$('#dialog').close());
$('#import-json').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1250000)throw Error('Fișierul depășește 1,25 MB.');commit(assertState(JSON.parse(await file.text()),catalog));context='project';refresh();viewer.fit();editor.fit(state);$('#dialog').close();notify('Proiectul a fost restaurat.');}catch(error){failure(error);}finally{e.target.value='';}};
action('#coverage',()=>modal('Acoperire pe modele',host=>{host.append(el('p','Fiecare model are propriile proprietăți și dovezi. Prezența în inventar nu înseamnă montaj complet validat.'));const table=el('table');for(const model of catalog.models.filter(m=>m.inScope)){const row=el('tr'),name=el('td'),a=el('a',model.name);a.href=model.sources[0].url;a.target='_blank';a.rel='noopener';name.append(a);row.append(name,el('td',model.parameters.length?'Proprietăți implementate':'Configurare în curs'),el('td',model.visual?.status==='reconstructed'?'Reconstrucție vizuală':model.visual?'Geometrie de sistem':'Referință foto'),el('td',[...model.coverage.missing,...model.limitations].join(' ')));table.append(row);}host.append(table);}));
init().catch(failure);
