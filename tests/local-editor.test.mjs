import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startEditor} from '../tools/editor/server.mts';
import {pageIds,sourceRoot,publicRoot} from '../tools/editor/manifest.mts';
import {readDraft,saveDraft,listHistory} from '../tools/editor/store.mts';

test('draft store persists, rejects stale revisions, and recovers interrupted history',async()=>{
 const root=await mkdtemp(join(tmpdir(),'handymate-editor-'));
 try{
  const pageId=pageIds[0];
  await assert.rejects(saveDraft(root,{pageId:'../escape',expectedRevision:0,baseHash:'baseline',changes:{}}),{status:400});
  await assert.rejects(saveDraft(root,{pageId,expectedRevision:0,baseHash:'baseline',changes:{title:7}}),{status:400});
  const first=await saveDraft(root,{pageId,expectedRevision:0,baseHash:'baseline',changes:{title:'草稿'}});
  assert.equal((await readDraft(root,pageId)).revision,1);
  await assert.rejects(saveDraft(root,{pageId,expectedRevision:0,baseHash:'baseline',changes:{}}),{status:409});
  await writeFile(join(root,'history',pageId,'2.json'),JSON.stringify({...first,revision:2}));
  const recovered=await saveDraft(root,{pageId,expectedRevision:1,baseHash:'baseline',changes:{title:'恢复'}});
  assert.equal(recovered.revision,3);
  for(let n=0;n<22;n++) await saveDraft(root,{pageId,expectedRevision:3+n,baseHash:'baseline',changes:{}});
  assert.equal((await listHistory(root,pageId)).length,20);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('local API enforces session, input, revision, fact locks and preview boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'handymate-api-'));
 let server=await startEditor({port:0,draftRoot:root});
 try{
  const sourceBefore=await readFile(join(sourceRoot,'content','zh-Hans','01-common.json'));
  const publicBefore=await readFile(join(publicRoot,'index.html'));
  const origin=new URL(server.url).origin;
  let token=(await (await fetch(origin+'/__editor/api/session')).json()).token;
  let headers={'x-editor-token':token,origin,'content-type':'application/json'};
  const pages=await (await fetch(origin+'/__editor/api/pages',{headers})).json();
  assert.equal(pages.length,pageIds.length);
  const path='/__editor/api/draft/'+encodeURIComponent(pageIds[0]);
  const model=await (await fetch(origin+path,{headers})).json();
  const editable=model.fields.find(f=>!f.locked);
  const locked=model.fields.find(f=>f.locked);
  assert.ok(editable);
  const payload={baseHash:model.baseHash,expectedRevision:0,changes:{[editable.id]:'本地编辑测试'}};
  const put=(body,overrides={})=>fetch(origin+path,{method:'PUT',headers:{...headers,...overrides},body:typeof body==='string'?body:JSON.stringify(body)});
  assert.equal((await put(payload,{origin:'https://foreign.example'})).status,403);
  assert.equal((await put(payload,{'content-type':'text/plain'})).status,415);
  assert.equal((await put('null')).status,400);
  assert.equal((await put('{broken')).status,400);
  assert.equal((await put(JSON.stringify({...payload,changes:{[editable.id]:'x'.repeat(1048577)}}))).status,413);
  if(locked)assert.equal((await put({...payload,changes:{[locked.id]:'Changed fact'}})).status,400);
  assert.equal((await put({...payload,changes:{unknown:'x'}})).status,400);
  assert.equal((await put(payload)).status,200);
  assert.equal((await put(payload)).status,409);
  const workflow=await (await fetch(origin+'/__editor/api/workflow/'+encodeURIComponent(pageIds[0]),{headers})).json();
  assert.equal(workflow.state,'needs-translation');
  assert.equal(workflow.changes[0].chineseAfter,'本地编辑测试');
  const history=await (await fetch(origin+'/__editor/api/history/'+encodeURIComponent(pageIds[0]),{headers})).json();
  assert.equal(history.length,1);
  const restore=await fetch(origin+'/__editor/api/restore/'+encodeURIComponent(pageIds[0]),{method:'POST',headers,body:JSON.stringify({historyRevision:1,expectedRevision:1})});
  assert.equal(restore.status,200);assert.equal((await restore.json()).revision,2);
  assert.equal((await fetch(origin+'/api/contact',{method:'POST'})).status,403);
  assert.equal((await fetch(origin+'/assets/%2e%2e%2fpackage.json')).status,404);
  assert.equal((await fetch(origin+'/data/%2e%2e%2fpackage.json')).status,404);
  assert.equal((await fetch(origin+'/package.json')).status,404);
  const preview=await fetch(origin+'/__editor/api/preview/'+encodeURIComponent(pageIds[0]),{headers});
  assert.equal(preview.status,200);assert.match(await preview.text(),/本地编辑测试/);
  assert.equal((await fetch(origin+'/__editor/client.js')).status,200,'direct startup compiles the client on a fresh checkout');
  await server.close();server=await startEditor({port:0,draftRoot:root});
  const nextOrigin=new URL(server.url).origin;
  token=(await (await fetch(nextOrigin+'/__editor/api/session')).json()).token;
  const persisted=await (await fetch(nextOrigin+path,{headers:{'x-editor-token':token}})).json();
  assert.equal(persisted.draft.changes[editable.id],'本地编辑测试');
  assert.deepEqual(await readFile(join(sourceRoot,'content','zh-Hans','01-common.json')),sourceBefore);
  assert.deepEqual(await readFile(join(publicRoot,'index.html')),publicBefore);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
