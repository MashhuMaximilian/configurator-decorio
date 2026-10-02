import * as graph from './model.js';
import {resolveProduct,productSignature,hasModelVisual} from './ontology.js';
export const APP_ID='decorio-fence';
export const SCHEMA_VERSION=2;
export const distance=graph.distance;
export const csv=graph.csv;
export function emptyState(catalog){return {appId:APP_ID,schemaVersion:SCHEMA_VERSION,catalogVersion:catalog.version,name:'Proiect Decorio',nodes:[],segments:[],gates:[],options:{dimensions:true}};}
/** The proven graph kernel is reused through an ephemeral adapter. Persist only model + parameters. */
function bridge(state,catalog,extra){
 const products=[],bySignature=new Map(),selections=new Map();
 function register(selection){
  const resolved=resolveProduct(catalog,selection),canonical={modelId:selection.modelId,parameters:resolved.parameters},key=productSignature(canonical);
  if(bySignature.has(key))return bySignature.get(key);
  const id='p'+products.length,{model,variant}=resolved;
  const product={id,name:model.name,kind:model.kind,generator:model.legacyGenerator,variants:[{...variant,id:'resolved'}],source:resolved.source,limitations:model.limitations,compatibleWith:[],resolved};
  products.push(product);bySignature.set(key,id);selections.set(id,canonical);return id;
 }
 const convert=e=>({...e,productId:register(e),variantId:'resolved'});
 const converted={...state,schemaVersion:1,segments:state.segments.map(convert),gates:state.gates.map(convert)};
 const selection=extra?{productId:register(extra),variantId:'resolved'}:null;
 // Only original, evidenced compatibility lists can connect gate and fence models.
 for(const p of products)p.compatibleWith=products.filter(t=>p.resolved.model.compatibleWith.some(id=>t.resolved.model.sourceProductIds.includes(id))).map(t=>t.id);
 const legacyCatalog={version:catalog.version,products};
 const from=next=>{const restore=e=>{const {productId,variantId,dimensions,modelId,parameters,...rest}=e;return {...rest,...structuredClone(selections.get(productId))};};return {...next,schemaVersion:SCHEMA_VERSION,segments:next.segments.map(restore),gates:next.gates.map(restore)};};
 return {state:converted,catalog:legacyCatalog,selection,from};
}
export function assertState(input,catalog){
 if(!input||input.appId!==APP_ID)throw Error('Cealaltă aplicație are produse diferite. Importă un proiect Decorio.');
 if(input.schemaVersion!==2)throw Error('Versiune incompatibilă. Proiectele vechi necesită o migrare verificată; fișierul original rămâne utilizabil în versiunea veche.');
 if(input.catalogVersion!==catalog.version)throw Error('Catalog diferit. Nu înlocuim automat produsele sau dimensiunile salvate.');
 if(!['nodes','segments','gates'].every(k=>Array.isArray(input[k])))throw Error('Structură de proiect invalidă.');
 const b=bridge(input,catalog);return b.from(graph.assertState(b.state,b.catalog));
}
export function addSegment(state,a,b,selection,catalog){const x=bridge(state,catalog,selection);return x.from(graph.addSegment(x.state,a,b,x.selection,x.catalog));}
export function moveNode(state,id,p,catalog){const x=bridge(state,catalog);return x.from(graph.moveNode(x.state,id,p,x.catalog));}
export function deleteNode(state,id,catalog){const x=bridge(state,catalog);return x.from(graph.deleteNode(x.state,id,x.catalog));}
export function deleteSegment(state,id,catalog){const x=bridge(state,catalog);return x.from(graph.deleteSegment(x.state,id,x.catalog));}
export function setSegmentLength(state,id,length,catalog){const x=bridge(state,catalog);return x.from(graph.setSegmentLength(x.state,id,length,x.catalog));}
export function applyProduct(state,id,selection,scope,catalog){const x=bridge(state,catalog,selection);return x.from(graph.applyProduct(x.state,id,x.selection,scope,x.catalog));}
function enrich(assembly){
 for(const part of assembly.parts)if(part.product){part.resolved=part.product.resolved;part.visual=part.resolved.visual;}
 return assembly;
}
export function deriveAssembly(state,catalog){
 assertState(state,catalog);const b=bridge(state,catalog),a=enrich(graph.deriveAssembly(b.state,b.catalog));
 // A module envelope is not an installed pitch. Never claim the preliminary arrangement as mounted geometry.
 for(const s of state.segments){const r=resolveProduct(catalog,s);a.issues.push({code:'mounting-pitch',segmentId:s.id,message:'Lățimea produsului este '+r.variant.width+' m. Pasul montat și rosturile necesită confirmare; aranjamentul afișează anvelopele produselor.'});}
 for(const s of state.segments)if(!hasModelVisual(resolveProduct(catalog,s).model))a.issues.push({code:'visual-unavailable',segmentId:s.id,message:'Acest model nu are încă o reconstrucție 3D; consultă fotografia din catalog. Cantitățile preliminare rămân în listă.'});
 // Keep purchased components in the same result consumed by both the scene and CSV.
 // Below-ground lengths remain order data; estimated placements are labelled separately.
 for(const part of a.parts)if(part.kind==='post'){
  const post=part.variant.post;
  part.visual={type:'post',status:'schematic',estimated:['Poziția în montaj și înălțimea vizibilă necesită confirmare.']};
  part.orderLength=post.height;
  part.displayHeight=part.variant.height+(part.variant.groundClearance||0)+.06;
  part.section=post.system==='OMEGA'?{width:.06,depth:.04}:null;
  part.fixings=post.clamps||0;
 }
 a.complete=false;
 return a;
}
export function previewAssembly(catalog,selection){
 const resolved=resolveProduct(catalog,selection),{variant,model}=resolved;
 return {parts:[{kind:model.kind==='gate'?'gate':'panel',a:{x:-variant.width/2,y:0},b:{x:variant.width/2,y:0},variant,product:{name:model.name},resolved,visual:model.visual,generator:model.legacyGenerator}],items:[],issues:[],totalLength:variant.width,complete:false};
}
