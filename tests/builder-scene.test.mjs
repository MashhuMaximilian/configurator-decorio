import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GeometryLibrary} from '../shared-3d/src/geometry/GeometryLibrary.js';
import {disposeObjectResources} from '../shared-3d/src/geometry/resourceLifecycle.js';
import {installVisualPrimitives} from '../fence-configurator/js/visualGeometry.js';
import {BuilderScene} from '../fence-configurator/js/builder-scene.js';
import {emptyProject,addRun,placeGate,resolveProject} from '../fence-configurator/js/builder-engine.js';
import {defaultProduct} from '../fence-configurator/js/ontology.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/ontology.json',import.meta.url)));
function renderer(){const v=Object.create(BuilderScene.prototype);v.group=new THREE.Group();v.overlays=new THREE.Group();v.materials=new Map();v.surface={geometry:new GeometryLibrary(THREE),materials:{create:(_kind,params)=>new THREE.MeshStandardMaterial(params)},invalidate(){}};installVisualPrimitives(v.surface.geometry);v.updateDimensions=()=>{};v.renderer={domElement:{dataset:{}}};return v;}
test('plan footprints and 3D gate identities derive from the same unmodified assembly; resources are released',()=>{
 let s=addRun(emptyProject(catalog),{x:0,y:0},{x:10,y:0},defaultProduct(catalog,'d-94a19ed2e5ef'),catalog);s=placeGate(s,defaultProduct(catalog,'d-65247b2c3b82'),s.segments[0].id,2,catalog);s.options.dimensions=false;const a=resolveProject(s,catalog),snapshot=JSON.stringify(a),v=renderer();
 v.view='2d';v.show(a,s,catalog);assert.equal(v.group.visible,false);const footprints=v.overlays.children.filter(o=>o.isMesh&&!o.userData.nodeId);assert.equal(footprints.length,a.parts.filter(p=>['panel','gate','gap'].includes(p.kind)).length);assert.equal(footprints[0].position.x,2.6);
 v.view='3d';v.show(a,s,catalog,{selected:{type:'gate',id:s.gates[0].id}});assert.equal(v.group.visible,true);const gate=v.group.children.find(g=>g.userData.elementId===s.gates[0].id);assert.ok(gate);assert.equal(gate.position.x,2.6);assert.ok(new THREE.Box3().setFromObject(gate).getSize(new THREE.Vector3()).z>.2);assert.equal(JSON.stringify(a),snapshot);
 v.clear();disposeObjectResources(v.overlays,{materialFilter:()=>true});v.overlays.clear();assert.equal(v.surface.geometry.geometries.size,0);
});
test('a product without reconstructed geometry is rendered as a spatial reservation, not a generic fence',()=>{
 const m=catalog.models.find(m=>m.inScope&&m.kind==='panel'&&m.parameters.length&&m.visual?.status!=='reconstructed');let s=addRun(emptyProject(catalog),{x:0,y:0},{x:m.defaults.width*2,y:0},defaultProduct(catalog,m.id),catalog);s.options.dimensions=false;const a=resolveProject(s,catalog),v=renderer();v.view='3d';v.show(a,s,catalog);assert.equal(v.group.children.filter(o=>o.userData.segmentId).length,0);assert.ok(v.overlays.children.some(o=>o.isLineSegments));assert.ok(a.issues.some(i=>i.code==='visual'));v.clear();disposeObjectResources(v.overlays,{materialFilter:()=>true});assert.equal(v.surface.geometry.geometries.size,0);
});

test('cached panels stay tangent to every quadrant, including clones beyond 90 degrees',()=>{
 for(const angle of [23,67,113,157,203,247,293,337]){
  const rad=angle*Math.PI/180, product=defaultProduct(catalog,'d-94a19ed2e5ef');
  const s=addRun(emptyProject(catalog),{x:0,y:0},{x:Math.cos(rad)*8,y:Math.sin(rad)*8},product,catalog);
  s.options.dimensions=false;const a=resolveProject(s,catalog),v=renderer();v.view='3d';v.show(a,s,catalog);v.group.updateMatrixWorld(true);
  const panels=v.group.children.filter(g=>g.userData.elementId===s.segments[0].id);
  assert.ok(panels.length>=3);
  for(const panel of panels){
   const tangent=new THREE.Vector3(1,0,0).transformDirection(panel.matrixWorld);
   assert.ok(Math.abs(tangent.x-Math.cos(rad))<1e-5 && Math.abs(tangent.z-Math.sin(rad))<1e-5,`angle ${angle}: ${tangent.toArray()}`);
   const start=panel.localToWorld(new THREE.Vector3(-1,0,0)),end=panel.localToWorld(new THREE.Vector3(1,0,0));
   assert.ok(Math.abs((end.x-start.x)*Math.sin(rad)-(end.z-start.z)*Math.cos(rad))<1e-5);
  }
  v.clear();disposeObjectResources(v.overlays,{materialFilter:()=>true});
 }
});
