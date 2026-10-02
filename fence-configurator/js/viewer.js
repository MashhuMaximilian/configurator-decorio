import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export class DecorioViewer{
 constructor(host){
  this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8e9e3');
  this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(this.renderer.domElement);
  this.camera=new THREE.PerspectiveCamera(42,1,.05,2000);this.camera.position.set(13,11,16);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI/2-.03;
  this.scene.add(new THREE.HemisphereLight('#ffffff','#b9bdab',2.2));this.sun=new THREE.DirectionalLight('#fff3dd',3);this.sun.position.set(8,18,12);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,far:100});this.scene.add(this.sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),new THREE.MeshStandardMaterial({color:'#e4e6de',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;this.scene.add(floor);
  const grid=new THREE.GridHelper(200,200,'#bec4b8','#d7dcd0');grid.position.y=-.015;grid.material.transparent=true;grid.material.opacity=.6;this.scene.add(grid);
  this.group=new THREE.Group();this.scene.add(this.group);this.labels=[];
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.resize.observe(host);
  this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera);this.layoutLabels();});
 }
 clear(){this.group.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});this.group.clear();for(const l of this.labels)l.el.remove();this.labels=[];}
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
  if(state.options.dimensions)for(const s of state.segments){const a=state.nodes.find(n=>n.id===s.a),b=state.nodes.find(n=>n.id===s.b),el=document.createElement('span');el.className='dimension-label';el.textContent=Math.hypot(b.x-a.x,b.y-a.y).toFixed(2)+' m';this.host.append(el);this.labels.push({el,point:new THREE.Vector3((a.x+b.x)/2,2.7,(a.y+b.y)/2)});}
  if(fit)this.fit(state);
 }
 fit(state){const box=new THREE.Box3();for(const n of state.nodes)box.expandByPoint(new THREE.Vector3(n.x,1,n.y));if(box.isEmpty())box.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(8,3,8));const c=box.getCenter(new THREE.Vector3()),size=Math.max(5,box.getSize(new THREE.Vector3()).length());this.controls.target.copy(c);const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight),factor=Math.max(1,1/aspect);this.camera.position.copy(c).add(new THREE.Vector3(size*.85,size*.65,size*.95).multiplyScalar(factor));this.controls.update();}
 layoutLabels(){for(const {el,point} of this.labels){const p=point.clone().project(this.camera);el.style.display=p.z<1?'':'none';el.style.left=(p.x*.5+.5)*this.host.clientWidth+'px';el.style.top=(-p.y*.5+.5)*this.host.clientHeight+'px';}}
 setLight(value){this.sun.position.set(Math.cos(value)*18,12,Math.sin(value)*18);}
}
