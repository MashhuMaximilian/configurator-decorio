import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GeometryLibrary} from '../shared-3d/src/geometry/GeometryLibrary.js';
import {disposeObjectResources} from '../shared-3d/src/geometry/resourceLifecycle.js';
import {installVisualPrimitives} from '../fence-configurator/js/visualGeometry.js';
import {DecorioViewer} from '../fence-configurator/js/viewer.js';
import {defaultProduct} from '../fence-configurator/js/ontology.js';
import {previewAssembly} from '../fence-configurator/js/project.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/ontology.json',import.meta.url)));
test('all distinct model definitions generate finite geometry and release shared resources',()=>{
 const viewer=Object.create(DecorioViewer.prototype);viewer.group=new THREE.Group();viewer.surface={geometry:new GeometryLibrary(THREE)};installVisualPrimitives(viewer.surface.geometry);
 const materials=new Map();viewer.material=(color)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);};
 let count=0;const tested=new Set();
 for(const model of catalog.models.filter(m=>m.visual&&m.parameters.length)){
  const signature=JSON.stringify(model.visual);if(tested.has(signature))continue;tested.add(signature);
  const part=previewAssembly(catalog,defaultProduct(catalog,model.id)).parts[0];viewer.panel(part);
  const bounds=new THREE.Box3().setFromObject(viewer.group);assert.ok(!bounds.isEmpty(),model.name);
  assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),model.name);
  viewer.group.traverse(o=>{const positions=o.geometry?.attributes.position;if(positions)for(const value of positions.array)assert.ok(Number.isFinite(value),model.name);if(o.isInstancedMesh)o.dispose();});
  disposeObjectResources(viewer.group,{materialFilter:()=>true});viewer.group.clear();materials.clear();
  assert.equal(viewer.surface.geometry.geometries.size,0,model.name+' leaked geometry');count++;
 }
 assert.ok(count>80);
});
test('repeated modules share geometry across transforms and rebuilds release it',()=>{
 const viewer=Object.create(DecorioViewer.prototype);viewer.group=new THREE.Group();viewer.materials=new Map();viewer.surface={geometry:new GeometryLibrary(THREE),invalidate(){}};installVisualPrimitives(viewer.surface.geometry);
 viewer.material=function(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color}));return this.materials.get(color);};viewer.updateDimensions=()=>{};viewer.renderer={domElement:{dataset:{}}};
 const selection=defaultProduct(catalog,'panouri-bordurate-vega-b'),part=previewAssembly(catalog,selection).parts[0];
 const parts=Array.from({length:100},(_,i)=>({...part,a:{x:i*3,y:0},b:{x:i*3+2.5,y:0},segmentId:'s'+i}));
 const state={nodes:[],segments:[],options:{dimensions:false}};
 viewer.render({parts},state);const geometries=new Set();viewer.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});assert.equal(geometries.size,1);assert.equal(viewer.group.children.length,100);
 assert.equal(viewer.group.children[99].position.x,298.25);
 viewer.render({parts:[part]},state);assert.equal(viewer.surface.geometry.geometries.size,1);viewer.clear();assert.equal(viewer.surface.geometry.geometries.size,0);assert.equal(viewer.materials.size,0);
});
