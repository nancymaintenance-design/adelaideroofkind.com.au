import test from 'node:test';
import assert from 'node:assert/strict';

test('every bilingual page exposes paired persisted-content fields without editing public files',async()=>{
 const module=await import('../tools/editor/content.mts').catch(()=>null);
 assert.ok(module?.editorContent,'TypeScript local editor content adapter missing');
 const {pages}=await import('../tools/editor/manifest.mts');
 assert.equal(pages.length,39);
 for(const page of pages){
  const model=module.editorContent(page.pageId);
  assert.ok(model.fields.length>0,page.pageId);
  assert.ok(model.fields.every(field=>typeof field.value==='string'&&typeof field.publishedValue==='string'),page.pageId);
 }
});

test('preview treats edits as text, preserves whitespace, and removes trackers and enquiry execution',async()=>{
 const module=await import('../tools/editor/content.mts').catch(()=>null);
 assert.ok(module?.renderPreview,'TypeScript local editor preview adapter missing');
 const model=module.editorContent('about.html');
 const field=model.fields.find(field=>field.kind==='text'&&!field.locked);
 const changes={[field.id]:'本地测试 <script>alert(1)</script> & 中文'};
 const draft={pageId:model.pageId,revision:1,baseHash:model.baseHash,changes,updatedAt:new Date().toISOString(),state:'needs-translation'};
 const html=module.renderPreview(model,draft,true,'http://39.0.0.1:4210');
 assert.match(html,/本地测试 &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; 中文/);
 assert.doesNotMatch(html,/<script[^>]+googletagmanager|src="[^\"]*site\.js|<iframe/i);
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/data-editor-field/);
 assert.match(html,/display:inline;color:inherit;font:inherit/,'editor wrappers must not inherit the public site accent-span style');
 assert.throws(()=>module.normalizeDraftChanges(model,{'unknown':'bad'}),/不可编辑/);
 assert.throws(()=>module.checkedChanges(model,{...draft,baseHash:'stale'}),/基线/);
});
