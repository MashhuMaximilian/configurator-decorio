import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultProduct,resolveProduct,configureParameter,parameterAlternatives,availableValues} from '../fence-configurator/js/ontology.js';
import {emptyState,addSegment,deriveAssembly} from '../fence-configurator/js/project.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/ontology.json',import.meta.url)));
test('dependent choices offer only real tuples without modifying the current product',()=>{
 let checks=0;
 for(const m of catalog.models.filter(m=>m.parameters.length&&!m.custom))for(const d of m.parameters.filter(d=>['enum','color'].includes(d.type)))for(const v of d.values){
  if(availableValues(m,m.defaults,d.id).includes(v))continue;
  const selection=defaultProduct(catalog,m.id),before=JSON.stringify(selection),proposals=parameterAlternatives(catalog,selection,d.id,v);
  assert.ok(proposals.length);for(const p of proposals){assert.equal(p.selection.parameters[d.id],v);assert.ok(resolveProduct(catalog,p.selection).commercial);assert.ok(p.changes.length>1);}
  assert.equal(JSON.stringify(selection),before);checks++;
 }
 assert.ok(checks>0);
});
test('every configurable default is valid and every parameter has resolvable evidence',()=>{
 for(const m of catalog.models.filter(m=>m.parameters.length)){
  assert.ok(resolveProduct(catalog,defaultProduct(catalog,m.id)));
  for(const p of m.parameters){assert.ok(p.evidence.length,m.name+' '+p.id);for(const ref of p.evidence)assert.ok(catalog.evidence[ref]?.url);}
 }
});
test('source order lengths and fixing quantities remain separate from estimated placement',()=>{
 const selection=configureParameter(catalog,defaultProduct(catalog,'panouri-bordurate-vega-b'),'height',1.73);
 let state=addSegment(emptyState(catalog),{x:0,y:0},{x:5,y:0},selection,catalog);
 state=addSegment(state,{x:5,y:0},{x:5,y:2.5},selection,catalog);
 const a=deriveAssembly(state,catalog),posts=a.parts.filter(p=>p.kind==='post');
 assert.equal(posts.length,4);assert.equal(a.items.find(i=>i.id.includes('-post-')).quantity,4);
 assert.equal(posts.reduce((n,p)=>n+p.fixings,0),12);assert.equal(a.items.find(i=>i.id.includes('-clamp-')).quantity,12);
 for(const post of posts){assert.equal(post.orderLength,2.4);assert.equal(post.visual.status,'schematic');assert.equal(post.section.width,.06);}
});
test('gate ranges are configurable without pretending they are installed openings',()=>{
 const p=configureParameter(catalog,defaultProduct(catalog,'d-65247b2c3b82'),'width',1.1),r=resolveProduct(catalog,p);
 assert.equal(r.variant.width,1.1);assert.equal(r.variant.opening,undefined);assert.equal(r.commercial,null);assert.equal(r.visual.type,'gate-preview');
 assert.throws(()=>configureParameter(catalog,p,'width',1.3),/limitelor/);
});
test('requested RAL is stored without a fabricated digital swatch or SKU',()=>{
 const p=configureParameter(catalog,defaultProduct(catalog,'d-dd44fd6ecf24'),'color','RAL7021'),r=resolveProduct(catalog,p);
 assert.equal(r.parameters.color,'RAL7021');assert.equal(r.variant.color,'#808080');assert.equal(r.commercial,null);
 assert.throws(()=>configureParameter(catalog,p,'color','red'),/documentată/);
});
