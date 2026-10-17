import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url);
const {createPreviewServer}=require('../tools/preview-local.cjs');

test('English and Chinese service directories have no suburb chips and equal unclipped cards with aligned actions',async()=>{
  const server=createPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();
  try{
    for(const route of ['/services.html','/zh/services.html'])for(const width of [390,900,1440,1920]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      await page.goto(base+route,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.services-page-grid .service-card__locations').count(),0,'no suburb-link blocks');
      const cards=await page.locator('.services-page-grid .service-card').evaluateAll(elements=>elements.map(card=>{
        const rect=card.getBoundingClientRect();
        const action=card.querySelector(':scope > a').getBoundingClientRect();
        const image=card.querySelector('img').getBoundingClientRect();
        return {height:rect.height,width:rect.width,top:rect.top,actionBottom:action.bottom,actionGap:rect.bottom-action.bottom,imageHeight:image.height,overflow:card.scrollHeight>card.clientHeight+1};
      }));
      assert.equal(cards.length,9);
      for(const metric of ['height','width','imageHeight','actionGap']){
        const values=cards.map(card=>card[metric]);
        assert.ok(Math.max(...values)-Math.min(...values)<=1,`${route} ${width}: equal ${metric}: ${values}`);
      }
      assert.ok(cards.every(card=>!card.overflow),'content must not be clipped');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const link=page.locator('.services-page-grid .service-card > a').first();
      await link.focus();
      assert.equal(await page.evaluate(()=>document.activeElement.matches('.service-card > a')),true);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/roof-leak-repairs-adelaide.html');
      await page.close();
    }
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
