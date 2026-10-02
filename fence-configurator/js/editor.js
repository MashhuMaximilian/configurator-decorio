import {distance} from './model.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},text='')=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;};
export class PlanEditor{
 constructor(svg,handlers){
  Object.assign(this,{svg,handlers,mode:'select',start:null,selected:'',selectedNode:'',scale:35,origin:{x:130,y:180},state:{nodes:[],segments:[],gates:[]},width:900,height:650});
  this.resizeObserver=new ResizeObserver(()=>{const r=svg.getBoundingClientRect();if(r.width<1||r.height<1)return;this.width=r.width;this.height=r.height;svg.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);this.fit(this.state);});this.resizeObserver.observe(svg);
  svg.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY>0?1/1.15:1.15);},{passive:false});
  svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));svg.addEventListener('pointerup',e=>this.up(e));svg.addEventListener('pointerleave',()=>{if(!this.drag&&!this.pan)this.clearPreview();});svg.addEventListener('pointercancel',()=>{this.drag=null;this.pan=null;this.drawingPress=null;this.clearPreview();});
  svg.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();this.setMode('select');}if(e.key==='Enter'&&this.proposal){e.preventDefault();this.place(this.proposal);}});
 }
 zoom(factor){const next=Math.max(8,Math.min(220,this.scale*factor)),f=next/this.scale,cx=this.width/2,cy=this.height/2;this.origin={x:cx+(this.origin.x-cx)*f,y:cy+(this.origin.y-cy)*f};this.scale=next;this.draw(this.state);}
 addNumeric(length,angle){if(!this.start)throw Error('Alege mai întâi punctul de pornire pe plan sau apasă + la un capăt.');const r=angle*Math.PI/180,target={x:this.start.x+length*Math.cos(r),y:this.start.y+length*Math.sin(r)};this.place(this.handlers.propose(this.start,target,{orthogonal:false}));}
 continueFrom(node){this.setMode('draw');this.start={x:node.x,y:node.y};this.handlers.started?.();this.draw(this.state);}
 setMode(mode){this.mode=mode;this.start=null;this.drawingPress=null;this.clearPreview();this.handlers.mode?.(mode);this.svg.focus({preventScroll:true});this.svg.style.cursor=mode==='draw'?'crosshair':mode==='pan'?'grab':'default';this.draw(this.state);}
 clearPreview(){this.proposal=null;this.handlers.ghost?.(null);this.draw(this.state);}
 world(e){const pt=this.svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(this.svg.getScreenCTM().inverse());let x=(p.x-this.origin.x)/this.scale,y=(p.y-this.origin.y)/this.scale;
  const near=this.state.nodes.find(n=>n.id!==this.drag?.id&&distance(n,{x,y})*this.scale<14);if(near)return {x:near.x,y:near.y,nodeId:near.id};
  if(document.querySelector('#snap')?.checked){x=Math.round(x*10)/10;y=Math.round(y*10)/10;}return {x,y};
 }
 screen(n){return {x:this.origin.x+n.x*this.scale,y:this.origin.y+n.y*this.scale};}
 place(p){this.handlers.add(p);this.start={...p.b};this.proposal=null;this.handlers.ghost?.(null);if(p.joined)this.setMode('select');else this.handlers.started?.();this.draw(this.state);}
 preview(target){
  this.proposal=null;let error;
  try{this.proposal=this.handlers.propose(this.start,target,{exact:!!target.nodeId,orthogonal:document.querySelector('#ortho').checked});}catch(e){error=e.message;}
  this.handlers.ghost?.(this.proposal);this.draw(this.state);const p=this.proposal,a=this.screen(this.start),b=this.screen(p?.b||target),color=p?'#267f68':'#b14c32';
  this.svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':7,opacity:.55,'stroke-dasharray':p?'none':'5 5','pointer-events':'none'}));
  if(p){const count=p.count||1;for(let i=0;i<=count;i++){const t=i/count;this.svg.append(el('circle',{cx:a.x+(b.x-a.x)*t,cy:a.y+(b.y-a.y)*t,r:4,fill:'#fff',stroke:color,'stroke-width':2,'pointer-events':'none'}));}}
  this.svg.append(el('circle',{cx:b.x,cy:b.y,r:10,fill:'none',stroke:color,'stroke-width':2,'pointer-events':'none'}));
  this.handlers.preview?.(p,error);
 }
 down(e){if(e.button!==0&&e.button!==1)return;this.svg.focus({preventScroll:true});e.preventDefault();const node=e.target.dataset.node,segment=e.target.dataset.segment,continuation=e.target.dataset.continue;
  if(this.mode==='pan'||e.button===1){this.pan={x:e.clientX,y:e.clientY,origin:{...this.origin}};this.svg.setPointerCapture(e.pointerId);return;}
  if(continuation){this.handlers.continue?.(continuation);return;}
  if(this.mode==='draw'){const point=this.world(e),first=!this.start;if(first){this.start=point;this.handlers.started?.();this.draw(this.state);}this.drawingPress={first,x:e.clientX,y:e.clientY,moved:false};this.svg.setPointerCapture(e.pointerId);return;}
  if(node){this.selectedNode=node;this.handlers.selectNode(node);this.drag={id:node,point:this.world(e),x:e.clientX,y:e.clientY,moved:false};this.svg.setPointerCapture(e.pointerId);}
  else if(segment){this.selected=segment;this.selectedNode='';this.handlers.selectSegment(segment);this.draw(this.state);}
 }
 move(e){if(this.pan){this.origin={x:this.pan.origin.x+e.clientX-this.pan.x,y:this.pan.origin.y+e.clientY-this.pan.y};this.draw(this.state);return;}
  if(this.drag){if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)<4)return;this.drag.moved=true;try{const next=this.handlers.movePreview(this.drag.id,this.world(e));this.drag.next=next;this.handlers.dragGhost?.(next);this.draw(next);}catch(error){this.drag.next=null;this.handlers.ghost?.(null);this.handlers.preview?.(null,error.message);}return;}
  if(this.mode==='draw'&&this.start){if(this.drawingPress&&Math.hypot(e.clientX-this.drawingPress.x,e.clientY-this.drawingPress.y)>5)this.drawingPress.moved=true;this.preview(this.world(e));}
 }
 up(e){if(this.svg.hasPointerCapture(e.pointerId))this.svg.releasePointerCapture(e.pointerId);if(this.drawingPress){const press=this.drawingPress;this.drawingPress=null;if(press.first&&!press.moved)return;const point=this.world(e);try{this.place(this.handlers.propose(this.start,point,{exact:!!point.nodeId,orthogonal:document.querySelector('#ortho').checked}));}catch(error){this.handlers.error(error);}return;}if(this.pan){this.pan=null;return;}if(!this.drag)return;const d=this.drag;this.drag=null;if(d.next&&d.moved)this.handlers.move(d.next);this.clearPreview();}
 fit(state){if(!state.nodes.length){this.scale=35;this.origin={x:this.width*.24,y:this.height*.5};this.draw(state);return;}const xs=state.nodes.map(n=>n.x),ys=state.nodes.map(n=>n.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const top=this.width<450?200:220,bottom=this.height-(this.width<450?135:235),available=Math.max(80,bottom-top);this.scale=Math.min(60,Math.max(100,this.width-130)/Math.max(5,maxX-minX),available/Math.max(4,maxY-minY));this.origin={x:this.width/2-(minX+maxX)/2*this.scale,y:top+available/2-(minY+maxY)/2*this.scale};this.draw(state);}
 render(state,selected=this.selected,assembly){if(assembly)this.parts=assembly.parts;this.state=state;this.selected=selected;this.draw(state);}
 draw(state){const s=this.svg;s.replaceChildren();const defs=el('defs'),pattern=el('pattern',{id:'grid',width:this.scale,height:this.scale,patternUnits:'userSpaceOnUse',x:this.origin.x%this.scale,y:this.origin.y%this.scale});pattern.append(el('path',{d:`M ${this.scale} 0 L 0 0 0 ${this.scale}`,fill:'none',stroke:'#dae4e4','stroke-width':.7}));defs.append(pattern);s.append(defs,el('rect',{width:this.width,height:this.height,fill:'url(#grid)'}));
  const nodes=new Map(state.nodes.map(n=>[n.id,n]));for(const [i,e] of state.segments.entries()){const a=this.screen(nodes.get(e.a)),b=this.screen(nodes.get(e.b));s.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'hit','data-segment':e.id,'aria-label':'Latura '+(i+1)}));s.append(el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-16,'text-anchor':'middle',fill:'#466146','pointer-events':'none'},(i+1)+' · '+distance(nodes.get(e.a),nodes.get(e.b)).toFixed(2)+' m'));}
  for(const part of this.parts||[]){if(!['panel','gap','gate'].includes(part.kind))continue;const a=this.screen(part.a),b=this.screen(part.b),gap=part.kind==='gap',gate=part.kind==='gate';const selected=this.selected===part.segmentId;s.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:gap?'#bd5034':gate?'#966522':selected?'#bd8131':'#365d50','stroke-width':gap?3:selected?9:7,'stroke-dasharray':gap?'5 5':'none','data-segment':part.segmentId}));if(!gap)for(const p of [a,b])s.append(el('circle',{cx:p.x,cy:p.y,r:3,fill:'white',stroke:gate?'#966522':'#365d50','pointer-events':'none'}));}
  for(const n of state.nodes){const p=this.screen(n),degree=state.segments.filter(e=>e.a===n.id||e.b===n.id).length;s.append(el('circle',{cx:p.x,cy:p.y,r:16,fill:'transparent','data-node':n.id}));s.append(el('circle',{cx:p.x,cy:p.y,r:7,class:'node'+(this.selectedNode===n.id?' selected':''),'data-node':n.id}));if(this.mode==='select'&&degree===1){const g=el('g',{'data-continue':n.id,role:'button',tabindex:0,'aria-label':'Continuă gardul din capătul '+n.id});g.append(el('circle',{cx:p.x+19,cy:p.y-19,r:12,fill:'#244f43','data-continue':n.id}),el('text',{x:p.x+19,y:p.y-15,'text-anchor':'middle',fill:'white',style:'stroke:none;cursor:pointer','data-continue':n.id},'+'));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.handlers.continue?.(n.id);}});s.append(g);}}
  if(this.start){const p=this.screen(this.start);s.append(el('circle',{cx:p.x,cy:p.y,r:12,fill:'none',stroke:'#267f68','stroke-width':3}));}
 }
}
