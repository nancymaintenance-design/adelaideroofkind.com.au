import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, lstatSync, mkdirSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { posix } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const builder = resolve(root, 'tools/build-static.cjs');
const reports = resolve(process.env.STATIC_BUILD_TEST_REPORTS || resolve(root, '../reports/site-refinement-2026-10-15'));
const resources = ['apple-touch-icon.png','favicon-192.png','favicon-32.png','favicon-48.png','favicon-512.png','favicon-ellis-services.png','favicon.ico','feed.json','llms.txt','local-services-feed.json','local-services-rss.xml','robots.txt','rss.xml','site.webmanifest','sitemap.xml'];
const files = directory => readdirSync(directory).sort().flatMap(name => {
  const target = resolve(directory, name);
  return lstatSync(target).isDirectory() ? files(target) : [target];
});
const snapshot = () => files(dist).map(file => [relative(dist,file).replaceAll('\\','/'),createHash('sha256').update(readFileSync(file)).digest('hex')]);
const build = () => {
  const result = spawnSync(process.execPath, [builder], { cwd:root, encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

// Catches root copying/ZIP restoration exposing private files or losing current pages.
test('source build emits only current public files, removes stale output and rebuilds identically', () => {
  assert.ok(existsSync(builder), 'source-only builder must exist');
  build();
  const html = readdirSync(root).filter(file => file.endsWith('.html')).sort();
  assert.equal(html.length, 51, '50 existing pages plus branded 404');
  const expected = [...html, ...resources, ...files(resolve(root,'assets')).map(file => relative(root,file).replaceAll('\\','/'))].sort();
  assert.deepEqual(snapshot().map(([file])=>file), expected);
  for (const file of expected) assert.deepEqual(readFileSync(resolve(dist,file)), readFileSync(resolve(root,file)), `${file} is current source`);
  for (const file of ['api/contact.js','package.json','package-lock.json','vercel.json','ellis-services-group-site.zip','.git/config','tests/static-build.test.mjs','tools/build-static.cjs']) assert.equal(existsSync(resolve(dist,file)), false, file);
  assert.ok(existsSync(resolve(root,'api/contact.js')), 'native function remains in source');
  assert.ok(existsSync(resolve(root,'ellis-services-group-site.zip')), 'recovery archive remains in source');
  const first = snapshot();
  writeFileSync(resolve(dist,'stale-generated.txt'), 'must be removed');
  build();
  assert.deepEqual(snapshot(), first, 'identical source produces identical public output');
  const sitemap = readFileSync(resolve(dist,'sitemap.xml'),'utf8');
  assert.doesNotMatch(sitemap, /404\.html/);
  for (const [,url] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) assert.ok(existsSync(resolve(dist,new URL(url).pathname.slice(1) || 'index.html')), url);
});

// Catches deleting outside dist or following a junction/symlink into private material.
test('builder rejects outside targets and symlinks before cleaning anything', () => {
  assert.ok(existsSync(builder), 'source-only builder must exist');
  const { validateBuildPaths, collectPublicFiles } = createRequire(import.meta.url)(builder);
  mkdirSync(reports,{recursive:true});
  const fixture = mkdtempSync(resolve(reports,'build-safety-'));
  const source = resolve(fixture,'source');
  const outside = resolve(fixture,'outside');
  mkdirSync(source); mkdirSync(outside);
  writeFileSync(resolve(outside,'keep.txt'),'untouched');
  try {
    assert.throws(()=>validateBuildPaths(source,outside), /dist|target/i);
    symlinkSync(outside,resolve(source,'dist'),process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(()=>validateBuildPaths(source,resolve(source,'dist')), /symbolic|symlink|real path/i);
    assert.equal(readFileSync(resolve(outside,'keep.txt'),'utf8'),'untouched');
    rmSync(resolve(source,'dist'));
    mkdirSync(resolve(source,'assets'));
    symlinkSync(outside,resolve(source,'assets','unexpected'),process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(()=>collectPublicFiles(source), /symbolic|symlink/i);
  } finally { rmSync(fixture,{recursive:true,force:true}); }
});

// Catches missing CSS/font/image references and relative 404 paths failing at nested URLs.
test('safety fixtures work when the reports parent is absent in a fresh checkout', () => {
  mkdirSync(reports,{recursive:true});
  const outer = mkdtempSync(resolve(reports,'fresh-ci-'));
  const missing = resolve(outer,'reports','site-refinement-2026-10-15');
  try {
    assert.equal(existsSync(missing),false);
    const childEnvironment={...process.env,STATIC_BUILD_TEST_REPORTS:missing};
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,['--test','--test-name-pattern=builder rejects outside targets',fileURLToPath(import.meta.url)],{cwd:root,encoding:'utf8',env:childEnvironment});
    assert.equal(result.status,0,result.stderr || result.stdout);
    assert.ok(existsSync(missing),'safety test creates its reports parent');
  } finally { rmSync(outer,{recursive:true,force:true}); }
});

// Windows cannot create case-distinct directories; emulate only the OS path boundary.
// This catches normalizing Linux paths as though they were Windows paths.
test('real-path validation preserves case on Linux and normalizes it only on Windows', () => {
  for (const platform of ['linux','win32']) {
    const filesystem={
      lstatSync(target){if(target.endsWith('/dist'))throw Object.assign(new Error('absent'),{code:'ENOENT'});return {isSymbolicLink:()=>false};},
      realpathSync:()=>'/Case/source',
      statSync:()=>({isDirectory:()=>true}),
      existsSync:()=>false,
    };
    const context={module:{exports:{}},require:name=>name==='node:fs'?filesystem:posix,process:{platform},console};
    runInNewContext(readFileSync(builder,'utf8'),context,{filename:builder});
    const validate=()=>context.module.exports.validateBuildPaths('/case/source','/case/source/dist');
    if(platform==='linux')assert.throws(validate,/Unexpected real path/);
    else assert.doesNotThrow(validate);
  }
});

test('public HTML and CSS references resolve inside the artifact; 404 recovery uses absolute local paths', () => {
  assert.ok(existsSync(builder), 'source-only builder must exist');
  build();
  const origin = 'https://www.adelaideroofkind.com.au';
  function check(reference, file) {
    if (!reference || reference.startsWith('#') || /^(?:data:|mailto:|tel:|javascript:)/i.test(reference)) return;
    const url = new URL(reference.replaceAll('&amp;','&'), origin+'/'+relative(dist,file).replaceAll('\\','/'));
    if (url.origin !== origin) return;
    assert.ok(existsSync(resolve(dist,decodeURIComponent(url.pathname).slice(1)||'index.html')), `${relative(dist,file)} → ${reference}`);
  }
  for (const file of files(dist)) {
    const text = readFileSync(file,'utf8');
    if (extname(file) === '.html') {
      for (const [,ref] of text.matchAll(/(?:src|href)="([^"]+)"/g)) check(ref,file);
      for (const [,set] of text.matchAll(/srcset="([^"]+)"/g)) for (const item of set.split(',')) check(item.trim().split(/\s+/)[0],file);
    }
    if (extname(file) === '.css') for (const [,ref] of text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) check(ref,file);
  }
  const notFound = readFileSync(resolve(dist,'404.html'),'utf8');
  assert.match(notFound, /<h1>Page not found<\/h1>/);
  assert.match(notFound, /<meta name="robots" content="noindex/);
  for (const [,ref] of notFound.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(ref.startsWith('/') || ref.startsWith('#') || /^(?:tel:|mailto:)/.test(ref), ref);
  for (const href of ['/','/services.html','/contact.html']) assert.ok(notFound.includes(`href="${href}"`));
});
