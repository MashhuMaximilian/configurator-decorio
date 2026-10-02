import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('nginx limits hosting to Decorio domains and sets noindex',()=>{const s=read('cloudrun/nginx.conf');assert.match(s,/decorio\.360configurator\.ro/);assert.match(s,/return 308 https:\/\/decorio\.360configurator\.ro\$request_uri/);assert.equal((s.match(/X-Robots-Tag/g)||[]).length,3);assert.match(s,/return 421/);assert.doesNotMatch(s,/proxy_pass/);});
test('build uses a file allowlist and includes no unrelated app',()=>{const s=read('scripts/build.mjs');assert.match(s,/const files=/);assert.doesNotMatch(s,/cp\(new URL\(dir/);assert.match(read('fence-configurator/index.html'),/name="robots" content="noindex,nofollow"/);assert.doesNotMatch(read('fence-configurator/js/decorio-app.js'),/applySeo|seoMeta/);});
test('deployment has only manual trigger and dedicated fixed destination',()=>{const s=read('.github/workflows/deploy-decorio.yml');assert.match(s,/workflow_dispatch:/);assert.doesNotMatch(s,/\n  (push|pull_request|schedule):/);assert.match(s,/SERVICE: configurator-decorio/);assert.match(s,/MashhuMaximilian\/configurator-decorio/);assert.doesNotMatch(s,/firebase deploy|configurators-web-test/);});

test('entry redirects stay relative behind Cloud Run TLS termination',()=>{const s=read('cloudrun/nginx.conf');assert.match(s,/absolute_redirect off;/);assert.match(s,/port_in_redirect off;/);});
