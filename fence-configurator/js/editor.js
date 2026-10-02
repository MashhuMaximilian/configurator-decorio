import {distance} from './model.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},text='')=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;};
export class PlanEditor{
 constructor(svg,handlers){this.svg=svg;this.handlers=handlers;this.mode='select';this.start=null;this.selected='';this.selectedNode='';this.scale=35;this.origin={x:130,y:180};this.state={nodes:[],segments:[],gates:[]};
  svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));svg.addEventListener('pointerup',e=>this.up(e));svg.addEventListener('pointercancel',()=>{this.drag=null;this.render(this.state);});svg.addEventListener('keydown',e=>{if(e.key==='Escape'){this.start=null;this.mode='select';this.render(this.state);}});
 }
 setMode(mode){this.mode=mode;this.start=null;this.svg.style.cursor=mode==='draw'?'crosshair':'default';this.render(this.state);}
 world(e){const pt=this.svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(this.svg.getScreenCTM().inverse());let x=(p.x-this.origin.x)/this.scale,y=(p.y-this.origin.y)/this.scale;
  if(document.querySelector('#snap').checked){x=Math.round(x*10)/10;y=Math.round(y*10)/10;}
  const near=this.state.nodes.find(n=>distance(n,{x,y})*this.scale<12);if(near&&near.id!==this.drag?.id)return {x:near.x,y:near.y};
  if(this.start&&document.querySelector('#ortho').checked){if(Math.abs(x-this.start.x)>Math.abs(y-this.start.y))y=this.start.y;else x=this.start.x;}
  return {x,y};
 }
 screen(n){return {x:this.origin.x+n.x*this.scale,y:this.origin.y+n.y*this.scale};}
 down(e){if(e.button!==0)return;const node=e.target.dataset.node,segment=e.target.dataset.segment;
  if(this.mode==='draw'){const point=this.world(e);if(!this.start){this.start=point;this.render(this.state);}else{const first=this.start;try{this.handlers.add(first,point);this.start=point;}catch(err){this.handlers.error(err);}this.render(this.state);}return;}
  if(node){this.selectedNode=node;this.handlers.selectNode(node);this.drag={id:node,point:this.world(e),moved:false};this.svg.setPointerCapture(e.pointerId);}
  else if(segment){this.selected=segment;this.selectedNode='';this.handlers.selectSegment(segment);this.render(this.state);}
 }
 move(e){if(this.drag){this.drag.point=this.world(e);this.drag.moved=true;const temp=structuredClone(this.state);Object.assign(temp.nodes.find(n=>n.id===this.drag.id),this.drag.point);this.draw(temp);}else if(this.mode==='draw'&&this.start){this.draw(this.state);const a=this.screen(this.start),b=this.screen(this.world(e));this.svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#b58d3a','stroke-width':2,'stroke-dasharray':'6 5'}));}}
 up(e){if(!this.drag)return;const d=this.drag;this.drag=null;if(this.svg.hasPointerCapture(e.pointerId))this.svg.releasePointerCapture(e.pointerId);if(d.moved)try{this.handlers.move(d.id,d.point);}catch(err){this.handlers.error(err);}this.render(this.state);}
 fit(state){if(!state.nodes.length){this.scale=35;this.origin={x:130,y:180};return;}const xs=state.nodes.map(n=>n.x),ys=state.nodes.map(n=>n.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.scale=Math.min(65,650/Math.max(5,maxX-minX),340/Math.max(4,maxY-minY));this.origin={x:450-(minX+maxX)/2*this.scale,y:340-(minY+maxY)/2*this.scale};this.render(state);}
 render(state,selected=this.selected,assembly){if(assembly)this.gateParts=assembly.parts.filter(p=>p.kind==='gate');this.state=state;this.selected=selected;this.draw(state);}
 draw(state){const s=this.svg;s.replaceChildren();const defs=el('defs'),pattern=el('pattern',{id:'grid',width:this.scale,height:this.scale,patternUnits:'userSpaceOnUse',x:this.origin.x%this.scale,y:this.origin.y%this.scale});pattern.append(el('path',{d:`M ${this.scale} 0 L 0 0 0 ${this.scale}`,fill:'none',stroke:'#d8dfd1','stroke-width':.7}));defs.append(pattern);s.append(defs,el('rect',{width:900,height:650,fill:'url(#grid)'}));
  const nodes=new Map(state.nodes.map(n=>[n.id,n]));for(const e of state.segments){const a=this.screen(nodes.get(e.a)),b=this.screen(nodes.get(e.b));s.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'hit','data-segment':e.id}),el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge'+(this.selected===e.id?' selected':''),'data-segment':e.id}));s.append(el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-12,'text-anchor':'middle',fill:'#466146'},e.id+' · '+distance(nodes.get(e.a),nodes.get(e.b)).toFixed(2)+' m'));}
  for(const gate of this.gateParts||[]){
   const a=this.screen(gate.a),b=this.screen(gate.b),angle=Math.atan2(b.y-a.y,b.x-a.x),r=gate.variant.width*this.scale,sign=gate.handing==='left'?1:-1,end={x:a.x-Math.sin(angle)*r*sign,y:a.y+Math.cos(angle)*r*sign};
   s.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#fafbf6','stroke-width':9}),el('line',{x1:a.x,y1:a.y,x2:end.x,y2:end.y,stroke:'#ad8131','stroke-width':3}),el('path',{d:`M ${a.x+Math.cos(angle)*r} ${a.y+Math.sin(angle)*r} A ${r} ${r} 0 0 ${sign===1?1:0} ${end.x} ${end.y}`,fill:'none',stroke:'#ad8131','stroke-dasharray':'4 3'}));
  }
  for(const n of state.nodes){const p=this.screen(n);s.append(el('circle',{cx:p.x,cy:p.y,r:7,class:'node'+(this.selectedNode===n.id?' selected':''),'data-node':n.id}));s.append(el('text',{x:p.x+12,y:p.y+18,fill:'#76836d'},n.id));}
  if(this.start){const p=this.screen(this.start);s.append(el('circle',{cx:p.x,cy:p.y,r:10,fill:'none',stroke:'#ba913b','stroke-width':2}));}
 }
}
