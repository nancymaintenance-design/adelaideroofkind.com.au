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
