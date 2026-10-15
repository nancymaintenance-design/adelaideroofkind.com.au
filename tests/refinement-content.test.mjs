import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const categories = require('../assets/js/service-categories.js');
const { createContactHandler } = require('../api/contact.js');
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const files = readdirSync(new URL('../', import.meta.url)).filter(f => f.endsWith('.html'));
const commonForms = files.filter(f => /<select\b[^>]*name="service"/.test(read(f)));
const canonical = [...read('sitemap.xml').matchAll(/<loc>https:\/\/www.adelaideroofkind.com.au\/([^<]*)<\/loc>/g)].map(m => m[1] || 'index.html');
const options = f => [...read(f).match(/<select\b[^>]*name="service"[^>]*>([\s\S]*?)<\/select>/)[1].matchAll(/<option(?: value="([^"]*)")?>([^<]+)<\/option>/g)].map(m => ({value:m[1] ?? m[2],label:m[2]})).filter(o => o.value);

test('all native common selectors contain the nine services and uncertainty option with compatible values', () => {
  assert.equal(categories.length,10);
  assert.ok(commonForms.includes('index.html') && commonForms.includes('contact.html'));
  for (const file of commonForms) {
    const actual = options(file);
    assert.deepEqual(actual.map(o=>o.label), categories.map(c=>c.label), file);
    actual.forEach((o,i) => assert.ok(categories[i].values.includes(o.value), `${file}: ${o.value}`));
  }
  assert.deepEqual(options('index.html'),options('contact.html'));
  assert.equal(options('contact.html')[1].value,'Roof repairs');
});

test('each common-form option survives native FormData and the real frontend submit function without a live POST', async () => {
  const browser = await chromium.launch();
  try {
    for(const file of ['index.html','contact.html','roof-repairs-norwood-adelaide.html']) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.route('**/*',route=>route.abort());
      const form = read(file).match(/<form\b[^>]*data-contact-form[^>]*>[\s\S]*?<\/form>/)[0];
      await page.setContent(form);
      await page.evaluate(() => {
        window.submissions = [];
        window.fetch = async (url,request) => {
          window.submissions.push({url,body:JSON.parse(request.body)});
          return {ok:true,json:async()=>({ok:true,message:'Mock received.'})};
        };
      });
      await page.addScriptTag({content:read('assets/js/contact-form.js')});
      for(const option of options(file)) {
        await page.locator('[name="name"]').fill('Test enquiry');
        await page.locator('[name="email"]').fill('test@example.invalid');
        await page.locator('[name="phone"]').fill('0400000000');
        await page.locator('[name="suburb"]').fill('Test suburb');
        await page.locator('[name="service"]').selectOption(option.value);
        assert.equal(await page.locator('form').evaluate(f=>new FormData(f).get('service')),option.value);
        await page.locator('button[type="submit"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-contact-status]').textContent==='Mock received.');
        const payload = await page.evaluate(()=>window.submissions.at(-1));
        assert.equal(payload.url,'/api/contact');
        assert.equal(payload.body.service,option.value);
        assert.equal(payload.body.website,'');
        assert.equal(payload.body.message,'Homepage quote request.');
      }
      assert.equal(await page.evaluate(()=>window.submissions.length),10);
      await page.close();
    }
  } finally {await browser.close();}
});

test('the mocked production handler accepts every compatible service value and still ignores honeypots', async () => {
  let delivered = [];
  const handler = createContactHandler({env:{RESEND_API_KEY:'test-key',RESEND_FROM_EMAIL:'test@example.invalid'},request:async(url,init)=>{
    assert.equal(url,'https://api.resend.com/emails'); delivered.push(JSON.parse(init.body)); return {ok:true};
  }});
  const invoke = async body => {
    const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',headers:{},body},res);return res;
  };
  const base={name:'Test enquiry',email:'test@example.invalid',phone:'0400000000',suburb:'Test suburb',message:'Mock inspection enquiry.',website:''};
  for(const category of categories) for(const service of category.values) {
    const res=await invoke({...base,service});assert.equal(res.code,201,service);
    assert.ok(delivered.at(-1).text.includes(`Service: ${service}`));
  }
  assert.equal((await invoke({...base,service:'Broken tiles or ridge capping'})).code,201,'the previous homepage value remains accepted by the free-text handler');
  const count=delivered.length;
  assert.equal((await invoke({...base,service:'Roof leak',website:'bot.invalid'})).code,200);
  assert.equal(delivered.length,count);
});

test('all canonical pages have complete consistent social identity and one primary heading', () => {
  assert.equal(canonical.length,37);
  for(const file of canonical) {
    const html=read(file);
    const title=html.match(/<title>([^<]+)<\/title>/)[1], desc=html.match(/<meta name="description" content="([^"]+)"/)[1], url=html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    for(const [kind,key,value] of [['property','og:title',title],['property','og:description',desc],['property','og:url',url],['name','twitter:title',title],['name','twitter:description',desc]]) assert.ok(html.includes(`<meta ${kind}="${key}" content="${value}">`),`${file}: ${key}`);
    const image=html.match(/property="og:image" content="([^"]+)"/)[1];
    assert.ok(html.includes(`<meta name="twitter:image" content="${image}">`),file);
    assert.equal((html.match(/<h1\b/g)||[]).length,1,file);
  }
});

test('each canonical entry dates this refinement once and guide feeds retain valid machine-readable dates', () => {
  const sitemap=read('sitemap.xml');
  assert.equal((sitemap.match(/<lastmod>/g)||[]).length,37);
  assert.match(sitemap.trimEnd(),/<\/urlset>$/);
  for(const entry of sitemap.match(/<url>[\s\S]*?<\/url>/g)) assert.equal((entry.match(/<lastmod>2026-10-15<\/lastmod>/g)||[]).length,1);
  for(const item of JSON.parse(read('feed.json')).items) assert.equal(item.date_modified.slice(0,10),'2026-10-15');
});

test('unverified numeric proof and ambiguous social destination remain absent across aliases', () => {
  for(const file of files) {
    const html=read(file);
    assert.doesNotMatch(html,/10\+|1,000\+?|ten years|30\s*(?:min|minutes)|share\.google\/Z4tImXHToPi9H4LmH/,file);
    assert.doesNotMatch(html,/Content updated\s+\d/i,file);
  }
  assert.match(read('about.html'),/Established in November 2020/);
});

test('canonical locality enquiry instructions live in one section with concise form-panel copy', () => {
  const localities=canonical.filter(file=>read(file).includes('class="section locality-enquiry"'));
  assert.equal(localities.length,15);
  for(const file of localities) {
    const html=read(file);
    assert.doesNotMatch(html,/Before you contact us|class="locality-checklist"/,file);
    assert.equal((html.match(/class="section locality-enquiry"/g)||[]).length,1,file);
    const enquiry=html.match(/<section class="section locality-enquiry">([\s\S]*?)<\/section>/)[1];
    assert.match(enquiry,/ground level; do not climb onto the roof/);
    assert.match(enquiry,/roof material if known/);
    assert.match(enquiry,/access constraints/);
    assert.match(enquiry,/on-site assessment[\s\S]*written quote/);
    const contact=html.match(/<aside class="contact-panel">([\s\S]*?)<\/aside>/)[1];
    assert.match(contact,/Ellis confirms appointment availability/);
    assert.doesNotMatch(contact,/written quote|on-site assessment/);
  }
  assert.match(read('roof-repointing-ridge-capping-adelaide-guide.html'),/<h2>Safe Access for Ridge Capping Inspection<\/h2>/);
  assert.match(read('roof-cleaning-adelaide.html'),/<h3>Roof Inspection and Service Options<\/h3>/);
  assert.match(read('roof-inspection-adelaide.html'),/<h3>Roof Cleaning and Service Options<\/h3>/);
});
