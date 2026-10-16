import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.existsSync(new URL('../'+file,import.meta.url))?fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'):'';
test('normal production build includes optional Clarity installation after the existing static build',()=>{assert.match(JSON.parse(read('package.json')).scripts.build,/verify-gutter-page\.cjs && node tools\/build-static\.cjs && node clarity-install\.mjs dist clarity-site\.json public/);});
test('configuration targets the genuine shared project, exact production hostname and its static contact exclusion',()=>{const config=JSON.parse(read('clarity-site.json')||'null');assert.equal(config?.projectId,'yy15u4fmm6');assert.equal(config?.hostname,'www.adelaideroofkind.com.au');assert.equal(config?.siteKind,'business');assert.ok(config.excludedPaths.includes('/contact.html'));});
test('production HTML and optional privacy disclosure are emitted with the reviewed assets',()=>{assert.match(read('dist/index.html'),/id="clarity-config"/);assert.match(read('dist/index.html'),/yy15u4fmm6/);assert.match(read('dist/clarity-privacy.html'),/Microsoft Clarity/);assert.match(read('dist/clarity-privacy-zh.html'),/Microsoft Clarity/);assert.equal(read('dist/clarity-consent.js'),read('public/clarity-consent.js'));});
