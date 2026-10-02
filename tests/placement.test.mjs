import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placementSpec,fittedLength,proposeRun,rectanglePlan,preventNewGaps} from '../fence-configurator/js/placement.js';
import {defaultProduct,hasModelVisual} from '../fence-configurator/js/ontology.js';
import {emptyState,deriveAssembly,addSegment,moveNode,distance} from '../fence-configurator/js/project.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/ontology.json',import.meta.url)));
const vega=defaultProduct(catalog,'panouri-bordurate-vega-b');
test('mouse target snaps to whole panels before committing; original project remains unchanged',()=>{
 const state=emptyState(catalog),p=proposeRun(state,catalog,vega,{x:0,y:0},{x:6.99,y:.2});
 assert.equal(p.length,7.5);assert.equal(p.count,3);assert.equal(p.b.y,0);assert.equal(state.nodes.length,0);
 const a=deriveAssembly(p.next,catalog);assert.equal(a.parts.filter(p=>p.kind==='panel').length,3);assert.equal(a.parts.filter(p=>p.kind==='gap').length,0);
 assert.equal(a.items.find(i=>i.unit==='buc'&&!i.id.includes('post')).quantity,3);
});
test('every placeable model, including mobile, gets a closed rectangle without stretched pieces or holes',()=>{
 let mobile=0,total=0;
 for(const m of catalog.models.filter(m=>m.kind==='panel'&&m.parameters.length&&hasModelVisual(m))){
  const product=defaultProduct(catalog,m.id),spec=placementSpec(catalog,product),p=rectanglePlan(emptyState(catalog),catalog,product,10,7),a=deriveAssembly(p.next,catalog);
  assert.equal(p.next.nodes.length,4,m.name);assert.equal(p.next.segments.length,4,m.name);assert.equal(a.parts.filter(p=>p.kind==='gap').length,0,m.name);
  if(!spec.continuous)for(const piece of a.parts.filter(p=>p.kind==='panel'))assert.ok(Math.abs(distance(piece.a,piece.b)-spec.width)<1e-6,m.name);
  if(m.legacyGenerator==='mobile')mobile++;total++;
 }
 assert.equal(total,93);assert.ok(mobile>=10);
});
test('closure refuses a partial module; crossing through a panel is blocked before commit',()=>{
 const start=emptyState(catalog),a={x:0,y:0};
 assert.throws(()=>proposeRun(start,catalog,vega,a,{x:7,y:0},{exact:true}),/Închiderea/);
 const first=proposeRun(start,catalog,vega,a,{x:10,y:0}).next;
 assert.throws(()=>proposeRun(first,catalog,vega,{x:1,y:-2.5},{x:1,y:2.5}),/gol/);
 const valid=proposeRun(first,catalog,vega,{x:5,y:-2.5},{x:5,y:2.5}).next;
 assert.equal(valid.nodes.filter(n=>n.x===5&&n.y===0).length,1);
 assert.equal(deriveAssembly(valid,catalog).parts.filter(p=>p.kind==='gap').length,0);
});
test('invalid node move cannot create a hidden leftover; legacy gaps remain explicit and intact',()=>{
 const first=proposeRun(emptyState(catalog),catalog,vega,{x:0,y:0},{x:5,y:0}).next;
 assert.throws(()=>preventNewGaps(first,moveNode(first,first.nodes[1].id,{x:4,y:0},catalog),catalog),/gol/);
 const old=addSegment(emptyState(catalog),{x:0,y:0},{x:4,y:0},vega,catalog);
 const next=rectanglePlan(old,catalog,vega,10,5).next;
 assert.equal(deriveAssembly(next,catalog).parts.filter(p=>p.kind==='gap').length,1);
 assert.deepEqual(next.nodes.slice(0,2),old.nodes);
});
test('free angle placement keeps metric lengths; continuous roll remains continuous',()=>{
 const p=proposeRun(emptyState(catalog),catalog,vega,{x:0,y:0},{x:6,y:4},{orthogonal:false});
 assert.ok(Math.abs(distance(p.a,p.b)-7.5)<1e-8);
 assert.equal(fittedLength(6.99,{continuous:true,width:25}).length,6.99);
});

test('dragging an orthogonal corner resizes both adjacent sides without distorting modules',async()=>{
 const {proposeMove}=await import('../fence-configurator/js/placement.js');
 const before=rectanglePlan(emptyState(catalog),catalog,vega,10,5).next;
 const corner=before.nodes.find(n=>n.x===10&&n.y===5);
 const after=proposeMove(before,catalog,corner.id,{x:12.2,y:7.4});
 assert.equal(after.nodes.find(n=>n.id===corner.id).x,12.5);assert.equal(after.nodes.find(n=>n.id===corner.id).y,7.5);
 const a=deriveAssembly(after,catalog);assert.equal(a.totalLength,40);assert.equal(a.parts.filter(p=>p.kind==='panel').length,16);assert.equal(a.parts.filter(p=>p.kind==='gap').length,0);
 assert.equal(before.nodes.find(n=>n.id===corner.id).x,10);
});

test('a placed mixed project restores exact components and exports the quantities shown by the scene',async()=>{
 const {configureParameter}=await import('../fence-configurator/js/ontology.js');
 const {assertState,csv}=await import('../fence-configurator/js/project.js');
 const v=configureParameter(catalog,configureParameter(catalog,vega,'height',1.73),'color','RAL6005');
 const mobile=defaultProduct(catalog,'d-596be6ab523c');
 let state=rectanglePlan(emptyState(catalog),catalog,v,10,5).next;
 state=rectanglePlan(state,catalog,mobile,10,7,'u').next;
 const before=deriveAssembly(state,catalog),after=deriveAssembly(assertState(JSON.parse(JSON.stringify(state)),catalog),catalog);
 assert.deepEqual(after,before);
 assert.equal(after.parts.filter(p=>p.kind==='panel').length,20); // 12 Vega + 3 + 2 + 3 mobile
 assert.equal(after.parts.filter(p=>p.kind==='post').length,12);
 const exported=csv(after,state);assert.match(exported,/8573483/);assert.match(exported,/8573266/);
 assert.equal(after.items.find(i=>i.code==='8573483').quantity,12);assert.equal(after.items.find(i=>i.code==='8573266').quantity,8);
});
