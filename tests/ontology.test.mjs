import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultProduct,resolveProduct,configureParameter,availableValues} from '../fence-configurator/js/ontology.js';
import {emptyState,addSegment,applyProduct,assertState,deriveAssembly,previewAssembly,csv} from '../fence-configurator/js/project.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/ontology.json',import.meta.url)));
const vega='panouri-bordurate-vega-b',al='d-dd44fd6ecf24',home='d-94a19ed2e5ef';
test('three reference products have distinct sourced visual definitions and independent controls',()=>{
 for(const id of [vega,al,home]){const r=resolveProduct(catalog,defaultProduct(catalog,id));assert.ok(r.visual.evidence.length);assert.ok(r.model.parameters.some(p=>p.id==='color'));}
 assert.equal(resolveProduct(catalog,defaultProduct(catalog,vega)).visual.type,'mesh3d');
 assert.equal(resolveProduct(catalog,defaultProduct(catalog,home)).visual.frame,true);
 assert.equal(resolveProduct(catalog,defaultProduct(catalog,al)).visual.frame,false);
});
test('Vega height/color resolve actual SKU without requiring finish to be changed manually',()=>{
 let p=configureParameter(catalog,defaultProduct(catalog,vega),'height',1.73);
 p=configureParameter(catalog,p,'color','RAL6005');
 const r=resolveProduct(catalog,p);assert.equal(r.variant.height,1.73);assert.equal(r.variant.color,'#234c3b');assert.ok(r.commercial.sku);assert.equal(r.parameters.finish,'Acoperit colorat');
 assert.equal(r.variant.post.height,2.4);assert.equal(r.variant.post.clamps,3);
});
test('custom product preserves requested size and color without manufacturing SKU',()=>{
 let p=configureParameter(catalog,defaultProduct(catalog,al),'width',2.37);p=configureParameter(catalog,p,'height',1.81);p=configureParameter(catalog,p,'color','Alb');const r=resolveProduct(catalog,p);
 assert.equal(r.variant.width,2.37);assert.equal(r.variant.height,1.81);assert.equal(r.variant.color,'#ecece8');assert.equal(r.commercial,null);
 assert.throws(()=>configureParameter(catalog,p,'width',2.51),/limitelor/);assert.throws(()=>configureParameter(catalog,p,'height',0),/limitelor/);
});
test('all published tuples resolve; unsupported Cartesian combinations remain rejected',()=>{
 let rejected=0;
 for(const m of catalog.models.filter(m=>m.parameters.length&&!m.custom)){
  for(const v of m.commercialVariants)assert.ok(resolveProduct(catalog,{modelId:m.id,parameters:v.parameters}));
  for(const d of m.parameters.filter(d=>d.type==='enum'||d.type==='color'))for(const value of d.values){const p={modelId:m.id,parameters:{...m.defaults,[d.id]:value}},valid=availableValues(m,m.defaults,d.id).includes(value);if(!valid){rejected++;assert.throws(()=>resolveProduct(catalog,p));}}
 }
 assert.ok(rejected>0);
});
test('browsing and preview never mutate project; explicit apply and JSON preserve model properties',()=>{
 const p=defaultProduct(catalog,vega);let state=addSegment(emptyState(catalog),{x:0,y:0},{x:5,y:0},p,catalog);const before=JSON.stringify(state);
 previewAssembly(catalog,defaultProduct(catalog,al));assert.equal(JSON.stringify(state),before);
 state=applyProduct(state,'s1',defaultProduct(catalog,al),'all',catalog);
 assert.equal(state.segments[0].modelId,al);assert.equal(state.segments[0].parameters.width,2);
 const restored=assertState(JSON.parse(JSON.stringify(state)),catalog);assert.deepEqual(restored,state);
 assert.deepEqual(deriveAssembly(restored,catalog),deriveAssembly(state,catalog));
 assert.throws(()=>assertState({...state,schemaVersion:1},catalog),/migrare/);
 assert.throws(()=>assertState({...state,catalogVersion:'unknown'},catalog),/Catalog diferit/);
});
test('independent quantity example: two 2.5m panels across 5m plus a flagged 0.4m remainder',()=>{
 let p=configureParameter(catalog,defaultProduct(catalog,vega),'height',1.73);
 const state=addSegment(emptyState(catalog),{x:0,y:0},{x:5.4,y:0},p,catalog),a=deriveAssembly(state,catalog);
 assert.equal(a.parts.filter(p=>p.kind==='panel').length,2);assert.equal(a.items.find(r=>r.label.startsWith('Vega B')).quantity,2);
 assert.equal(a.parts.find(p=>p.kind==='gap').b.x-a.parts.find(p=>p.kind==='gap').a.x,.40000000000000036);
 assert.ok(a.issues.some(i=>i.code==='mounting-pitch'));assert.equal(a.complete,false);assert.match(csv(a,state),/preliminar/i);
});
test('crossing and explicit apply reuse graph rules without losing product parameters',()=>{
 const p=defaultProduct(catalog,al);let s=addSegment(emptyState(catalog),{x:0,y:0},{x:4,y:0},p,catalog);s=addSegment(s,{x:2,y:-2},{x:2,y:2},p,catalog);
 assert.equal(s.nodes.length,5);assert.equal(s.segments.length,4);assert.ok(s.segments.every(e=>e.parameters.width===2));
 s=applyProduct(s,'s1',defaultProduct(catalog,home),'connected',catalog);assert.ok(s.segments.every(e=>e.modelId===home));
});
