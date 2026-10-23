import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {collectPublicFiles}=require('../tools/build-static.cjs');
const {createPreviewServer}=require('../tools/preview-local.cjs');
const reports=resolve(root,'../reports/roof-cleaning-case-local-2026-10-22/test-fixtures');

test('public build accepts self-hosted MP4 and rejects executable files in the video directory',()=>{
  mkdirSync(reports,{recursive:true});
  const fixture=mkdtempSync(resolve(reports,'public-video-'));
  assert.ok(fixture.startsWith(reports+sep));
  try{
    for(const name of collectPublicFiles(root).filter(name=>!name.includes(sep)))writeFileSync(resolve(fixture,name),'public fixture');
    mkdirSync(resolve(fixture,'assets/videos'),{recursive:true});
    writeFileSync(resolve(fixture,'assets/videos/completion.mp4'),Buffer.from('MP4 public fixture'));
    assert.ok(collectPublicFiles(fixture).some(name=>name.replaceAll('\\','/')==='assets/videos/completion.mp4'));
    writeFileSync(resolve(fixture,'assets/videos/private.js'),'must not be published');
    assert.throws(()=>collectPublicFiles(fixture),/Unsupported public asset/);
  }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('loopback preview serves video with its media type and exact bytes',async()=>{
  const directory=resolve(root,'dist/assets/videos');
  mkdirSync(directory,{recursive:true});
  const name=`preview-video-fixture-${process.pid}.mp4`,file=resolve(directory,name);
  const bytes=Buffer.from([0,0,0,24,102,116,121,112,109,112,52,50,0,0,0,0]);
  writeFileSync(file,bytes);
  const server=createPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/assets/videos/${name}`);
    const body=Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'video/mp4');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(body,bytes);
    assert.equal(response.headers.get('accept-ranges'),'bytes');
    assert.equal(response.headers.get('content-length'),String(bytes.length));
    const url=`http://127.0.0.1:${server.address().port}/assets/videos/${name}`;
    for(const [range,start,end] of [['bytes=2-5',2,5],['bytes=4-',4,bytes.length-1],['bytes=-4',bytes.length-4,bytes.length-1]]){
      const partial=await fetch(url,{headers:{Range:range}});
      assert.equal(partial.status,206);
      assert.equal(partial.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);
      assert.equal(partial.headers.get('content-length'),String(end-start+1));
      assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(start,end+1));
    }
    for(const range of ['bytes=999-','bytes=7-2','bytes=0-1,3-4']){
      const invalid=await fetch(url,{headers:{Range:range}});
      assert.equal(invalid.status,416);
      assert.equal(invalid.headers.get('content-range'),`bytes */${bytes.length}`);
    }
    const head=await fetch(url,{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(head.headers.get('content-length'),String(bytes.length));
    assert.equal((await head.arrayBuffer()).byteLength,0);
  }finally{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    rmSync(file);
  }
});
