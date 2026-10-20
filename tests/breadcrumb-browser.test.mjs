import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import * as cheerio from 'cheerio';
const require=createRequire(import.meta.url);
const {createPreviewServer}=require('../tools/preview-local.cjs');
const {records,origin}=require('../tools/navigation.cjs');
const directory=path.resolve(import.meta.dirname,'../../reports/breadcrumb-service-paths-2026-10-20');

test('real GET and bilingual browser paths preserve readable pages, wrapping, focus, service access and quote destinations', {timeout:180000},async()=>{
  fs.mkdirSync(path.join(directory,'screenshots'),{recursive:true});
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch();const results=[];
  try{
    // All mapped pages are checked as responses, not merely files or HEAD requests.
    for(const record of records){
      const route=new URL(record.url).pathname;const response=await fetch(base+route);
      const body=await response.text();assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),/text\/html/);
      const doc=cheerio.load(body);
      assert.equal(doc('link[rel="canonical"]').attr('href'),record.url,route+' is not a homepage fallback');
      assert.equal(doc('html').attr('lang'),record.locale);
      assert.ok(doc('main p').toArray().some(p=>doc(p).text().trim().length>20),route+' has readable body content');
      assert.ok(body.includes('<h1>')||body.includes('<h1 '),route);assert.ok(!/captcha|cf-chl-|Just a moment/i.test(body));
      assert.ok(body.includes('hreflang="zh-Hans"'));assert.ok(!/name="robots" content="(?:noindex|none)/.test(body));
    }
    const context=await browser.newContext({reducedMotion:'reduce'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===base)return route.continue();
      if(url.origin===origin){const response=await context.request.get(base+url.pathname+url.search);return route.fulfill({response});}
      return route.abort(); // No analytics, map, model or enquiry request leaves the local test.
    });
    const samples=['/roof-leak-repairs-adelaide.html','/roof-cleaning-adelaide.html','/roof-leak-repairs-adelaide-guide.html','/gutter-downpipe-repairs-adelaide-guide.html','/roof-repairs-norwood-adelaide.html','/services.html','/service-areas.html','/industry-answers.html','/faq.html','/about.html','/contact.html'];
    const page=await context.newPage();
    for(const width of [360,390,768,1440])for(const prefix of ['', '/zh'])for(const route of samples){
      const routePath=prefix+route;await page.setViewportSize({width,height:900});
      await page.goto(base+routePath,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
      const nav=page.locator('[data-breadcrumb]');assert.equal(await nav.count(),1);
      assert.ok(await nav.isVisible());
      const geometry=await page.evaluate(()=>{
        const nav=document.querySelector('[data-breadcrumb]'),h1=document.querySelector('main h1');
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,nav:nav.getBoundingClientRect().toJSON(),h1:h1.getBoundingClientRect().toJSON(),clipped:[...nav.querySelectorAll('a,span')].some(e=>e.getBoundingClientRect().right>innerWidth+1)};
      });
      assert.ok(geometry.scroll<=width+1,routePath+' horizontal overflow at '+width);
      assert.ok(!geometry.clipped);assert.ok(geometry.nav.bottom<=geometry.h1.top+1,'breadcrumb precedes heading');
      const ancestor=nav.locator('a').last();await ancestor.focus();
      assert.equal(await ancestor.evaluate(e=>e===document.activeElement),true);
      const outline=await ancestor.evaluate(e=>getComputedStyle(e).outlineStyle);assert.notEqual(outline,'none');
      assert.ok(await page.locator('main a[href^="tel:"]').count()>0);
      if(route.endsWith('-guide.html')){
        const action=page.locator('.guide-service-entry a.button').first();assert.ok(await action.isVisible());
        const target=await action.getAttribute('href');await action.click();await page.waitForURL(target);
        assert.equal(new URL(page.url()).pathname,new URL(target).pathname);
        assert.equal(await page.locator('main h1').count(),1);
        await page.goto(base+routePath,{waitUntil:'load'});
        const quote=page.locator('.guide-service-entry a[href$="contact.html#quote-form"]');
        await quote.click();await page.waitForURL('**/contact.html#quote-form');
        assert.ok(await page.locator('#quote-form').isVisible());
        assert.equal(await page.locator('form').count()>0,true);
      }
      if(width===390&&['/roof-leak-repairs-adelaide-guide.html','/roof-repairs-norwood-adelaide.html','/roof-leak-repairs-adelaide.html','/faq.html'].includes(route)){
        await page.goto(base+routePath,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
        await page.screenshot({path:path.join(directory,'screenshots',(prefix?'zh':'en')+'-'+route.slice(1,-5)+'-390.png'),fullPage:false});
      }
      results.push({route:routePath,width,passed:true,breadcrumbHeight:geometry.nav.height});
    }
    // Actual ancestor click and language counterpart, rather than href-only assertions.
    await page.goto(base+'/zh/roof-leak-repairs-adelaide-guide.html');
    await page.locator('[data-breadcrumb] a').last().click();await page.waitForURL(origin+'/zh/roof-leak-repairs-adelaide.html');
    assert.match(await page.locator('main h1').innerText(),/漏水/);
    await page.locator('[data-language-switch]').click();await page.waitForURL('**/roof-leak-repairs-adelaide.html');
    assert.equal(new URL(page.url()).pathname,'/roof-leak-repairs-adelaide.html');
    fs.writeFileSync(path.join(directory,'browser-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),rawGetPages:records.length,viewports:[360,390,768,1440],results,network:'loopback only; external requests blocked',submit:'not submitted',analytics:'no live analytics loaded or events claimed'},null,2)+'\n');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
