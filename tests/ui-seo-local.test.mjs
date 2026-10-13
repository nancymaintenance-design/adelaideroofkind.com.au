import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/UFTR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:4173';
const pages = ['roof-repairs','roof-leak-repairs','roof-restoration','gutter-downpipe-repairs','roof-cleaning','gutter-cleaning','metal-roof-repairs','roof-painting','roof-inspection'].map(p => `${p}-adelaide.html`).concat('contact.html');
test('homepage stays stable when font responses arrive late', async () => {
  const browser = await chromium.launch({channel:'chrome'});
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
    if(process.env.UI_EVIDENCE) writeFileSync(process.env.UI_EVIDENCE,JSON.stringify(samples,null,2));
    console.log('CLS samples',samples.map(s=>`${s.width}:${s.cls.toFixed(4)}`).join(', '));
    assert.ok(samples.every(s=>s.cls<=.1 && !s.overflow), 'cold loads must have CLS <= 0.1 and no horizontal overflow');
  } finally { await browser.close(); }
});
test('every service and contact offers visible accessible quote and call actions', async () => {
  const browser = await chromium.launch({channel:'chrome'});
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
