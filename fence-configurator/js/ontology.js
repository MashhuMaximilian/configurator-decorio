/** ProductModel / ParameterDefinition resolver. Source tuples remain indivisible. */
export function modelById(catalog,id){const model=catalog.models.find(m=>m.id===id);if(!model)throw Error('Model necunoscut în această versiune a catalogului.');return model;}
export function hasModelVisual(model){return model.visual?.status==='reconstructed';}
const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-7:a===b;
export function availableValues(model,parameters,key){
 const definition=model.parameters.find(p=>p.id===key);if(!definition)return [];
 if(model.custom)return definition.values;
 const editable=model.parameters.filter(p=>p.type!=='derived'&&p.id!==key);
 return definition.values.filter(value=>model.commercialVariants.some(v=>same(v.parameters[key],value)&&editable.every(p=>same(v.parameters[p.id],parameters[p.id]))));
}
export function resolveProduct(catalog,selection){
 const model=modelById(catalog,selection?.modelId),parameters=selection?.parameters;
 if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw Error('Proprietățile produsului lipsesc.');
 if(!model.parameters.length)throw Error('Acest model necesită date suplimentare înainte de configurare.');
 for(const key of Object.keys(parameters))if(!model.parameters.some(d=>d.id===key))throw Error('Proprietate necunoscută: '+key);
 const values={};
 for(const d of model.parameters){
  if(d.type==='derived')continue;
  const value=parameters[d.id];
  if(d.type==='number'){
   if(!Number.isFinite(value)||value<=0||(d.min!==null&&value<d.min-1e-7)||value>d.max+1e-7)throw Error(d.label+': valoare în afara limitelor publicate.');
  }else if(!d.values.some(v=>same(v,value))&&!(model.custom&&d.allowRequestedRal&&/^RAL\d{4}$/.test(value)))throw Error(d.label+': opțiunea nu este documentată pentru acest model.');
  values[d.id]=value;
 }
 const commercial=model.custom?model.commercialVariants[0]:model.commercialVariants.find(v=>Object.entries(values).every(([k,x])=>same(v.parameters[k],x)));
 if(!commercial)throw Error('Această combinație nu este documentată. Ajustează proprietățile evidențiate; celelalte alegeri au fost păstrate.');
 for(const d of model.parameters.filter(p=>p.type==='derived'))values[d.id]=commercial.parameters[d.id];
 const colorDefinition=model.parameters.find(d=>d.id==='color');
 const color=colorDefinition?.swatches?.[values.color]||(colorDefinition?.allowRequestedRal?'#808080':commercial.legacy.color);
 const variant={...commercial.legacy,...values,color,finish:values.color,madeToOrder:model.custom,label:[values.width+' × '+values.height+' m',values.color].join(' · ')};
 delete variant.dimensionBounds;
 return {model,parameters:values,commercial: model.custom?null:commercial,sourceVariant:commercial,source:commercial.source||model.sources[0],variant,visual:model.visual};
}
export function configureParameter(catalog,selection,key,value){
 const next={modelId:selection.modelId,parameters:{...selection.parameters,[key]:value}};
 const result=resolveProduct(catalog,next);return {...next,parameters:result.parameters};
}
/** Return actual available tuples requiring the fewest additional changes. The caller must ask before applying. */
export function parameterAlternatives(catalog,selection,key,value){
 const model=modelById(catalog,selection.modelId);
 if(model.custom)return [];
 const editable=model.parameters.filter(p=>p.type!=='derived');
 const candidates=model.commercialVariants.filter(v=>same(v.parameters[key],value)).map(v=>{
  const changes=editable.filter(p=>!same(v.parameters[p.id],selection.parameters[p.id])).map(p=>({key:p.id,label:p.label,from:selection.parameters[p.id],to:v.parameters[p.id],unit:p.unit||''}));
  return {selection:{modelId:model.id,parameters:{...v.parameters}},changes};
 }).sort((a,b)=>a.changes.length-b.changes.length);
 const seen=new Set();return candidates.filter(c=>{const signature=productSignature(c.selection);if(seen.has(signature))return false;seen.add(signature);return true;}).slice(0,8);
}
export function defaultProduct(catalog,id){const model=modelById(catalog,id);return {modelId:id,parameters:{...model.defaults}};}
export function productSignature(selection){return selection.modelId+'|'+JSON.stringify(Object.entries(selection.parameters).sort(([a],[b])=>a.localeCompare(b)));}
