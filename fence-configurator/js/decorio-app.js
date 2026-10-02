import {placementSpec,fittedLength,proposeRun,rectanglePlan,preventNewGaps,proposeMove} from './placement.js';
import {APP_ID,emptyState,assertState,moveNode,deleteNode,deleteSegment,applyProduct,deriveAssembly,previewAssembly,csv,distance} from './project.js';
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
let catalog,state,assembly,product,viewer,editor,shell,selected='',selectedNode='',context='project',viewMode='2d',future=[],cleanupControls=[],catalogLimit=36,cloudReady=false,toastTimer;
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
 $('#segment-select').replaceChildren(...state.segments.map(s=>option(s.id,'Latura '+(state.segments.indexOf(s)+1)+' · '+modelById(catalog,s.modelId).name)));$('#segment-select').value=selected;
 const edge=state.segments.find(e=>e.id===selected);if(edge&&context==='project'&&editor?.mode!=='draw'){product={modelId:edge.modelId,parameters:{...edge.parameters}};renderProperties();renderCatalog();}$('#segment-length').value=edge?distance(state.nodes.find(n=>n.id===edge.a),state.nodes.find(n=>n.id===edge.b)).toFixed(3):'';
 const node=state.nodes.find(n=>n.id===selectedNode);if(!node)selectedNode='';$('#node-controls').hidden=!node;if(node){$('#node-x').value=node.x;$('#node-y').value=node.y;}
 for(const id of ['#set-length','#delete-segment'])$(id).disabled=!edge;$('#undo-build').disabled=history.stack.length===0;
 $('#apply-label').hidden=$('#apply-product').hidden=!state.segments.length;syncBuilder();renderGates();editor?.render(state,selected,assembly);renderScene();
}
function renderScene(fit=false){
 const building=context==='project',isPlan=building&&viewMode==='2d';
 document.body.dataset.context=context;document.body.dataset.editorMode=editor?.mode||'select';
 $('#view-switch').hidden=!building;$('#layout-controls').hidden=!building;$('#plan-tools').hidden=!isPlan;
 document.querySelectorAll('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.context===context)));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===viewMode)));
 const model=modelById(catalog,product.modelId),missing=!building&&(!hasModelVisual(model)||!model.parameters.length);
 $('#editor').hidden=!isPlan;$('#viewer').hidden=missing;$('#viewer').classList.toggle('mini-view',isPlan);$('#mini-label').hidden=!isPlan;$('#reference-only').hidden=!missing;
 $('#start-project').hidden=!isPlan||state.segments.length>0||editor?.mode==='draw';
 $('#build-feedback').hidden=!isPlan;$('#project-gaps').hidden=!isPlan||!assembly.parts.some(p=>p.kind==='gap');
 const gaps=assembly.parts.filter(p=>p.kind==='gap');$('#project-gaps span').textContent=gaps.length+' laturi au goluri în proiectul existent. Pozițiile tale au fost păstrate.';
 if(missing){$('#reference-photo').src=model.images[0]||'';$('#reference-photo').hidden=!model.images.length;$('#reference-reason').textContent='Referință foto · '+(model.parameters.length?'Reconstrucția acestui model nu este încă verificată.':'Configurarea acestui model nu este încă implementată.');}
 $('#front').hidden=isPlan||missing;
 $('#scene-title').textContent=building?'':model.name;
 $('#scene-note').textContent=building?'Amplasare în lățimi de produs. Stâlpii, rosturile și montajul se confirmă separat.':(model.visual?.estimated?.join(' ')||'Referință din catalogul Decorio.');
 if(!missing)viewer?.render(building?assembly:previewAssembly(catalog,product),building?state:{nodes:[],segments:[],options:{dimensions:state.options.dimensions}},{fit:fit||isPlan,selected:building?selected:''});
 if(isPlan)editor?.render(state,selected,assembly);
 syncBuilder();
}
function buildMessage(title,detail){$('#build-step').textContent=title;$('#build-detail').textContent=detail;$('#drawing-status').textContent=detail;}
function syncBuilder(){
 if(!catalog||!editor)return;
 const drawing=editor.mode==='draw',edge=state.segments.find(s=>s.id===selected);
 document.body.dataset.editorMode=editor.mode;
 $('#build-controls').hidden=!drawing;$('#selection-controls').hidden=drawing||!edge;
 $('#layout-title').textContent=drawing?'Latura următoare':edge?'Latura '+(state.segments.indexOf(edge)+1):'Proiectul tău';
 $('#continue-selected').disabled=!edge;$('#edit-piece').hidden=!edge;
 if(edge){const count=assembly.parts.filter(p=>p.kind==='panel'&&p.segmentId===edge.id).length;$('#selection-summary').textContent=modelById(catalog,edge.modelId).name+' · '+count+' piese';}
 $('#active-piece').textContent=modelById(catalog,product.modelId).name+' · '+product.parameters.width+' × '+product.parameters.height+' m · '+(product.parameters.color||'');
 if(drawing)buildMessage(editor.start?'2 · Alege direcția și lungimea':'1 · Alege punctul de pornire',editor.start?'Verde = se poate plasa. Click sau Enter confirmă. Esc încheie.':'Apasă pe plan sau pe un capăt existent. Panourile se așază întregi.');
 else buildMessage('Construiește și ajustează','＋ la un capăt continuă gardul. Click pe o latură o selectează. Trage un punct pentru mutare.');
 updateLengthPreview();updateResizePreview();
}
function updateLengthPreview(){try{const spec=placementSpec(catalog,product),fit=fittedLength(Number($('#draw-length').value),spec);$('#length-preview').textContent=fit.length.toFixed(3)+' m'+(fit.count?' · '+fit.count+' panouri × '+spec.width+' m':' · plasă la lungimea solicitată');$('#numeric-segment').disabled=!editor?.start;}catch(e){$('#length-preview').textContent=e.message;$('#numeric-segment').disabled=true;}}
function startBuild(node){
 placementSpec(catalog,product);context='project';viewMode='2d';mobilePanel('layout');editor.setMode('draw');if(node)editor.continueFrom(node);renderScene(true);syncBuilder();$('.properties-panel').scrollTop=0;
}
function continueNode(id){const node=state.nodes.find(n=>n.id===id),edge=state.segments.find(s=>s.a===id||s.b===id);if(!node||!edge)return;product={modelId:edge.modelId,parameters:{...edge.parameters}};renderProperties();renderCatalog();startBuild(node);}
let ghostKey='',ghostFrame;
function showGhost(proposal){
 cancelAnimationFrame(ghostFrame);
 if(!proposal){ghostKey='';if(context==='project'&&assembly){viewer.render(assembly,state,{selected});editor?.render(state,selected,assembly);}return;}
 const key=JSON.stringify(proposal.next.nodes)+JSON.stringify(proposal.next.segments);if(key===ghostKey)return;ghostKey=key;
 ghostFrame=requestAnimationFrame(()=>{const nextAssembly=deriveAssembly(proposal.next,catalog),ghostIds=proposal.next.segments.filter(e=>!state.segments.some(old=>JSON.stringify(old)===JSON.stringify(e))).map(e=>e.id);viewer.render(nextAssembly,proposal.next,{selected,ghostIds,fit:state.segments.length===0});});
}
function showShape(){
 try{placementSpec(catalog,product);}catch(e){failure(e);return;}
 modal('Începe de la o formă',host=>{
  host.append(el('p',modelById(catalog,product.modelId).name+' · forma se adaugă ca zonă separată, fără să înlocuiască proiectul.'));
  const controls=el('div',undefined,'shape-fields'),shape=el('select'),w=el('input'),d=el('input'),summary=el('p'),button=el('button','Adaugă forma în proiect','primary');
  shape.setAttribute('aria-label','Forma împrejmuirii');shape.append(option('rectangle','Dreptunghi închis'),option('u','Trei laturi · U'),option('l','Două laturi · L'),option('line','O latură dreaptă'));
  for(const [input,name,value] of [[w,'Lungime dorită (m)',10],[d,'Adâncime dorită (m)',5]]){input.type='number';input.min=.1;input.max=500;input.step=.01;input.value=value;const label=el('label',name);label.append(input);controls.append(label);}
  const diagram=document.createElementNS('http://www.w3.org/2000/svg','svg');diagram.setAttribute('viewBox','0 0 300 140');diagram.classList.add('shape-preview');diagram.setAttribute('aria-label','Previzualizarea formei');
  let proposal;const update=()=>{try{proposal=rectanglePlan(state,catalog,product,Number(w.value),Number(d.value),shape.value);summary.textContent='Se vor plasa '+proposal.width.toFixed(3)+' m'+(shape.value!=='line'?' × '+proposal.depth.toFixed(3)+' m':'')+(proposal.count?' · '+proposal.count+' panouri':'')+'. Fără debitare sau întinderea panourilor.';diagram.innerHTML='<path d="'+({rectangle:'M40 30 H260 V110 H40 Z',u:'M40 30 H260 V110 H40',l:'M40 30 H260 V110',line:'M40 70 H260'}[shape.value])+'" fill="none" stroke="#244f43" stroke-width="6"/>';button.disabled=false;}catch(e){proposal=null;summary.textContent=e.message;button.disabled=true;}};
  shape.onchange=w.oninput=d.oninput=update;button.onclick=()=>{if(!proposal)return;context='project';viewMode='2d';selected=proposal.next.segments.at(-1).id;commit(proposal.next);editor.setMode('select');editor.fit(state);renderScene(true);mobilePanel('layout');$('#dialog').close();notify('Forma a fost adăugată. Selectează o latură sau apasă + la un capăt.');};
  host.append(shape,controls,diagram,summary,button);update();
 });
}
function setContext(value){context=value;$('.properties-panel').scrollTop=0;if(context==='project'&&!editor.hasFitted){editor.fit(state);editor.hasFitted=true;}renderScene(true);}
function mobilePanel(name){document.body.dataset.mobilePanel=name;document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));if(name==='layout'){context='project';viewMode='2d';renderScene();}}
function renderCatalog(){
 const family=$('#family').value,q=$('#search').value.trim().toLocaleLowerCase('ro');
 const rank=id=>['panouri-bordurate-vega-b','d-dd44fd6ecf24','d-94a19ed2e5ef'].indexOf(id);
 const models=catalog.models.filter(m=>m.inScope&&(!family||m.family===family)&&(!q||m.name.toLocaleLowerCase('ro').includes(q)||m.commercialVariants.some(v=>v.sku.toLowerCase().includes(q)))).sort((a,b)=>(rank(a.id)<0?99:rank(a.id))-(rank(b.id)<0?99:rank(b.id))||(a.kind==='panel'?0:a.kind==='gate'?1:2)-(b.kind==='panel'?0:b.kind==='gate'?1:2)||Number(hasModelVisual(b))-Number(hasModelVisual(a))||Number(Boolean(b.parameters.length))-Number(Boolean(a.parameters.length))||a.name.localeCompare(b.name,'ro'));
 $('#product-count').textContent=models.length+' modele';$('#more-products').hidden=models.length<=catalogLimit;
 $('#products').replaceChildren(...models.slice(0,catalogLimit).map(model=>{const b=el('button',undefined,'product-card');b.setAttribute('aria-pressed',String(model.id===product.modelId));b.setAttribute('aria-label',model.name);b.dataset.model=model.id;if(model.images[0]){const img=el('img');img.src=model.images[0];img.alt='';img.loading='lazy';img.onerror=()=>{img.hidden=true;};b.append(img);}b.append(el('strong',model.name.replace(/^Panou Rezidential /,'')),el('small',model.parameters.length?(hasModelVisual(model)?'Proprietăți și previzualizare':'Proprietăți · referință foto'):'Referință · configurare în curs'));b.onclick=()=>chooseProduct(model.id);return b;}));
 if(!models.length)$('#products').append(el('p','Nu există rezultate pentru această căutare.'));
}
function chooseProduct(id){editor.setMode('select');product=defaultProduct(catalog,id);context='product';$('#editing-context').textContent='PIESA ALEASĂ · CONFIGUREAZĂ, APOI PLASEAZĂ';renderCatalog();renderProperties();renderScene(true);mobilePanel('properties');$('.properties-panel').scrollTop=0;}
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
 $('#draw-product').disabled=!resolved||model.kind!=='panel'||!hasModelVisual(model);$('#place-top').disabled=$('#apply-product').disabled=$('#draw-product').disabled;$('#placement-limit').textContent=!resolved?'Dimensiunile acestui produs nu sunt încă configurabile.':model.kind!=='panel'?'Porțile se plasează din inspectorul unei laturi compatibile; accesoriile se verifică în lista de componente.':!hasModelVisual(model)?'Plasarea nu este încă disponibilă: lipsește reconstrucția verificată a acestui model.':'Panouri întregi de '+resolved.variant.width+' m. Pe plan alegi câte panouri așezi și direcția lor.';
 $('#product-notes').textContent=[...model.limitations,...(model.visual?.estimated||[])].join(' ');$('#product-source').href=(resolved?.source||model.sources[0]).url;$('#product-photo').src=model.images[0]||'';$('#product-photo').hidden=!model.images.length;
 $('#product-specs').replaceChildren(...Object.entries(resolved?.sourceVariant.specifications||model.specifications).flatMap(([k,v])=>[el('dt',k),el('dd',v)]));
 $('#kit-included').replaceChildren(...(resolved?.variant.included||[]).map(x=>el('p','Inclus în kit: '+x.quantity+' × '+x.name)));
}
function selectSegment(id){$('.properties-panel').scrollTop=0;editor?.setMode('select');context='project';selected=id;selectedNode='';$('#node-controls').hidden=true;const edge=state.segments.find(s=>s.id===id);if(edge){product={modelId:edge.modelId,parameters:{...edge.parameters}};$('#editing-context').textContent='PIESA LATURII '+(state.segments.indexOf(edge)+1)+' · MODIFICĂ ȘI APLICĂ';renderProperties();renderCatalog();}refresh();}
function renderGates(){
 const segment=state.segments.find(s=>s.id===selected),choices=[];
 if(segment){const panel=resolveProduct(catalog,segment);for(const model of catalog.models.filter(m=>m.kind==='gate'&&m.compatibleWith.some(id=>panel.model.sourceProductIds.includes(id))))for(const v of model.commercialVariants)if(v.parameters.color===segment.parameters.color&&Math.abs(v.parameters.height-segment.parameters.height)<=.100001)choices.push({modelId:model.id,parameters:v.parameters,label:model.name+' · '+v.legacy.label});}
 $('#gate-form').hidden=!choices.length;$('#gate-unavailable').hidden=!!choices.length;$('#gate-product').replaceChildren(...choices.map((c,i)=>option(i,c.label)));$('#gate-product').choices=choices;$('#add-gate').disabled=!choices.length;
 if(!choices.length)$('#gate-product').append(option('','Montaj compatibil încă neconfirmat'));
 $('#gate-list').replaceChildren(...state.gates.filter(g=>g.segmentId===selected).map(g=>{const b=el('button','Elimină '+modelById(catalog,g.modelId).name);b.onclick=()=>commit({...state,gates:state.gates.filter(x=>x.id!==g.id)});return b;}));
}
function modal(title,content){$('#dialog-title').textContent=title;$('#dialog-content').replaceChildren();content($('#dialog-content'));if(!$('#dialog').open)$('#dialog').showModal();}
function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showBom(){modal('Componente și proiect',host=>{host.append(el('p',state.name+' · '+assembly.totalLength.toFixed(2)+' m'),el('p','Listă preliminară. Montajul și componentele neconfirmate sunt indicate mai jos.'));
 const buttons=el('div',undefined,'export-actions');for(const [label,fn] of [['Export CSV',()=>download('decorio-componente.csv','text/csv;charset=utf-8',csv(assembly,state))],['Export JSON',()=>download('decorio-proiect.json','application/json',JSON.stringify(state,null,2))],['Import JSON',()=>$('#import-json').click()]]){const b=el('button',label);b.onclick=fn;buttons.append(b);}host.append(buttons);
 const table=el('table'),head=el('tr');['Produs / variantă','Cantitate','Observații'].forEach(v=>head.append(el('th',v)));table.append(head);
 for(const item of assembly.items){const row=el('tr');[item.label+(item.code?' · '+item.code:''),item.quantity+' '+item.unit,item.notes].forEach(v=>row.append(el('td',v)));table.append(row);}host.append(table);
 const grouped=new Map();for(const issue of assembly.issues){const sides=grouped.get(issue.message)||new Set();if(issue.segmentId)sides.add(state.segments.findIndex(s=>s.id===issue.segmentId)+1);grouped.set(issue.message,sides);}const list=el('ul');for(const [message,sides] of grouped)list.append(el('li',(sides.size?'Laturile '+[...sides].join(', ')+': ':'')+message));host.append(list);
 });}
async function init(){
 if(!local&&!allowed.includes(location.hostname))throw Error('Instanța este rezervată Decorio.');
 catalog=await fetch('./ontology.json').then(r=>{if(!r.ok)throw Error('Catalogul nu poate fi încărcat.');return r.json();});state=emptyState(catalog);product=defaultProduct(catalog,'panouri-bordurate-vega-b');
 try{const draft=localStorage.getItem(APP_ID+':v2:guest-draft');if(draft)state=assertState(JSON.parse(draft),catalog);}catch(error){notify('Proiectul local nu a fost restaurat: '+error.message);}
 if(state.segments.length)product={modelId:state.segments[0].modelId,parameters:{...state.segments[0].parameters}};
 viewer=new DecorioViewer($('#viewer'));viewer.onSelect=selectSegment;
 editor=new PlanEditor($('#plan'),{
  propose:(a,b,options)=>proposeRun(state,catalog,product,a,b,options),
  add:p=>{selected=p.next.segments.at(-1).id;commit(p.next);},
  movePreview:(id,p)=>proposeMove(state,catalog,id,p,{orthogonal:$('#ortho').checked}),move:next=>commit(next),selectSegment,
  selectNode:id=>{selectedNode=id;const n=state.nodes.find(n=>n.id===id);$('#node-controls').hidden=false;$('#node-x').value=n.x;$('#node-y').value=n.y;},
  continue:continueNode,error:failure,started:syncBuilder,
  mode:mode=>{for(const id of ['draw','select','pan'])$('#'+id).setAttribute('aria-pressed',String(id===mode));if(editor){syncBuilder();$('#start-project').hidden=state.segments.length>0||mode==='draw';}},
  preview:(p,error)=>buildMessage(p?(p.count?p.count+' panouri · ':'')+p.length.toFixed(3)+' m · '+p.angle.toFixed(0)+'°':'Nu se poate plasa aici',p?'Click pentru plasare · Esc încheie latura':error),
  ghost:showGhost,dragGhost:next=>{const a=deriveAssembly(next,catalog);editor.parts=a.parts;viewer.render(a,next,{selected});}
 });
 $('#family').replaceChildren(option('','Toate familiile'),...catalog.families.filter(f=>catalog.models.some(m=>m.family===f.id&&m.inScope)).map(f=>option(f.id,f.name)));
 bindPanelAccordions($('.properties-panel'));renderCatalog();renderProperties();refresh();renderScene(true);
 if(!local){try{const {requireTenantConfiguratorAccess}=await import('../../shared-ui/src/tenantBootstrap.js');const tenant=await requireTenantConfiguratorAccess('fence');cloudReady=tenant?.isTenant===true&&tenant.slug==='decorio'&&tenant.exists===true&&tenant.status==='active';}catch(error){notify(error.message);}}
 $('#connection-status').textContent=local?'Preview local · proiectul poate fi exportat JSON.':cloudReady?'Decorio conectat · autentifică-te pentru salvare.':'Tenant Decorio în așteptare · salvarea în cont este indisponibilă.';
 shell=mountStandaloneConfiguratorShell({productType:'Fence',productId:'fence',defaultProjectName:'Proiect Decorio',brandSrc:catalog.logoUrl||'/shared-ui/assets/360CONFIGURATOR.png',brandAlt:'Decorio',storagePrefix:'decorio:fence:v2',fixedPreferences:{locale:'ro-RO',units:'metric'},capabilities:{cart:false,bookDemo:false,ar:false,language:false,analytics:false,authentication:cloudReady,save:cloudReady,share:cloudReady,undo:true,reset:true},tools:{items:resolveSharedTools(['camera',{id:'dimensions',active:true}]),placement:{side:'left',direction:'down'}},callbacks:{onProjectNameChange:name=>{state={...state,name};persist();renderScene();},captureState:()=>structuredClone(state),restoreState:snapshot=>{state=assertState(snapshot,catalog);history.clear();future=[];context='project';refresh();viewer.fit();editor.fit(state);return true;},resetConfiguration:()=>{commit(emptyState(catalog));editor.setMode('select');return true;},onUndo:()=>{editor.setMode('select');return history.undo();},onToolAction:({toolId})=>{if(toolId==='camera')viewer.fit();if(toolId==='dimensions'){commit({...state,options:{dimensions:!state.options.dimensions}});}},getShareUrl:async()=>{const {createShareUrl}=await import('../../shared-ui/src/shareState.js');return createShareUrl({productType:'fence',state});},onPreferenceChange:(name,value)=>{if(name==='quality')viewer.surface.setQuality(value);}}});shell.setProjectName(state.name);
}
$('#family').onchange=()=>{catalogLimit=36;renderCatalog();};$('#search').oninput=()=>{catalogLimit=36;renderCatalog();};action('#more-products',()=>{catalogLimit+=36;renderCatalog();});
for(const b of document.querySelectorAll('[data-context]'))b.onclick=()=>setContext(b.dataset.context);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{viewMode=b.dataset.view;renderScene(true);};
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>mobilePanel(b.dataset.panel);
action('#edit-piece',()=>{const edge=state.segments.find(e=>e.id===selected);if(edge){product={modelId:edge.modelId,parameters:{...edge.parameters}};renderProperties();renderCatalog();}setContext('product');mobilePanel('properties');$('.properties-panel').scrollTop=0;});action('#active-piece',()=>{editor.setMode('select');setContext('product');renderProperties();mobilePanel('properties');$('.properties-panel').scrollTop=0;});action('#place-top',()=>startBuild());action('#draw-product',()=>startBuild());action('#start-free',()=>startBuild());action('#start-shape',showShape);action('#quick-shape',showShape);action('#undo-build',()=>{editor.setMode('select');history.undo();});action('#continue-selected',()=>{const edge=state.segments.find(s=>s.id===selected);if(edge)continueNode([edge.a,edge.b].includes(selectedNode)?selectedNode:edge.b);});action('#review-gaps',()=>selectSegment(assembly.parts.find(p=>p.kind==='gap').segmentId));$('#draw-length').oninput=updateLengthPreview;
action('#apply-product',()=>{commit(preventNewGaps(state,applyProduct(state,selected,product,$('#apply-scope').value,catalog),catalog));setContext('project');notify('Produsul configurat a fost aplicat.');});
action('#draw',()=>startBuild());action('#select',()=>editor.setMode('select'));action('#pan',()=>editor.setMode('pan'));
action('#numeric-segment',()=>editor.addNumeric(Number($('#draw-length').value),Number($('#draw-angle').value)));
action('#zoom-in',()=>editor.zoom(1.2));action('#zoom-out',()=>editor.zoom(1/1.2));
action('#fit',()=>{viewer.fit();editor.fit(state);});action('#front',()=>viewer.front());
$('#segment-select').onchange=()=>selectSegment($('#segment-select').value);
function updateResizePreview(){try{const edge=state.segments.find(e=>e.id===selected);if(!edge)return;const fit=fittedLength(Number($('#segment-length').value),placementSpec(catalog,edge));$('#set-length').textContent='Aplică '+fit.length.toFixed(3)+' m';}catch{$('#set-length').textContent='Aplică lungimea';}}
$('#segment-length').oninput=updateResizePreview;
action('#set-length',()=>{const edge=state.segments.find(e=>e.id===selected),a=state.nodes.find(n=>n.id===edge.a),b=state.nodes.find(n=>n.id===edge.b),length=fittedLength(Number($('#segment-length').value),placementSpec(catalog,edge)).length,ratio=length/distance(a,b);commit(proposeMove(state,catalog,b.id,{x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio},{orthogonal:$('#ortho').checked}));});
action('#delete-segment',()=>commit(deleteSegment(state,selected,catalog)));
action('#move-node',()=>commit(preventNewGaps(state,moveNode(state,selectedNode,{x:Number($('#node-x').value),y:Number($('#node-y').value)},catalog),catalog)));
action('#delete-node',()=>{commit(deleteNode(state,selectedNode,catalog));$('#node-controls').hidden=true;});
action('#add-gate',()=>{const g=$('#gate-product').choices[Number($('#gate-product').value)];commit({...state,gates:[...state.gates,{id:'g'+crypto.randomUUID().replaceAll('-',''),segmentId:selected,modelId:g.modelId,parameters:g.parameters,offset:Number($('#gate-offset').value),handing:$('#gate-hand').value}]});});
action('#redo',()=>{if(future.length){history.record();state=future.pop();refresh();persist();}});
action('#show-bom',showBom);action('#close-dialog',()=>$('#dialog').close());
$('#import-json').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1250000)throw Error('Fișierul depășește 1,25 MB.');commit(assertState(JSON.parse(await file.text()),catalog));context='project';refresh();viewer.fit();editor.fit(state);$('#dialog').close();notify('Proiectul a fost restaurat.');}catch(error){failure(error);}finally{e.target.value='';}};
action('#coverage',()=>modal('Acoperire pe modele',host=>{host.append(el('p','Fiecare model are propriile proprietăți și dovezi. Prezența în inventar nu înseamnă montaj complet validat.'));const table=el('table');for(const model of catalog.models.filter(m=>m.inScope)){const row=el('tr'),name=el('td'),a=el('a',model.name);a.href=model.sources[0].url;a.target='_blank';a.rel='noopener';name.append(a);row.append(name,el('td',model.parameters.length?'Proprietăți implementate':'Configurare în curs'),el('td',model.visual?.status==='reconstructed'?'Reconstrucție vizuală':model.visual?'Geometrie de sistem':'Referință foto'),el('td',[...model.coverage.missing,...model.limitations].join(' ')));table.append(row);}host.append(table);}));
init().catch(failure);
