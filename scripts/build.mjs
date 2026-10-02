import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dest=resolve(root,'dist/site');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
const copied=new Set();
async function copyDependency(file){
 file=resolve(root,file.split('?')[0]);const rel=relative(root,file);
 if(rel.startsWith('..')||copied.has(rel))return;
 copied.add(rel);const output=resolve(dest,rel);await mkdir(dirname(output),{recursive:true});await cp(file,output);
 if(!/\.(js|css)$/.test(file))return;
 const source=await readFile(file,'utf8');
 const imports=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\burl\(\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
 for(const ref of imports)if(ref.startsWith('.'))await copyDependency(resolve(dirname(file),ref));
}
for(const file of ['fence-configurator/index.html','fence-configurator/js/decorio-app.js','fence-configurator/decorio.css','shared-ui/styles/standalone.css','shared-ui/styles/panelControls.css','shared-ui/firebase-app-check.json'])await copyDependency(file);
for(const dir of ['shared-ui/assets','shared-3d/assets'])await cp(resolve(root,dir),resolve(dest,dir),{recursive:true});
await mkdir(resolve(dest,'vendor'),{recursive:true});
await cp(resolve(root,'node_modules/three/build/three.module.js'),resolve(dest,'vendor/three.module.js'));
for(const file of ['controls/OrbitControls.js','lights/RectAreaLightUniformsLib.js','lights/RectAreaLightTexturesLib.js','renderers/CSS2DRenderer.js']){const target=resolve(dest,'vendor/addons',file);await mkdir(dirname(target),{recursive:true});await cp(resolve(root,'node_modules/three/examples/jsm',file),target);}
await cp(resolve(root,'catalog/ontology.json'),resolve(dest,'fence-configurator/ontology.json'));
await writeFile(resolve(dest,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(resolve(dest,'version.json'),JSON.stringify({app:'decorio',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),builtAt:new Date().toISOString()}));
await writeFile(resolve(root,'dist/dependencies.json'),JSON.stringify([...copied].sort(),null,2));
if([...copied].some(p=>/tenantProvisioningAdmin|tenantDashboard|salesDashboard/.test(p)))throw Error('Administration unexpectedly entered the public dependency closure.');
console.log(`Decorio build: ${copied.size} application and shared dependencies, no administration modules.`);
