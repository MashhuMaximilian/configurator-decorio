import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const dest = new URL('dist/site/', root);
await rm(dest, { recursive:true, force:true });
await mkdir(dest,{recursive:true});
const files=['fence-configurator/index.html','fence-configurator/decorio.css',
 ...['decorio-app','model','viewer','editor','scene'].map(n=>'fence-configurator/js/'+n+'.js'),
 ...['firebaseAuth','firebaseAppCheck','savedConfigurations','shareState','tenantBootstrap','tenantDomains'].map(n=>'shared-ui/src/'+n+'.js'),
 'shared-ui/firebase-app-check.json','shared-ui/src/history/undoManager.js','shared-ui/styles/panelControls.css'];
for(const file of files){const output=new URL(file,dest);await mkdir(new URL('./',output),{recursive:true});await cp(new URL(file,root),output);}
await mkdir(new URL('vendor/',dest),{recursive:true});
await cp(new URL('node_modules/three/build/three.module.js',root),new URL('vendor/three.module.js',dest));
await mkdir(new URL('vendor/addons/controls/',dest),{recursive:true});
for(const file of ['controls/OrbitControls.js','lights/RectAreaLightUniformsLib.js','lights/RectAreaLightTexturesLib.js','renderers/CSS2DRenderer.js']) {
 const target=new URL('vendor/addons/'+file,dest);await mkdir(new URL('./',target),{recursive:true});
 await cp(new URL('node_modules/three/examples/jsm/'+file,root),target);
}
await cp(new URL('catalog/catalog.json',root),new URL('fence-configurator/catalog.json',dest));
await cp(new URL('catalog/coverage.json',root),new URL('fence-configurator/coverage.json',dest));
await writeFile(new URL('robots.txt',dest),'User-agent: *\nDisallow: /\n');
await writeFile(new URL('version.json',dest),JSON.stringify({app:'decorio',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),builtAt:new Date().toISOString()}));
console.log('Decorio build: dist/site (fence + shared UI only)');
