import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,addSegment,applyProduct,deriveAssembly} from '../fence-configurator/js/model.js';
import {SharedUndoManager} from '../shared-ui/src/history/undoManager.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/catalog.json',import.meta.url)));
const acoustic=catalog.products.find(p=>p.generator==='acoustic'&&p.variants.length);
const selection={productId:acoustic.id,variantId:acoustic.variants[0].id};
test('changing the whole layout updates scene and BOM while preserving points',()=>{
 const original=initialState(catalog),next=applyProduct(original,'s1',selection,'all',catalog);
 assert.deepEqual(next.nodes,original.nodes);
 assert.ok(next.segments.every(s=>s.productId===acoustic.id));
 assert.ok(deriveAssembly(next,catalog).parts.filter(p=>p.kind==='panel').every(p=>p.product.id===acoustic.id));
 assert.notDeepEqual(deriveAssembly(next,catalog).items,deriveAssembly(original,catalog).items);
 assert.notEqual(original.segments[0].productId,acoustic.id);
});
test('connected target includes corners and branches but leaves independent runs alone',()=>{
 let s=initialState(catalog);const current={productId:s.segments[0].productId,variantId:s.segments[0].variantId};
 s=addSegment(s,{x:7.5,y:0},{x:10,y:0},current,catalog);
 s=addSegment(s,{x:20,y:0},{x:25,y:0},current,catalog);
 const last=s.segments.at(-1).id,next=applyProduct(s,'s1',selection,'connected',catalog);
 assert.equal(next.segments.find(s=>s.id===last).productId,current.productId);
 assert.ok(next.segments.filter(s=>s.id!==last).every(s=>s.productId===acoustic.id));
});
test('invalid single-edge switch rejects atomically and preserves original project',()=>{
 const s=initialState(catalog),before=structuredClone(s);
 assert.throws(()=>applyProduct(s,'s1',selection,'segment',catalog),/Îmbinarea/);
 assert.deepEqual(s,before);
});
test('shared history restores the product and the derived assembly',async()=>{
 let state=initialState(catalog);const before=deriveAssembly(state,catalog);
 const history=new SharedUndoManager({capture:()=>structuredClone(state),restore:s=>{state=s;}});
 history.record();state=applyProduct(state,'s1',selection,'all',catalog);
 await history.undo();assert.deepEqual(deriveAssembly(state,catalog),before);
});
