import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('nginx limits hosting to Decorio domains and sets noindex',()=>{const s=read('cloudrun/nginx.conf');assert.match(s,/decorio\.360configurator\.ro/);assert.match(s,/return 308 https:\/\/decorio\.360configurator\.ro\$request_uri/);assert.equal((s.match(/X-Robots-Tag/g)||[]).length,3);assert.match(s,/return 421/);assert.doesNotMatch(s,/proxy_pass/);});
test('public build contains the reachable shared runtime and no administration or other app',()=>{execFileSync('node',['scripts/build.mjs'],{cwd:new URL('../',import.meta.url)});const deps=JSON.parse(read('dist/dependencies.json'));assert.ok(deps.includes('shared-ui/src/standaloneShell.js'));assert.ok(deps.includes('shared-3d/src/createSurfaceSystem.js'));assert.ok(deps.includes('fence-configurator/js/ontology.js'));assert.ok(!deps.some(p=>/tenantProvisioningAdmin|tenantDashboard|salesDashboard|roof-configurator/.test(p)));assert.equal(existsSync(new URL('../dist/site/shared-ui/src/tenantProvisioningAdmin.js',import.meta.url)),false);assert.match(read('dist/site/fence-configurator/index.html'),/name="robots" content="noindex,nofollow"/);});
test('deployment has only manual trigger and dedicated fixed destination',()=>{const s=read('.github/workflows/deploy-decorio.yml');assert.match(s,/workflow_dispatch:/);assert.doesNotMatch(s,/\n  (push|pull_request|schedule):/);assert.match(s,/SERVICE: configurator-decorio/);assert.match(s,/MashhuMaximilian\/configurator-decorio/);assert.doesNotMatch(s,/firebase deploy|configurators-web-test/);});

test('entry redirects stay relative behind Cloud Run TLS termination',()=>{const s=read('cloudrun/nginx.conf');assert.match(s,/absolute_redirect off;/);assert.match(s,/port_in_redirect off;/);});
