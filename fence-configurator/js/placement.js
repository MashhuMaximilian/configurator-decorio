/** Placement works in product envelopes; installed offsets remain source-dependent. */
import {resolveProduct,hasModelVisual} from './ontology.js';
import {addSegment,deriveAssembly,distance} from './project.js';
export function placementSpec(catalog,product){
 const r=resolveProduct(catalog,product);
 if(r.model.kind!=='panel')throw Error('Acest produs nu formează o latură. Porțile se adaugă din inspectorul unei laturi compatibile.');
 if(!hasModelVisual(r.model))throw Error('Acest model are momentan doar referință foto. Alege un model cu previzualizare 3D pentru a-l plasa.');
 return {width:r.variant.width,continuous:['chainlink','roll-welded'].includes(r.model.legacyGenerator),name:r.model.name};
}
export function fittedLength(requested,spec){
 if(!Number.isFinite(requested)||requested<.1||requested>500)throw Error('Introdu o lungime între 0,1 și 500 m.');
 const count=spec.continuous?null:Math.max(1,Math.round(requested/spec.width));
 return {length:spec.continuous?Math.round(requested*100)/100:count*spec.width,count};
}
export function preventNewGaps(before,after,catalog){
 const previous=deriveAssembly(before,catalog).parts.filter(p=>p.kind==='gap');
 for(const gap of deriveAssembly(after,catalog).parts.filter(p=>p.kind==='gap')){
  if(!previous.some(p=>p.segmentId===gap.segmentId&&distance(p.a,gap.a)<.00001&&distance(p.b,gap.b)<.00001))throw Error('Modificarea ar lăsa un gol între panouri. Folosește multiplii lățimii panoului sau modifică dimensiunile produsului înainte de plasare.');
 }
 return after;
}
export function proposeRun(state,catalog,product,a,target,{exact=false,orthogonal=true}={}){
 const spec=placementSpec(catalog,product),requested=distance(a,target);
 if(requested<.1)throw Error('Depărtează capătul pentru a plasa o latură.');
 let angle=Math.atan2(target.y-a.y,target.x-a.x);
 if(orthogonal&&!exact)angle=Math.round(angle/(Math.PI/2))*(Math.PI/2);
 const fit=fittedLength(requested,spec);
 if(exact&&Math.abs(fit.length-requested)>.00001)throw Error(`Capătul este la ${requested.toFixed(2)} m. Cu acest panou poți ajunge la ${fit.length.toFixed(3)} m. Închiderea ar necesita altă dimensiune de produs.`);
 const b=exact?{x:target.x,y:target.y}:{x:a.x+Math.cos(angle)*fit.length,y:a.y+Math.sin(angle)*fit.length};
 const next=preventNewGaps(state,addSegment(state,a,b,product,catalog),catalog);
 return {a,b,next,joined:exact,...fit,requested,angle:angle*180/Math.PI,spec};
}
export function rectanglePlan(state,catalog,product,width,depth,shape='rectangle'){
 const spec=placementSpec(catalog,product),w=fittedLength(width,spec),d=fittedLength(depth,spec);
 // Existing projects are preserved; a new, separate zone is placed to their right.
 const x=state.nodes.length?Math.max(...state.nodes.map(n=>n.x))+spec.width*2:0,y=0;
 const points=[{x,y},{x:x+w.length,y},{x:x+w.length,y:y+d.length},{x,y:y+d.length},{x,y}];
 let next=state;const sides=shape==='line'?1:shape==='l'?2:shape==='u'?3:4;
 for(let i=0;i<sides;i++)next=proposeRun(next,catalog,product,points[i],points[i+1],{exact:true}).next;
 return {next,width:w.length,depth:d.length,count:spec.continuous?null:(sides===1?w.count:sides===2?w.count+d.count:sides===3?2*w.count+d.count:2*(w.count+d.count))};
}
/** Orthogonal corner resizing propagates along aligned edges, like resizing a room. */
export function proposeMove(state,catalog,id,target,{orthogonal=true}={}){
 const node=state.nodes.find(n=>n.id===id);if(!node)throw Error('Punct necunoscut.');
 const edges=state.segments.filter(e=>e.a===id||e.b===id),nodes=new Map(state.nodes.map(n=>[n.id,n]));
 const aligned=edges.every(e=>{const a=nodes.get(e.a),b=nodes.get(e.b);return Math.abs(a.x-b.x)<1e-5||Math.abs(a.y-b.y)<1e-5;});
 const next=structuredClone(state),point={x:target.x,y:target.y};
 if(orthogonal&&aligned){
  for(const axis of ['x','y']){
   const edge=edges.find(e=>Math.abs(nodes.get(e.a)[axis]-nodes.get(e.b)[axis])>1e-5);
   if(edge){const anchor=nodes.get(edge.a===id?edge.b:edge.a),spec=placementSpec(catalog,edge);const delta=target[axis]-anchor[axis];point[axis]=anchor[axis]+Math.sign(delta||1)*fittedLength(Math.max(.1,Math.abs(delta)),spec).length;}
   const linked=new Set([id]),queue=[id];while(queue.length){const current=queue.shift();for(const e of state.segments.filter(e=>e.a===current||e.b===current)){const other=e.a===current?e.b:e.a;if(!linked.has(other)&&Math.abs(nodes.get(current)[axis]-nodes.get(other)[axis])<1e-5){linked.add(other);queue.push(other);}}}
   for(const n of next.nodes)if(linked.has(n.id))n[axis]=point[axis];
  }
 }else{
  if(edges.length===1){const edge=edges[0],anchor=nodes.get(edge.a===id?edge.b:edge.a),length=fittedLength(distance(anchor,target),placementSpec(catalog,edge)).length,angle=Math.atan2(target.y-anchor.y,target.x-anchor.x);point.x=anchor.x+Math.cos(angle)*length;point.y=anchor.y+Math.sin(angle)*length;}
  Object.assign(next.nodes.find(n=>n.id===id),point);
 }
 return preventNewGaps(state,next,catalog);
}
