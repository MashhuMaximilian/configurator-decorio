import * as THREE from 'three';
import {FenceScene} from './scene.js';
// Use the platform fence camera, environment, lighting, renderer and dimensions.
export class DecorioViewer extends FenceScene {
 constructor(host){
  super(host);
  this.group=this.modelGroup;
  this.setPreferences({units:'metric',locale:'ro-RO'});
  this.applyEnvironment({sunPosition:50});
 }
 clear(){this.group.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});this.group.clear();}
 box(group,x,y,z,w,h,d,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.3}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
 wires(group,w,h,v,type){
  const points=[];const pitchX=v.meshX||.05,pitchY=v.meshY||.2;
  // Bound detail on long layouts without changing panel envelope or quantities.
  const columns=Math.max(1,Math.min(70,Math.round(w/pitchX))),rows=Math.max(2,Math.min(35,Math.round(h/pitchY)));
  const z=y=>type==='mesh3d'?Math.max(0,1-Math.abs((y%(h/3))-.13)/.08)*.035:0;
  for(let i=0;i<=columns;i++){const x=-w/2+w*i/columns;for(let j=0;j<Math.max(4,rows*2);j++){const y0=h*j/(rows*2),y1=h*(j+1)/(rows*2);points.push(x,y0,z(y0),x,y1,z(y1));}}
  for(let i=0;i<=rows;i++){const y=h*i/rows;points.push(-w/2,y,z(y),w/2,y,z(y));if(type==='mesh2d')points.push(-w/2,y+.009,.006,w/2,y+.009,.006);}
  if(type==='chainlink'){
   points.length=0;const pitch=.14;for(let x=-w/2-h;x<w/2+h;x+=pitch)for(const sign of [-1,1]){const ends=[(-w/2-x)/sign,(w/2-x)/sign].sort((a,b)=>a-b),start=Math.max(0,ends[0]),end=Math.min(h,ends[1]);if(end>start)points.push(x+sign*start,start,0,x+sign*end,end,0);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:v.color||'#555d5a'})));
 }
 panel(part){
  const {a,b,variant:v,product:p}=part,w=part.kind==='gate'?v.width:Math.hypot(b.x-a.x,b.y-a.y),h=v.height,g=new THREE.Group();g.position.set((a.x+b.x)/2,v.groundClearance||0,(a.y+b.y)/2);g.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);this.group.add(g);const c=v.color||'#5a625c';
  if(part.generator==='acoustic'||part.generator==='solid'){this.box(g,0,h/2,0,w,h,v.depth,c);if(part.generator==='acoustic')for(let x=-w/2+.08;x<w/2;x+=.15)this.box(g,x,h/2,v.depth/2+.003,.018,h,.008,'#7e735d');}
  else if(part.generator==='gabion'){
   this.box(g,0,h/2,0,w,h,v.depth,'#b1ada0');const edge=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,v.depth));const wire=new THREE.LineSegments(edge,new THREE.LineBasicMaterial({color:'#505955'}));wire.position.y=h/2;g.add(wire);
   for(const z of [-v.depth/2-.002,v.depth/2+.002]){const front=new THREE.Group();front.position.z=z;this.wires(front,w,h,{...v,meshX:.1,meshY:.1},'mesh2d');g.add(front);}
  }else if(part.generator==='slats'||part.generator==='bars'){
   for(let x=-w/2+.035;x<w/2;x+=.1)this.box(g,x,h/2,0,.055,h,.045,c);
   this.box(g,0,.15,0,w,.045,.045,c);this.box(g,0,h-.15,0,w,.045,.045,c);
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
 render(assembly,state,{fit=false}={}){
  this.clear();for(const part of assembly.parts){
   if(part.kind==='post'){const v=part.variant;this.box(this.group,part.point.x,(v.height+(v.groundClearance||0))/2,part.point.y,.06,v.height+(v.groundClearance||0)+.06,.04,v.color);}
   else if(part.kind==='gap'){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(part.a.x,.045,part.a.y),new THREE.Vector3(part.b.x,.045,part.b.y)]);const l=new THREE.Line(geo,new THREE.LineDashedMaterial({color:'#c26242',dashSize:.13,gapSize:.08}));l.computeLineDistances();this.group.add(l);}
   else this.panel(part);
  }
  const bounds=new THREE.Box3().setFromObject(this.group);
  if(bounds.isEmpty())bounds.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(8,3,8));
  this.currentBuild={bounds:{box:bounds,center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())},runSegments:state.segments.map(s=>{
   const a=state.nodes.find(n=>n.id===s.a),b=state.nodes.find(n=>n.id===s.b);
   return {points:[new THREE.Vector3(a.x,0,a.y),new THREE.Vector3(b.x,0,b.y)],length:Math.hypot(b.x-a.x,b.y-a.y)};
  })};
  this.updateDimensions({showDimensions:state.options.dimensions,height:Math.max(.1,...assembly.parts.map(p=>p.variant?.height||0))});
  if(fit)this.fit(state);
 }
 fit(){
  if(!this.currentBuild)return;
  this.fitCamera();
  const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
  if(aspect<1)this.camera.position.sub(this.controls.target).multiplyScalar(1/aspect).add(this.controls.target);
  this.controls.update();
 }
 setLight(value){this.applyEnvironment({sunPosition:value/6.28*100});}
}
