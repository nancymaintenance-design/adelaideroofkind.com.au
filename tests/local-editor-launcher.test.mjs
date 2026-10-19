import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const launcher=require('../tools/editor/launch-local.cjs');
test('desktop startup rebuilds changed English and Chinese inputs and reuses unchanged output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'roof-kind-editor-launch-'));
 try{
  for(const directory of ['tools','tests','content'])await mkdir(join(root,directory));
  await writeFile(join(root,'index.html'),'<h1>Original</h1>');
  await writeFile(join(root,'content/zh.json'),'中文原文');
  await writeFile(join(root,'tests/verify-gutter-page.cjs'),'');
  await writeFile(join(root,'clarity-install.mjs'),'');
  await writeFile(join(root,'tools/build-static.cjs'),`const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html',fs.readFileSync('index.html'));fs.writeFileSync('dist/zh.txt',fs.readFileSync('content/zh.json'));`);
  const stateRoot=join(root,'.local-editor/launcher');
  assert.equal(await launcher.ensurePublicBuild(root,stateRoot),true);
  assert.equal(await launcher.ensurePublicBuild(root,stateRoot),false);
  await writeFile(join(root,'index.html'),'<h1>Revised</h1>');
  assert.equal(await launcher.ensurePublicBuild(root,stateRoot),true);
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),'<h1>Revised</h1>');
  await writeFile(join(root,'content/zh.json'),'修订中文');
  assert.equal(await launcher.ensurePublicBuild(root,stateRoot),true);
  assert.equal(await readFile(join(root,'dist/zh.txt'),'utf8'),'修订中文');
  assert.equal(await launcher.ensurePublicBuild(root,stateRoot),false);
 }finally{await rm(root,{recursive:true,force:true});}
});
