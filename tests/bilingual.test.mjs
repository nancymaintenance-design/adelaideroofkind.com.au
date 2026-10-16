import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,existsSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const require=createRequire(import.meta.url);
const {chinese,validateTranslations}=require('../tools/bilingual.cjs');
const {createPreviewServer}=require('../tools/preview-local.cjs');
const origin='https://www.adelaideroofkind.com.au';
const read=file=>readFileSync(path.join(dist,file),'utf8');
const canonical=[...readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
const file=route=>route.endsWith('/')?route.slice(1)+'index.html':route.slice(1);
const zroute=route=>route==='/'?'/zh/':'/zh'+route;
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=s=>decode(s.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const schemas=html=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const v=JSON.parse(m[1]);return v['@graph']||[v];});

test('Chinese generation rewrites routes and responsive assets without changing API values or language alternates',()=>{
  const html=`<!doctype html><html lang="en-AU"><head><title>Roof cleaning</title><meta name="description" content="Roof cleaning"><link rel="canonical" href="${origin}/roof-cleaning-adelaide.html"><style>.photo{background:url('assets/images/example.webp')}</style></head><body><nav aria-label="Primary"><a href="contact.html">Contact</a></nav><h1>Roof cleaning</h1><a href="contact.html?area=Norwood#main">Contact</a><a href="https://www.google.com/maps/?api=1&amp;query=Adelaide">Contact</a><img src="assets/images/example.webp" srcset="assets/images/example-360.webp 360w, assets/images/example.webp 720w" alt="Roof cleaning"><div style="background-image:url('assets/images/example.webp')"></div><form action="/api/contact"><select name="service"><option value="Roof cleaning">Roof cleaning</option></select></form><script src="assets/js/main.js"></script></body></html>`;
  const missing=new Set();
  const result=chinese(html,'roof-cleaning-adelaide.html',{'roof cleaning':'屋顶清洗','primary':'主导航','contact':'联系我们'},new Set(['roof-cleaning-adelaide.html','contact.html']),missing);
  assert.equal(missing.size,0);
  assert.match(result,/<html lang="zh-Hans"/);
  assert.match(result,/href="\/zh\/contact.html\?area=Norwood#main"/);
  assert.match(result,/srcset="\/assets\/images\/example-360.webp 360w, \/assets\/images\/example.webp 720w"/);
  assert.match(result,/url\('\/assets\/images\/example.webp'\)/);
  assert.match(result,/action="\/api\/contact"/);
  assert.match(result,/src="\/assets\/js\/main.js"/);
  assert.match(result,/href="https:\/\/www.google.com\/maps\/\?api=1&amp;query=Adelaide"/);
  assert.doesNotMatch(result,/amp;amp/);
  assert.match(result,/<option value="Roof cleaning">屋顶清洗<\/option>/);
  assert.match(result,/hreflang="en-AU" href="https:\/\/www.adelaideroofkind.com.au\/roof-cleaning-adelaide.html"/);
  assert.match(result,/data-language-switch[^>]*href="\/roof-cleaning-adelaide.html">English/);
});

test('new English content and lost locality placeholders are detected instead of silently publishing English in Chinese pages',()=>{
  const html='<html lang="en-AU"><head><title>New untranslated roof scope</title></head><body><h1>Roof repairs in Norwood</h1></body></html>';
  const missing=new Set();
  chinese(html,'test.html',{'roof repairs in {area0}':'{area0}屋顶维修'},new Set(),missing);
  assert.deepEqual([...missing],['New untranslated roof scope']);
  assert.throws(()=>chinese(html,'test.html',{'roof repairs in {area0}':'屋顶维修'},new Set(),new Set()),/lost a locality placeholder/);
});

test('translation failures leave an existing local artifact intact',()=>{
  const reports=path.resolve(root,'../reports/bilingual-2026-10-16');mkdirSync(reports,{recursive:true});
  const fixture=mkdtempSync(path.join(reports,'build-transaction-'));
  try{
    mkdirSync(path.join(fixture,'tools'));mkdirSync(path.join(fixture,'assets'));mkdirSync(path.join(fixture,'dist'));
    writeFileSync(path.join(fixture,'dist','keep.txt'),'previous working preview');
    writeFileSync(path.join(fixture,'tools','build-static.cjs'),readFileSync(path.join(root,'tools','build-static.cjs')));
    writeFileSync(path.join(fixture,'tools','bilingual.cjs'),"module.exports={validateTranslations(){throw Error('Bilingual check failed: missing translation')}};");
    for(const name of ['index.html','404.html','apple-touch-icon.png','favicon-192.png','favicon-32.png','favicon-48.png','favicon-512.png','favicon-ellis-services.png','favicon.ico','feed.json','llms.txt','local-services-feed.json','local-services-rss.xml','robots.txt','rss.xml','site.webmanifest','sitemap.xml'])writeFileSync(path.join(fixture,name),'fixture');
    const run=spawnSync(process.execPath,[path.join(fixture,'tools','build-static.cjs')],{encoding:'utf8'});
    assert.equal(run.status,1);assert.match(run.stderr,/Bilingual check failed/);
    assert.equal(readFileSync(path.join(fixture,'dist','keep.txt'),'utf8'),'previous working preview');
  }finally{rmSync(fixture,{recursive:true,force:true});}
});

test('every canonical page has reciprocal language links, localized metadata and the same sections, photos and form values',()=>{
  assert.equal(validateTranslations().status,'pass');
  for(const route of [...canonical,'/clarity-privacy.html']){
    const en=read(file(route)),zh=read(file(zroute(route)));
    assert.match(zh,/<html lang="zh-Hans"/);
    for(const html of [en,zh])for(const [lang,target] of [['en-AU',route],['zh-Hans',zroute(route)],['x-default',route]])assert.ok(html.includes(`hreflang="${lang}" href="${origin}${target}"`),`${route} ${lang}`);
    assert.ok(zh.includes(`rel="canonical" href="${origin}${zroute(route)}"`),route);
    assert.match(text(zh.match(/<title>([\s\S]*?)<\/title>/)[1]),/[\u3400-\u9fff]/,route);
    assert.match(zh.match(/<meta name="description" content="([^"]*)"/)[1],/[\u3400-\u9fff]/,route);
    for(const tag of ['h1','h2','h3','img','form'])assert.equal([...zh.matchAll(new RegExp(`<${tag}\\b`,'g'))].length,[...en.matchAll(new RegExp(`<${tag}\\b`,'g'))].length,`${route}: ${tag} parity`);
    const values=html=>[...html.matchAll(/<option\b[^>]*value="([^"]*)"/g)].map(m=>m[1]);
    assert.deepEqual(values(zh),values(en),`${route}: submitted service values`);
    const phones=html=>[...html.matchAll(/href="(tel:[^"]+|mailto:[^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(phones(zh),phones(en),`${route}: contact routing`);
    const enNav=en.match(/<nav\b[\s\S]*?<\/nav>/)[0],zhNav=zh.match(/<nav\b[\s\S]*?<\/nav>/)[0];
    assert.match(enNav,/>Contact<\/a>\s*<a[^>]*data-language-switch[^>]*>中文服务<\/a>/,route);
    assert.match(zhNav,/>联系我们<\/a>\s*<a[^>]*data-language-switch[^>]*>English<\/a>/,route);
    for(const node of schemas(zh))if(['WebPage','AboutPage','ContactPage','FAQPage','Article'].includes(node['@type']))assert.equal(node.inLanguage,'zh-Hans',route);
  }
});

test('Chinese FAQ and other structured answers match their complete visible question and answer text',()=>{
  for(const route of canonical){
    const html=read(file(zroute(route)));const faq=schemas(html).find(n=>n['@type']==='FAQPage');if(!faq)continue;
    const visible=[...html.matchAll(/<details\b[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*(?:<div class="faq-response">\s*)?<p[^>]*>([\s\S]*?)<\/p>/g)].map(m=>[text(m[1]).replace(/^\d+\s*/,''),text(m[2])]);
    const prosePairs=[...html.matchAll(/<h3[^>]*>((?:(?!<\/h3>)[\s\S])*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map(m=>[text(m[1]),text(m[2])]);
    const buttonPairs=[...html.matchAll(/<button class="faq-question"[^>]*>([\s\S]*?)<span>[\s\S]*?<div class="faq-answer">\s*<div>\s*<p>([\s\S]*?)<\/p>/g)].map(m=>[text(m[1]),text(m[2])]);
    for(const entry of faq.mainEntity)assert.ok([...visible,...prosePairs,...buttonPairs].some(([q,a])=>q===text(entry.name)&&a===text(entry.acceptedAnswer.text)),`${route}: ${entry.name}`);
    if(route==='/faq.html')assert.equal(faq.mainEntity.length,42);
  }
});

test('bilingual sitemap and Chinese feeds link to generated canonical documents',()=>{
  const urls=[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.equal(urls.length,76);assert.equal(new Set(urls).size,76);
  for(const url of urls){const route=new URL(url).pathname;assert.ok(existsSync(path.join(dist,file(route))),url);assert.ok(read(file(route)).includes(`rel="canonical" href="${url}"`),url);}
  for(const name of ['feed.json','local-services-feed.json']){
    const en=JSON.parse(read(name)),zh=JSON.parse(read('zh/'+name));
    assert.equal(zh.language,'zh-Hans');assert.equal(zh.items.length,en.items.length);
    for(const item of zh.items){assert.match(item.title,/[\u3400-\u9fff]/);assert.match(item.summary,/[\u3400-\u9fff]/);assert.ok(existsSync(path.join(dist,file(new URL(item.url).pathname))));}
  }
});

test('Chinese pages remain readable at mobile and desktop widths with working same-page language switching, menus, search and FAQ jumps',async()=>{
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch();
  try{
    const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    const page=await context.newPage();
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:900});
      for(const route of canonical){
        await page.goto(base+zroute(route),{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hans');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${route} ${width}: no overflow`);
        assert.match(await page.locator('h1').innerText(),/[\u3400-\u9fff]/,route);
        assert.equal(await page.locator('[data-language-switch]').getAttribute('href'),route);
        const untranslated=await page.locator('main').evaluate(main=>{
          const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);const bad=[];
          while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement.closest('script,style'))continue;const t=n.textContent.trim();if(/\b(?:roof|gutter|downpipe|inspection|request|quote|flashing|repair|scope|before|during|after|cleaning)\b/i.test(t)&&!/[\u3400-\u9fff]/.test(t))bad.push(t);}
          return bad;
        });
        assert.deepEqual(untranslated,[],`${route}: English interface/content leftovers`);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/zh/contact.html?area=Norwood&street=The%20Parade#main');
    assert.equal(await page.locator('[name="suburb"]').inputValue(),'Norwood');
    assert.equal(await page.locator('[name="message"]').inputValue(),'房产位置：The Parade，Norwood。');
    assert.equal(await page.locator('[data-language-switch]').getAttribute('href'),'/contact.html?area=Norwood&street=The%20Parade#main');
    await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-label'),'关闭菜单');
    await page.locator('[data-language-switch]').click();await page.waitForURL('**/contact.html?area=Norwood&street=The%20Parade#main');assert.equal(await page.locator('html').getAttribute('lang'),'en-AU');
    await page.goto(base+'/zh/industry-answers.html');await page.locator('#industry-search-input').fill('漏水');
    assert.ok(await page.locator('.article-card:not(.article-card--hidden)').count()>0);
    assert.match(await page.locator('.industry-search__status').innerText(),/找到/);
    await page.locator('#industry-search-input').fill('不存在的查询词');assert.match(await page.locator('.industry-search__status').innerText(),/找到 0 篇/);
    await page.locator('.industry-search__clear').click();assert.equal(await page.locator('.article-card:not(.article-card--hidden)').count(),6);
    await page.goto(base+'/zh/faq.html');const categories=page.locator('.faq-category-nav a');assert.equal(await categories.count(),7);
    await categories.first().click();assert.ok(new URL(page.url()).hash);
    const summary=page.locator('details summary').first();await summary.click();assert.equal(await summary.evaluate(e=>e.parentElement.open),true);
    const post=await fetch(base+'/api/contact',{method:'POST',body:'{}'});assert.equal(post.status,405);
    const missing=await fetch(base+'/zh/missing-preview-page');assert.equal(missing.status,404);assert.match(await missing.text(),/找不到页面/);
    await context.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Chinese form submission labels and status are localized while the existing API receives unchanged service values',async()=>{
  const browser=await chromium.launch();try{
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    const form=read('zh/contact.html').match(/<form\b[^>]*data-contact-form[^>]*>[\s\S]*?<\/form>/)[0];
    await page.setContent('<html lang="zh-Hans"><body>'+form+'</body></html>');
    await page.evaluate(()=>{window.submissions=[];window.fetch=async(url,request)=>{window.submissions.push({url,body:JSON.parse(request.body)});return {ok:true,json:async()=>({message:'Thanks. Your enquiry has been received.'})};};});
    await page.addScriptTag({content:readFileSync(path.join(root,'assets/js/contact-form.js'),'utf8')});
    await page.locator('[name="name"]').fill('测试客户');await page.locator('[name="email"]').fill('preview@example.invalid');await page.locator('[name="phone"]').fill('0400000000');await page.locator('[name="suburb"]').fill('Norwood');await page.locator('[name="service"]').selectOption('Roof leak');await page.locator('[name="message"]').fill('测试咨询，无真实发送。');
    await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('[data-contact-status]').textContent.includes('我们已收到'));
    assert.equal(await page.evaluate(()=>window.submissions[0].url),'/api/contact');assert.equal(await page.evaluate(()=>window.submissions[0].body.service),'Roof leak');
    assert.match(await page.locator('button[type="submit"]').innerText(),/报价/);
  }finally{await browser.close();}
});
