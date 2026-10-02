import * as THREE from 'three';
/** Visual details live here; estimated sections never enter technical assembly calculations. */
export function installVisualPrimitives(library){
 library.register('decorio.curve',p=>new THREE.TubeGeometry(p.curve,p.steps||32,p.radius||.004,6,false));
 library.register('decorio.sphere',p=>new THREE.SphereGeometry(p.radius,10,8));
 library.register('decorio.sheet',p=>new THREE.ExtrudeGeometry(p.shape,{depth:p.depth,steps:1,bevelEnabled:false,curveSegments:4}));
}
export function buildModelVisual(kit,g,w,h,c,v){
 if(!v)return false;
 const geometry=kit.surface.geometry,material=kit.material(c),box=(x,y,z,bw,bh,bd)=>kit.box(g,x,y,z,Math.max(.001,bw),Math.max(.001,bh),Math.max(.001,bd),c);
 const mesh=(geo,x=0,y=0,z=0)=>{const m=geometry.mesh(geo,material,{uv:true,castShadow:true,receiveShadow:true});m.position.set(x,y,z);g.add(m);return m;};
 const path=(points,r=.006)=>mesh(geometry.create('decorio.curve',{curve:new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2]||0))),radius:r,steps:Math.max(8,points.length*4)}));
 const line=(a,b,width=.018,depth=.02)=>{const d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],0),m=box((a[0]+b[0])/2,(a[1]+b[1])/2,0,width,d.length(),depth);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
 const ring=(x,y,rx,ry)=>path(Array.from({length:33},(_,i)=>[x+Math.cos(i*Math.PI/16)*rx,y+Math.sin(i*Math.PI/16)*ry]),.005);
 const scroll=(x,y,s=.08,flip=1)=>{for(const side of [-1,1])path(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2,r=s*(1-i/30);return [x+side*(s+r*Math.cos(a)),y+flip*r*Math.sin(a)];}),.0035);};
 const heart=(x,y)=>{for(const side of [-1,1])path([[x,y-.12],[x+side*.065,y-.04],[x+side*.09,y+.07],[x+side*.035,y+.09],[x,y+.04]],.004);scroll(x,y-.13,.035);};
 const frame=()=>{box(0,.02,0,w,.04,.04);box(0,h-.02,0,w,.04,.04);box(-w/2+.02,h/2,0,.04,h,.04);box(w/2-.02,h/2,0,.04,h,.04);};
 if(v.type==='framedMesh'){
  frame();const inner=new THREE.Group();inner.position.y=.04;g.add(inner);kit.wires(inner,Math.max(.05,w-.08),Math.max(.05,h-.08),{color:c,meshX:v.meshX,meshY:v.meshY,wire:4},'mesh2d');
  if(v.doubleFrame){for(const x of [-w/2+.1,w/2-.1])box(x,h/2,0,.025,h-.2,.025);for(const y of [.1,h-.1])box(0,y,0,w-.2,.025,.025);}return true;
 }
 if(v.type==='sheet'){
  if(v.frame)frame();
  const sheet=(x,y,bw,bh,perforated=true)=>{
   const shape=new THREE.Shape();shape.moveTo(-bw/2,-bh/2);shape.lineTo(bw/2,-bh/2);shape.lineTo(bw/2,bh/2);shape.lineTo(-bw/2,bh/2);shape.closePath();
   // Explicit holes retain silhouettes and shadows, rather than painting a generic opaque panel.
   if(perforated)for(let px=-bw/2+.024;px<bw/2-.02;px+=.032)for(let py=-bh/2+.024;py<bh/2-.02;py+=.032){const hole=new THREE.Path();hole.absarc(px,py,.007,0,Math.PI*2,true);shape.holes.push(hole);}
   mesh(geometry.create('decorio.sheet',{shape,depth:.003}),x,y,-.0015);
  };
  const iw=Math.max(.05,w-.10),ih=Math.max(.05,h-.10);
  if(v.regions==='central'){sheet(0,h/2,iw*.7,ih);for(const x of [-w*.43,w*.43])box(x,h/2,0,.025,h,.035);}
  else if(v.regions==='vertical-centre'){sheet(0,h/2,iw*.33,ih);for(let y=.04;y<h;y+=.12)for(const side of [-1,1])box(side*w*.335,y,0,w*.33,.07,.035);}
  else if(v.regions==='three-horizontal'||v.regions==='solid-three'){for(let i=0;i<3;i++)sheet(0,h*(i+.5)/3,iw,h/3-.05,v.regions!=='solid-three');}
  else sheet(0,h/2,iw,ih);
  return true;
 }
 if(!['vertical','ornamental'].includes(v.type))return false;
 const bw=v.barWidth||.02,depth=v.barDepth||.02,gap=v.gap||.08,frameInset=v.frame?.04:0;
 if(v.frame)frame();if(v.base)box(0,.025,0,w,.05,.075);
 const iw=Math.max(.01,w-frameInset*2),count=Math.max(1,Math.min(180,Math.floor((iw+gap)/(bw+gap)))),pitch=bw+gap,span=(count-1)*pitch;
 const arch=x=>(v.arch||0)*h*Math.max(0,1-(2*x/w)**2),top=x=>h-((v.arch||0)*h-arch(x));
 let rails=v.rails||[.18,.81];if(v.base)rails=[];if(v.frame)rails=[];
 for(const ratio of rails){if(ratio>.5&&v.arch)path(Array.from({length:33},(_,i)=>{const x=-w/2+i*w/32;return [x,h*(ratio-(v.arch||0))+arch(x)];}),.018);else box(0,h*ratio,-depth*.5,w,.035,.027);}
 if(v.topDouble)path(Array.from({length:33},(_,i)=>{const x=-w/2+i*w/32;return [x,h*(.7-(v.arch||0))+arch(x)];}),.018);
 const band=v.topBand?(v.bandHeight||Math.min(.25,h*.22)):0;
 if(band){const y=h-band;box(0,y,0,w,.025,.025);const cells=Math.max(1,Math.round(w/.38)),cw=(w-.08)/cells;
  for(let i=0;i<cells;i++){const x=-w/2+.04+(i+.5)*cw;if(i)box(x-cw/2,h-band/2,0,.012,band,.02);
   if(v.topBand==='cross'){line([x-cw/2,y],[x+cw/2,h-.04]);line([x+cw/2,y],[x-cw/2,h-.04]);}
   if(v.topBand==='square'){const rx=cw*.24,ry=band*.26;path([[x-rx,y+band*.5-ry],[x+rx,y+band*.5-ry],[x+rx,y+band*.5+ry],[x-rx,y+band*.5+ry],[x-rx,y+band*.5-ry]],.007);line([x-cw/2,y+band/2],[x-rx,y+band/2],.01);line([x+rx,y+band/2],[x+cw/2,y+band/2],.01);}
   if(v.topBand==='greek')path([[x+cw/2,y+band*.8],[x-cw*.3,y+band*.8],[x-cw*.3,y+band*.2],[x+cw*.2,y+band*.2],[x+cw*.2,y+band*.55],[x-cw*.05,y+band*.55],[x-cw*.05,y+band*.4]],.007);
  }
  if(v.topBand==='notch'){path([[-w/2,h-.14],[-w*.17,h-.14],[0,h-.42],[w*.17,h-.14],[w/2,h-.14]],.02);}
 }
 for(let i=0;i<count;i++){
  const x=-span/2+i*pitch,half=v.halfBars&&i%2===1;
  let bh=(half?h*.58:top(x))-(v.finial?.1:0),y0=v.base?.05:frameInset;
  if(v.irregular)bh=h*(.86+.14*((i*7)%11)/10);
  if(band)bh=h-band;
  if(v.medallion&&Math.abs(x)<.15)continue;if(v.centreKnot&&Math.abs(x)<.12)continue;
  if(v.shape==='round'){const bar=mesh(geometry.create('primitive.cylinder',{radius:bw/2,height:Math.max(.01,bh-y0),radialSegments:10}),x,(bh+y0)/2);if(v.irregular)bar.rotation.z=(i%2?1:-1)*.025;}
  else if(v.twist&&i%2===0){const geo=geometry.create('primitive.box',{width:bw,height:Math.max(.01,bh-y0),depth,widthSegments:1,heightSegments:36,depthSegments:1}),a=geo.attributes.position;for(let k=0;k<a.count;k++){const yy=a.getY(k)/(bh-y0),angle=Math.max(0,Math.min(1,(yy+.3)/.6))*Math.PI*5,xx=a.getX(k),zz=a.getZ(k);a.setXYZ(k,xx*Math.cos(angle)-zz*Math.sin(angle),a.getY(k),xx*Math.sin(angle)+zz*Math.cos(angle));}geo.computeVertexNormals();mesh(geo,x,(bh+y0)/2);}
  else {const m=box(x,(bh+y0)/2,0,bw,bh-y0,depth);if(v.shape==='diamond')m.rotation.y=Math.PI/4;}
  if(v.finial){const fy=bh+.045;if(v.finial==='ball')mesh(geometry.create('decorio.sphere',{radius:.022}),x,fy);else mesh(geometry.create('primitive.cylinder',{radiusTop:v.finial==='club'?.016:0,radiusBottom:v.finial==='spear'?.024:.018,height:.09,radialSegments:v.finial==='spear'?4:10}),x,fy);}
  if(v.collars){for(const y of [.3,.72])box(x,h*y,0,.032,.023,.032);}
  if(v.clubMid)mesh(geometry.create('primitive.cylinder',{radiusTop:.014,radiusBottom:.006,height:.12,radialSegments:8}),x,h*.46);
  if(v.baskets&&i%4===0){for(let turn=0;turn<4;turn++)path(Array.from({length:25},(_,j)=>{const t=j/24,angle=t*Math.PI*2+turn*Math.PI/2,r=.028*Math.sin(t*Math.PI);return [x+r*Math.cos(angle),h*.53+(t-.5)*.13,r*Math.sin(angle)];}),.003);}
  if(v.scrollsTop&&(!half))scroll(x,h*.77-(v.arch||0)*h+arch(x),Math.min(.05,pitch*.4));
  if(v.scrollsBottom)scroll(x,h*.2,Math.min(.03,pitch*.3));
  if(v.ringBand&&i<count-1)ring(x+pitch/2,h*.755,pitch*.46,h*.045);
 }
 if(v.hearts)for(let i=0;i<v.hearts;i++)heart((i-(v.hearts-1)/2)*w*.22,h*.58);
 if(v.medallion){ring(0,h*.48,.14,h*.15);scroll(0,h*.48,.055);}
 if(v.centreKnot){for(const side of [-1,1])path([[side*.09,h*.77],[side*.09,h*.57],[-side*.045,h*.48],[side*.09,h*.40],[side*.09,h*.18]],.008);}
 return true;
}
