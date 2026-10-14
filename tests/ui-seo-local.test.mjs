import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const contentTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.ico':'image/x-icon' };
let server;
let base;

before(async () => {
  server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow:'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const target = resolve(root, relative);
      if (!target.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.') || part === 'api')) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(target);
      response.writeHead(200, { 'Content-Type':contentTypes[extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

const pages = ['roof-repairs','roof-leak-repairs','roof-restoration','gutter-downpipe-repairs','roof-cleaning','gutter-cleaning','metal-roof-repairs','roof-painting','roof-inspection'].map(p => `${p}-adelaide.html`).concat('contact.html');
test('service entry links are prominent keyboard-accessible buttons and update boilerplate is absent', async () => {
  const browser=await chromium.launch();
  try {
    for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:945}});
      await page.goto(base+'/services.html',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const links=await page.locator('.services-page-grid .service-card>a').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),background:getComputedStyle(e).backgroundColor,href:e.getAttribute('href'),tab:e.tabIndex})));
      assert.equal(links.length,5,'all five primary service entries remain');
      for(const link of links){
        assert.ok(link.height>=44,`service hit target: ${link.height}`);
        assert.ok(link.font>=14,`service label: ${link.font}`);
        assert.notEqual(link.background,'rgba(0, 0, 0, 0)','primary entry has a filled button surface');
        assert.equal(link.tab,0);assert.match(link.href,/\.html$/);
      }
      const local=await page.locator('.service-card__locations a').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)})));
      for(const link of local){assert.ok(link.height>=44);assert.ok(link.font>=14);}
      await page.locator('.services-page-grid .service-card>a').first().focus();
      assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/roof-leak-repairs-adelaide.html');
      assert.doesNotMatch(await page.locator('main').innerText(),/Content updated\s+\d/i);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.close();
    }
  }finally{await browser.close();}
});
test('all canonical pages use compact content sections without stacked blank padding', async () => {
  const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');
  const paths=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
  const browser=await chromium.launch();
  const failures=[];
  try {
    for(const width of [390,1440,1920]){
      const page=await browser.newPage({viewport:{width,height:945}});
      await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      for(const path of paths){
        await page.goto(base+path,{waitUntil:'load'});
        await page.evaluate(()=>document.fonts.ready);
        const issues=await page.evaluate(()=>{
          const issues=[];
          if(document.documentElement.scrollWidth>innerWidth)issues.push('horizontal overflow');
          for(const e of document.querySelectorAll('main>section:not([class*="hero"])')){
            if(!e.getBoundingClientRect().height)continue;
            const s=getComputedStyle(e);
            if(parseFloat(s.paddingTop)>48||parseFloat(s.paddingBottom)>48)issues.push(`${e.className}: excessive section padding ${s.paddingTop}/${s.paddingBottom}`);
          }
          for(const e of document.querySelectorAll('main .cta-panel')){
            const s=getComputedStyle(e);
            if(parseFloat(s.paddingTop)>48||parseFloat(s.paddingBottom)>48)issues.push('nested CTA padding must not recreate a large empty band');
          }
          return issues;
        });
        failures.push(...issues.map(issue=>`${path} at ${width}px: ${issue}`));
      }
      await page.close();
    }
    assert.deepEqual(failures,[],'Content sections must not reinstate oversized stacked whitespace');
  } finally {await browser.close();}
});
test('homepage quote panel is wider and compact without extending the hero', async () => {
  const browser=await chromium.launch();
  try {
    for(const width of [1440,1920]){
      const page=await browser.newPage({viewport:{width,height:945}});
      await page.goto(base,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.evaluate(()=>({panel:document.querySelector('.home-hero .quote-panel').getBoundingClientRect().toJSON(),labels:[...document.querySelectorAll('.home-hero .mini-form label')].map(el=>el.getBoundingClientRect().toJSON()),hero:document.querySelector('.home-hero').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.ok(layout.panel.width>=440,`${width}: panel must be wider than old360px`);
      assert.ok(layout.panel.height<=600,`${width}: panel height ${layout.panel.height}`);
      assert.ok(layout.hero<=860,`${width}: hero must not grow to fit form`);
      assert.ok(Math.abs(layout.labels[0].top-layout.labels[1].top)<2,'name and email share a row');
      assert.equal(layout.overflow,false);
      await page.close();
    }
  }finally{await browser.close();}
});

test('homepage quote overflow scrolls internally on short screens and stays reachable on mobile', async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:600}});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const state=await page.evaluate(()=>{
      const panel=document.querySelector('.home-hero .quote-panel');
      const before=panel.getBoundingClientRect().toJSON(),rootY=scrollY;
      panel.scrollTop=panel.scrollHeight;
      return {overflow:getComputedStyle(panel).overflowY,scrolled:panel.scrollTop,topBefore:before.top,topAfter:panel.getBoundingClientRect().top,rootY,rootAfter:scrollY,submitBottom:panel.querySelector('button[type=submit]').getBoundingClientRect().bottom,panelBottom:before.bottom,background:getComputedStyle(document.querySelector('.home-hero'),'::before').backgroundAttachment};
    });
    assert.ok(['auto','scroll'].includes(state.overflow),'panel owns overflow');
    assert.ok(state.scrolled>0,'content can scroll');
    assert.equal(state.topBefore,state.topAfter);
    assert.equal(state.rootY,state.rootAfter);
    assert.ok(state.submitBottom<=state.panelBottom,'submit reachable within panel');
    assert.ok(state.panelBottom<=600,'short-screen panel fits below the header within viewport');
    assert.ok(state.background.split(',').every(layer=>layer.trim()==='fixed'));
    await page.setViewportSize({width:390,height:844});
    await page.goto(base,{waitUntil:'networkidle'});
    const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fields:document.querySelectorAll('.home-hero input:not([aria-hidden]),.home-hero select').length}));
    assert.equal(mobile.overflow,false);assert.equal(mobile.fields,5);
    await page.close();
  }finally{await browser.close();}
});

test('local preview refuses form submissions', async () => {
  const response = await fetch(`${base}/api/contact`, { method:'POST' });
  assert.equal(response.status, 405);
});
test('homepage stays stable when font responses arrive late', async () => {
  const browser = await chromium.launch();
  const samples = [];
  try {
    for (const width of [390,1440]) for(let i=0;i<5;i++) {
      const context = await browser.newContext({ viewport:{width,height:width===390?844:1000} });
      const page = await context.newPage();
      await page.route('**/*', async route => {
        if (/\.(woff2?|ttf)(\?|$)|fonts\.googleapis/.test(route.request().url())) await new Promise(r=>setTimeout(r,600));
        await route.continue();
      });
      await page.addInitScript(() => {
        window.shifts=[];
        new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.shifts.push({value:e.value,time:e.startTime,sources:e.sources.map(s=>({node:s.node?.className,previous:s.previousRect,current:s.currentRect}))});}).observe({type:'layout-shift',buffered:true});
      });
      await page.goto(base, {waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(300);
      samples.push(await page.evaluate(width=>({width,cls:window.shifts.reduce((s,e)=>s+e.value,0),shifts:window.shifts,overflow:document.documentElement.scrollWidth>innerWidth,fontStatus:document.fonts.status}),width));
      await context.close();
    }
    if(process.env.UI_EVIDENCE) await writeFile(process.env.UI_EVIDENCE,JSON.stringify(samples,null,2));
    console.log('CLS samples',samples.map(s=>`${s.width}:${s.cls.toFixed(4)}`).join(', '));
    assert.ok(samples.every(s=>s.cls<=.1 && !s.overflow), 'cold loads must have CLS <= 0.1 and no horizontal overflow');
  } finally { await browser.close(); }
});
test('every service and contact offers visible accessible quote and call actions', async () => {
  const browser = await chromium.launch();
  try {
    for(const width of [390,360,768,1440]) for(const path of pages) {
      const page = await browser.newPage({viewport:{width,height:844}});
      await page.goto(`${base}/${path}`,{waitUntil:'networkidle'});
      const result=await page.evaluate(()=>{
        const hero=document.querySelector('.page-hero');
        const actions=[...hero.querySelectorAll('a.button')];
        return {overflow:document.documentElement.scrollWidth>innerWidth,h1:hero.querySelector('h1').getBoundingClientRect().bottom,actions:actions.map(a=>{const r=a.getBoundingClientRect();return {href:a.getAttribute('href'),height:r.height,bottom:r.bottom,visible:r.top>=0&&r.bottom<=innerHeight&&r.width>0,target:a.hash ? !!document.querySelector(a.hash):true};})};
      });
      assert.equal(result.overflow,false,`${path} ${width}: overflow`);
      assert.ok(result.h1<844,`${path}: H1 above fold`);
      assert.ok(result.actions.some(a=>a.href.startsWith('#')&&a.target&&a.visible&&a.height>=44),`${path} ${width}: visible quote link to existing form`);
      assert.ok(result.actions.some(a=>a.href==='tel:0434276883'&&a.visible&&a.height>=44),`${path} ${width}: visible call link`);
      for(const action of await page.locator('.page-hero a.button').all()) {
        await action.focus();
        assert.ok(await action.evaluate(a=>a===document.activeElement&&getComputedStyle(a).outlineStyle!=='none'),'CTA focus visible');
      }
      if(width===390){
        const menu=page.locator('.menu-toggle');
        await menu.focus(); await page.keyboard.press('Enter');
        assert.equal(await menu.getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Enter');
        assert.equal(await menu.getAttribute('aria-expanded'),'false');
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
