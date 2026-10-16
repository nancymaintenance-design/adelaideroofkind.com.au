import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const {chinese}=require('../tools/bilingual.cjs');
const {createPreviewServer}=require('../tools/preview-local.cjs');

test('real validator rejects unreviewed dynamic JS, API, consent and added inline messages; build preserves its prior artifact',()=>{
  const fixture=mkdtempSync(path.join(tmpdir(),'ark-i18n-'));
  try {
    for(const name of ['tools','assets/js','api','clarity-assets','content'])cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
    for(const name of require('../tools/bilingual.cjs').documents().map(doc=>doc.name).filter(name=>name!=='clarity-privacy.html'))cpSync(path.join(root,name),path.join(fixture,name));
    for(const name of require('../tools/build-static.cjs').collectPublicFiles(root).filter(name=>!name.includes(path.sep)&&!name.endsWith('.html')))cpSync(path.join(root,name),path.join(fixture,name));
    const run=(script,...args)=>spawnSync(process.execPath,[path.join(fixture,script),...args],{encoding:'utf8'});
    assert.equal(run('tools/bilingual.cjs','check').status,0);
    for(const [name,english] of [['assets/js/main.js','Search this page for roofing advice.'],['assets/js/contact-form.js','Sending your enquiry…'],['assets/js/locality-contact.js','Property location:'],['api/contact.js','Thanks. Your enquiry has been received.'],['clarity-assets/clarity-consent.js','Your choice about Clarity'],['index.html',null]]) {
      const target=path.join(fixture,name),before=readFileSync(target,'utf8');
      if(english)assert.ok(before.includes(english),name);
      writeFileSync(target,english?before.replace(english,'New unreviewed interface message'):before+'<script>document.title="New unreviewed interface message";</script>');
      const result=run('tools/bilingual.cjs','check');
      assert.notEqual(result.status,0,name);assert.match(result.stderr,/Dynamic bilingual review required/,name);
      if(name==='assets/js/main.js') {
        mkdirSync(path.join(fixture,'dist'));writeFileSync(path.join(fixture,'dist','keep.txt'),'previous preview');
        const build=run('tools/build-static.cjs');assert.notEqual(build.status,0);assert.match(build.stderr,/Dynamic bilingual review required/);
        assert.equal(readFileSync(path.join(fixture,'dist','keep.txt'),'utf8'),'previous preview');
      }
      writeFileSync(target,before);
    }
  } finally {rmSync(fixture,{recursive:true,force:true});}
});

test('Chinese breadcrumb page destinations localize while shared organization and images stay stable',()=>{
  const origin='https://www.adelaideroofkind.com.au';
  const schema={'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:'Services',item:origin+'/services.html'}]},{'@type':'Organization','@id':origin+'/#organization',url:origin+'/',image:origin+'/assets/images/roof.webp'},{'@type':'Article',mainEntityOfPage:origin+'/services.html',image:origin+'/assets/images/roof.webp'}]};
  const html='<html lang="en-AU"><head><script type="application/ld+json">'+JSON.stringify(schema)+'</script></head><body></body></html>';
  const result=chinese(html,'index.html',{home:'首页',services:'服务'},new Set(['index.html','services.html']),new Set());
  const graph=JSON.parse(result.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  assert.deepEqual(graph[0].itemListElement.map(item=>item.item),[origin+'/zh/',origin+'/zh/services.html']);
  assert.equal(graph[1]['@id'],origin+'/#organization');assert.equal(graph[1].url,origin+'/');assert.equal(graph[1].image,origin+'/assets/images/roof.webp');
  assert.equal(graph[2].mainEntityOfPage,origin+'/zh/services.html');assert.equal(graph[2].image,origin+'/assets/images/roof.webp');
});

test('ordinary preview browser blocks remote resources without a route interceptor and replaces maps',async()=>{
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();
  try {
    const response=await fetch(base+'/');const html=await response.text();
    assert.match(response.headers.get('content-security-policy')||'',/frame-src 'none'/);
    assert.doesNotMatch(html,/<iframe\b[^>]*src=["']https?:/i);assert.match(html,/data-preview-frame/);
    const page=await browser.newPage();const outbound=[];
    page.on('request',request=>{if(new URL(request.url()).origin!==base)outbound.push(request.url());});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.locator('[data-preview-frame]').scrollIntoViewIfNeeded();
    assert.deepEqual(outbound,[],'existing preview resources stay local');
    const blocked=await page.evaluate(async()=>{
      window.previewViolations=[];document.addEventListener('securitypolicyviolation',event=>window.previewViolations.push({directive:event.violatedDirective,uri:event.blockedURI,disposition:event.disposition}));
      const image=document.createElement('img');image.src='https://example.invalid/remote.png';document.body.append(image);
      const frame=document.createElement('iframe');frame.src='https://example.invalid/frame';document.body.append(frame);
      const script=document.createElement('script');script.src='https://example.invalid/script.js';document.body.append(script);
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://example.invalid/style.css';document.head.append(css);
      try {await fetch('https://example.invalid/preview-isolation');return false;}catch{return true;}
    });
    assert.equal(blocked,true);
    await page.waitForFunction(()=>window.previewViolations.length>=5);
    const violations=await page.evaluate(()=>window.previewViolations);
    assert.deepEqual(violations.map(event=>event.directive).sort(),['connect-src','frame-src','img-src','script-src-elem','style-src-elem'].sort());
    // Chromium reports attempted resource requests even when CSP prevents their
    // network dispatch. Require the browser to report each as enforced blocking.
    for(const url of outbound)assert.ok(violations.some(event=>event.uri===url&&event.disposition==='enforce'),url);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('unknown successful API text produces Chinese success, never a failure status',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    await page.setContent('<html lang="zh-Hans"><body><form data-contact-form><input name="message" value="Test"><p data-contact-status></p><button type="submit">发送</button></form></body></html>');
    await page.evaluate(()=>{window.fetch=async()=>({ok:true,json:async()=>({message:'Accepted by a newer API version.'})});});
    await page.addScriptTag({content:readFileSync(path.join(root,'assets/js/contact-form.js'),'utf8')});
    await page.locator('button').click();await page.waitForFunction(()=>!document.querySelector('button').disabled);
    assert.match(await page.locator('[data-contact-status]').textContent(),/我们已收到/);
    assert.equal(await page.locator('.form-status--error').count(),0);
  } finally {await browser.close();}
});
