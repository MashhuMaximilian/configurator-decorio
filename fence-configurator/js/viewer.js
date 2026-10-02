import * as THREE from 'three';
import {disposeObjectResources} from '../../shared-3d/src/geometry/resourceLifecycle.js';
import {installVisualPrimitives,buildModelVisual} from './visualGeometry.js';
import {FenceScene} from './scene.js';
import {productSignature} from './ontology.js';
// Use the platform fence camera, environment, lighting, renderer and dimensions.
export class DecorioViewer extends FenceScene {
 updateStudioLights(){super.updateStudioLights();for(const light of [this.studioKey,this.studioFill,this.studioRim,this.studioSpot])light.intensity*=.4;}
 applyEnvironment(state){super.applyEnvironment(state);this.ambient.intensity*=.45;this.sun.intensity*=.7;this.renderer.toneMappingExposure=.95;}
 constructor(host){
  super(host);
  this.group=this.modelGroup;
  this.surface.materials.register('decorio.steel',{type:'standard',roughness:.55,metalness:.55});
  this.surface.materials.register('decorio.stone',{type:'standard',roughness:.95,metalness:0});
  this.surface.materials.register('decorio.transparent-acoustic',{type:'physical',roughness:.15,metalness:0,transparent:true,opacity:.25,depthWrite:false});
  this.materials=new Map();
  installVisualPrimitives(this.surface.geometry);
  this.renderer.domElement.addEventListener('pointerdown',e=>this.pointerStart={x:e.clientX,y:e.clientY});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!this.pointerStart||Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>5)return;const r=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.x)/r.width*2-1,-(e.clientY-r.y)/r.height*2+1),this.camera);const hit=ray.intersectObjects(this.group.children,true)[0];let o=hit?.object;while(o&&!o.userData.segmentId)o=o.parent;if(o)this.onSelect?.(o.userData.segmentId);});
  this.setPreferences({units:'metric',locale:'ro-RO'});
  this.applyEnvironment({sunPosition:50});
 }
 clear(){this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});disposeObjectResources(this.group,{materialFilter:()=>true});this.group.clear();this.materials.clear();}
 material(color,type=this.activeMaterial||'decorio.steel'){const key=type+color;if(!this.materials.has(key))this.materials.set(key,this.surface.materials.create(type,{color}));return this.materials.get(key);}
 box(group,x,y,z,w,h,d,color){const mesh=this.surface.geometry.mesh(this.surface.geometry.create('primitive.box',{width:w,height:h,depth:d}),this.material(color),{uv:true,castShadow:true,receiveShadow:true});mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 wires(group,w,h,v,type){
  const segments=[],pitchX=v.meshX||.05,pitchY=v.meshY||.2;
  const columns=Math.max(1,Math.floor(w/pitchX)),rows=Math.max(1,Math.floor(h/pitchY));
  const xs=Array.from({length:Math.min(5000,columns)+1},(_,i)=>Math.min(w,i*Math.ceil(columns/5000)*pitchX));if(xs.at(-1)<w-1e-6)xs.push(w);
  const horizontalLevels=Array.from({length:Math.min(1000,rows)+1},(_,i)=>Math.min(h,i*Math.ceil(rows/1000)*pitchY));if(horizontalLevels.at(-1)<h-1e-6)horizontalLevels.push(h);
  const bends=h<1.6?2:h<2.1?3:4;
  const levels=Array.from({length:bends},(_,i)=>.15+(h-.3)*i/(bends-1));
  const z=y=>type==='mesh3d'?Math.max(0,...levels.map(level=>1-Math.abs(y-level)/.05))*.035:0;
  const ys=[...horizontalLevels,...(type==='mesh3d'?levels.flatMap(y=>[y-.05,y,y+.05]):[])].sort((a,b)=>a-b).filter((y,i,a)=>i===0||y-a[i-1]>.00001);
  for(const offset of xs){const x=-w/2+offset;for(let j=1;j<ys.length;j++)segments.push([x,ys[j-1],z(ys[j-1]),x,ys[j],z(ys[j])]);}
  for(const y of horizontalLevels){segments.push([-w/2,y,z(y),w/2,y,z(y)]);if(type==='mesh2d')segments.push([-w/2,y,.009,w/2,y,.009]);}
  if(type==='chainlink'){
   segments.length=0;const pitch=pitchX*2;for(let x=-w/2-h;x<w/2+h;x+=pitch)for(const sign of [-1,1]){const ends=[(-w/2-x)/sign,(w/2-x)/sign].sort((a,b)=>a-b),start=Math.max(0,ends[0]),end=Math.min(h,ends[1]);if(end>start)segments.push([x+sign*start,start,0,x+sign*end,end,0]);}
  }
  const wire=String(v.wire||'4').split('/').map(Number),verticalRadius=(v.wireVertical||wire[1]||wire[0]||4)/2000,horizontalRadius=(v.wireHorizontal||wire[0]||4)/2000;
  const geo=this.surface.geometry.create('primitive.cylinder',{radius:1,height:1,radialSegments:6});
  const mesh=new THREE.InstancedMesh(geo,this.material(v.color||'#666666'),segments.length),dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  segments.forEach((p,i)=>{const a=new THREE.Vector3(...p.slice(0,3)),b=new THREE.Vector3(...p.slice(3)),d=b.clone().sub(a),radius=Math.abs(d.y)<1e-6?horizontalRadius:verticalRadius;dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,d.clone().normalize());dummy.scale.set(radius,d.length(),radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 horizontal(group,w,h,c,visual){
  const frame=visual.frame?Math.min(.04,w/8,h/8):0,iw=w-frame*2,ih=h-frame*2;
  if(frame){this.box(group,0,frame/2,0,w,frame,visual.depth,c);this.box(group,0,h-frame/2,0,w,frame,visual.depth,c);for(const x of [-w/2+frame/2,w/2-frame/2])this.box(group,x,h/2,0,frame,ih,visual.depth,c);}
  else {for(const x of [-w/2+.025,w/2-.025])this.box(group,x,h/2,-.025,Math.min(.035,w/8),h,.04,c);}
  const pattern=visual.pattern||[visual.boardHeight],pieces=[];let used=0,i=0;
  while(used<ih-1e-6&&i<150){const bh=pattern[i%pattern.length],gap=i?(visual.group&&i%visual.group===0?visual.groupGap:visual.gap):0;if(used+gap>=ih)break;used+=gap;const height=Math.min(bh,ih-used);pieces.push({start:used,height});used+=height;i++;}
  // Profile section stays fixed. Only the last visual infill changes height; dimensions are explicitly estimated.
  for(const p of pieces)this.box(group,0,frame+p.start+p.height/2,0,iw,p.height,visual.depth,c);
 }
 panel(part){
  // Shared presets describe surface appearance, independently of the steel/aluminium substrate.
  this.activeMaterial=/zinc/i.test(part.variant.finish)?'steel.brushed':'aluminium.powderCoated';
  const {a,b,variant:v,product:p}=part,w=part.kind==='gate'?v.width:Math.hypot(b.x-a.x,b.y-a.y),h=v.height,g=new THREE.Group();g.position.set((a.x+b.x)/2,v.groundClearance||0,(a.y+b.y)/2);g.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);g.userData.segmentId=part.segmentId;this.group.add(g);const c=v.color||'#5a625c';
  if(part.visual?.type==='gate-preview'){
   const count=part.visual.leaves,leafWidth=w/count;
   for(let i=0;i<count;i++){const leaf=new THREE.Group();leaf.position.x=-w/2+(i+.5)*leafWidth;g.add(leaf);const shape={...part.visual.infill,frame:true};if(shape.type==='horizontal')this.horizontal(leaf,leafWidth-.015,h,c,shape);else buildModelVisual(this,leaf,leafWidth-.015,h,c,shape);}
   return;
  }
  if(part.visual?.type==='transparent-acoustic'){
   this.activeMaterial='decorio.transparent-acoustic';this.box(g,0,h/2,0,w,h,.012,'#cedbd9');this.activeMaterial='aluminium.powderCoated';
   for(const x of [-w/2+.02,w/2-.02])this.box(g,x,h/2,0,.04,h,.04,'#aab1b0');for(const y of [.02,h-.02])this.box(g,0,y,0,w,.04,.04,'#aab1b0');return;
  }
  if(part.visual?.type==='noistop'){
   const wood=part.visual.construction==='wood',essential=part.visual.construction==='essential',depth=v.depth;
   this.activeMaterial='plastic.foam';this.box(g,0,h/2,0,w-.03,h-.03,Math.max(.01,depth-.035),wood?'#34382e':'#6e7550');
   this.activeMaterial=wood?'wood.oak':essential?'aluminium.powderCoated':'steel.brushed';
   for(const side of [-1,1]){
    const face=new THREE.Group();face.position.z=side*depth/2;g.add(face);
    if(wood){for(let y=.025;y<h;y+=.065)this.box(face,0,y,0,w,Math.min(.038,h-y),.016,'#9c6939');}
    else this.wires(face,w,h,{color:c,wire:4,meshX:essential?.05:.1,meshY:essential?.2:.1},'roll-welded');
    this.activeMaterial=wood?'wood.oak':essential?'aluminium.powderCoated':'steel.brushed';
    for(const x of [-w/2+.012,w/2-.012])this.box(face,x,h/2,0,.024,h,.02,wood?'#9c6939':c);
    for(const y of [.012,h-.012])this.box(face,0,y,0,w,.024,.02,wood?'#9c6939':c);
   }return;
  }
  if(part.visual?.type==='gabion-cage'){
   const mesh={...v,meshX:.1,meshY:.1,wire:4};
   for(const side of [-1,1]){const face=new THREE.Group();face.position.z=side*v.depth/2;this.wires(face,w,h,mesh,'roll-welded');g.add(face);const end=new THREE.Group();end.position.x=side*w/2;end.rotation.y=Math.PI/2;this.wires(end,v.depth,h,mesh,'roll-welded');g.add(end);}
   for(const y of [0,h]){const cap=new THREE.Group();cap.rotation.x=Math.PI/2;cap.position.set(0,y,-v.depth/2);this.wires(cap,w,v.depth,mesh,'roll-welded');g.add(cap);}return;
  }
  if(part.visual?.type==='mobile-frame'){
   const visual=part.visual,tv=visual.tubeVertical,th=visual.tubeHorizontal;
   for(const x of [-w/2+tv/2,w/2-tv/2]){const tube=new THREE.Mesh(this.surface.geometry.create('primitive.cylinder',{radius:tv/2,height:h,radialSegments:12}),this.material(c));tube.position.set(x,h/2,0);g.add(tube);}
   for(const y of [th/2,h-th/2]){const tube=new THREE.Mesh(this.surface.geometry.create('primitive.cylinder',{radius:th/2,height:w-tv,radialSegments:12}),this.material(c));tube.rotation.z=Math.PI/2;tube.position.set(0,y,0);g.add(tube);}
   const infill=new THREE.Group();infill.position.y=th;g.add(infill);this.wires(infill,w-tv*2,h-th*2,{...v,wireVertical:visual.wireVertical,wireHorizontal:visual.wireHorizontal},'roll-welded');return;
  }
  if(part.visual?.type==='horizontal'){this.horizontal(g,w,h,c,part.visual);}
  else if(buildModelVisual(this,g,w,h,c,part.visual)){}
  else if(part.generator==='acoustic'||part.generator==='solid'){this.box(g,0,h/2,0,w,h,v.depth,c);if(part.generator==='acoustic')for(let x=-w/2+.08;x<w/2;x+=.15)this.box(g,x,h/2,v.depth/2+.003,.018,h,.008,'#7e735d');}
  else if(part.generator==='gabion'){
   this.box(g,0,h/2,0,w,h,v.depth,'#b1ada0');const edge=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,v.depth));const wire=new THREE.LineSegments(edge,new THREE.LineBasicMaterial({color:'#505955'}));wire.position.y=h/2;g.add(wire);
   for(const z of [-v.depth/2-.002,v.depth/2+.002]){const front=new THREE.Group();front.position.z=z;this.wires(front,w,h,{...v,meshX:.1,meshY:.1},'mesh2d');g.add(front);}
  }else{
   this.wires(g,w,h,v,part.generator);
   if(['mobile','industrial'].includes(part.generator)){this.box(g,-w/2,h/2,0,.035,h,.035,c);this.box(g,w/2,h/2,0,.035,h,.035,c);this.box(g,0,h,0,w,.035,.035,c);this.box(g,0,.025,0,w,.035,.035,c);}
   if(part.generator==='mobile'){/* Bases are not inferred: only catalogued frame is rendered. */}
  }
  if(part.kind==='gate'){
   this.box(g,-w/2,h/2,0,.06,h+.08,.06,c);this.box(g,w/2,h/2,0,.06,h+.08,.06,c);
   this.box(g,0,h/2,0,w,.035,.035,c);this.box(g,0,h,0,w,.035,.035,c);this.box(g,0,.05,0,w,.035,.035,c);
   this.box(g,w/2-.14,h*.5,.06,.18,.025,.025,'#dcb86e');
   const radius=w/(v.leaves||1),curve=[];const side=part.handing==='left'?1:-1;
   for(let i=0;i<=30;i++){const ang=i*Math.PI/2/30;curve.push(new THREE.Vector3(-w/2+Math.cos(ang)*radius,.03,side*Math.sin(ang)*radius));}
   g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve),new THREE.LineBasicMaterial({color:'#c58a3b'})));
  }
 }
 render(assembly,state,{fit=false,selected=''}={}){
  this.clear();const templates=new Map();for(const part of assembly.parts){
   if(part.kind!=='gap'&&!part.visual)continue;
   if(!['gap','post'].includes(part.kind)&&part.visual.status!=='reconstructed')continue;
   if(part.kind==='post'){
    const v=part.variant;if(!part.section)continue;
    const post=new THREE.Group();post.position.set(part.point.x,0,part.point.y);post.userData.component='post';post.userData.orderLength=part.orderLength;this.group.add(post);
    this.box(post,0,part.displayHeight/2,0,part.section.width,part.displayHeight,part.section.depth,v.color);
    for(let i=0;i<part.fixings;i++){const clamp=this.box(post,0,.12+(v.height-.24)*i/Math.max(1,part.fixings-1),part.section.depth/2,.07,.018,.012,v.color);clamp.userData.component='fixing';clamp.userData.visualEstimate=true;}
   }
   else if(part.kind==='gap'){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(part.a.x,.045,part.a.y),new THREE.Vector3(part.b.x,.045,part.b.y)]);const l=new THREE.Line(geo,new THREE.LineDashedMaterial({color:'#c26242',dashSize:.13,gapSize:.08}));l.computeLineDistances();this.group.add(l);}
   else {
    const key=(part.resolved?productSignature({modelId:part.resolved.model.id,parameters:part.resolved.parameters}):part.generator)+'|'+Math.hypot(part.b.x-part.a.x,part.b.y-part.a.y).toFixed(6)+'|'+part.kind+'|'+part.handing;
    const template=templates.get(key);
    if(template){const group=template.clone(true);group.position.set((part.a.x+part.b.x)/2,part.variant.groundClearance||0,(part.a.y+part.b.y)/2);group.rotation.y=-Math.atan2(part.b.y-part.a.y,part.b.x-part.a.x);group.userData.segmentId=part.segmentId;this.group.add(group);}
    else{const index=this.group.children.length;this.panel(part);templates.set(key,this.group.children[index]);}
   }
  }
  const bounds=new THREE.Box3().setFromObject(this.group);
  if(bounds.isEmpty())bounds.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(8,3,8));
  this.currentBuild={bounds:{box:bounds,center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())},runSegments:state.segments.filter(s=>state.segments.length<=20||s.id===selected).map(s=>{
   const a=state.nodes.find(n=>n.id===s.a),b=state.nodes.find(n=>n.id===s.b);
   return {points:[new THREE.Vector3(a.x,0,a.y),new THREE.Vector3(b.x,0,b.y)],length:Math.hypot(b.x-a.x,b.y-a.y)};
  })};
  if(!state.segments.length&&assembly.parts[0]?.a){const p=assembly.parts[0];this.currentBuild.runSegments=[{points:[new THREE.Vector3(p.a.x,0,p.a.y),new THREE.Vector3(p.b.x,0,p.b.y)],length:p.variant.width}];}
  this.updateDimensions({showDimensions:state.options.dimensions,height:Math.max(.1,...assembly.parts.map(p=>p.variant?.height||0))});
  if(selected){const selectionBounds=new THREE.Box3();for(const group of this.group.children)if(group.userData.segmentId===selected)selectionBounds.expandByObject(group);if(!selectionBounds.isEmpty()){const helper=new THREE.Box3Helper(selectionBounds,0xc48432);this.surface.geometry.adopt(helper.geometry,{kind:'decorio.selection'});helper.raycast=()=>{};this.group.add(helper);}}
  this.surface.invalidate();
  this.renderer.domElement.dataset.models=JSON.stringify([...new Set(assembly.parts.map(p=>p.resolved?.model.id).filter(Boolean))]);
  if(fit)this.fit(state);
 }
 fit(){
  if(!this.currentBuild)return;
  this.resize();this.fitCamera();
  const {size,center}=this.currentBuild.bounds,radius=Math.max(.5,size.length()/2),vFov=THREE.MathUtils.degToRad(this.camera.fov),hFov=2*Math.atan(Math.tan(vFov/2)*this.camera.aspect),distance=radius/Math.sin(Math.min(vFov,hFov)/2)*1.2;
  const direction=this.camera.position.clone().sub(this.controls.target).normalize();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.controls.maxDistance=Math.max(70,distance*3);this.camera.far=Math.max(250,distance*6);this.camera.updateProjectionMatrix();this.controls.update();
 }
 front(){const b=this.currentBuild?.bounds;if(!b)return;this.resize();const tangent=Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2),distance=Math.max(b.size.x/(2*tangent*this.camera.aspect),b.size.y/(2*tangent))*1.35+b.size.z/2;this.controls.target.copy(b.center);this.camera.position.copy(b.center).add(new THREE.Vector3(0,.01,distance));this.controls.update();}
 setLight(value){this.applyEnvironment({sunPosition:value/6.28*100});}
}
