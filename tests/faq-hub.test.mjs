import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const categories = ['roof-leaks', 'tiles-ridges-flashing', 'metal-colorbond', 'roof-cleaning-moss', 'gutters-downpipes', 'maintenance-restoration', 'inspections-quotes'];
let server, base, browser;
before(async () => {
  server = createServer(async (req, res) => {
    if (!['GET','HEAD'].includes(req.method)) return res.writeHead(405).end();
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + sep)) return res.writeHead(404).end();
    try {
      const data = await readFile(path);
      res.writeHead(200, {'Content-Type': ({'.html':'text/html', '.css':'text/css', '.js':'text/javascript'})[extname(path)] || 'application/octet-stream'}).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await new Promise(r => server.close(r)); });

test('thirteen existing questions retain eleven answers and the two corrected assessment answers', async () => {
  // Eleven frozen answers plus the two expressly corrected assessment answers;
  // no dependency on local Git history in clean clones.
  const baseline = [
    ['How do I know if my roof needs repair or replacement?', 'A defined defect can suit a targeted repair when surrounding materials are sound. Broader defects may suit restoration if the underlying roof supports the work. Extensive deterioration, structural concerns or repeated repair failures need a wider assessment, including possible replacement or specialist investigation. Ellis checks the roof condition before recommending a scope.'],
    ['What are common causes of roof leaks in Adelaide?', 'Common causes include cracked or displaced tiles, deteriorated ridge capping, failed flashing, blocked gutters and downpipes, valleys and storm damage. Water can travel through the roof structure before it appears as a ceiling stain.'],
    ['Can a leaking tiled roof be repaired without replacing the whole roof?', 'A leaking tiled roof may be repaired without full replacement when the water-entry path is identified and surrounding tiles, ridges and junctions are sound. The assessment may lead to tile replacement, ridge or flashing repairs, or drainage clearance. Widespread deterioration or structural concerns need broader assessment before repair, restoration or possible replacement is recommended.'],
    ['What is ridge capping and why does it matter?', 'Ridge capping protects and secures tiles along roof ridges and hips. Cracked or loose capping allows wind-driven rain beneath roof tiles. Repair work covers the existing bedding, pointing and roof condition.'],
    ['Can blocked gutters cause roof leaks?', 'Yes. Blocked gutters or downpipes direct overflow into roof edges, eaves and wall areas. Drainage maintenance works alongside roof-defect repairs.'],
    ['What is included in a roof restoration?', 'Roof restoration can include cleaning, tile and ridge repairs, flashing work and a suitable protective finish. We inspect the roof first and specify the necessary repairs, preparation and finishing system in the written quote.'],
    ['Do roof repairs come with a warranty?', 'Written warranty information sets out coverage, duration and exclusions for the repair work.'],
    ['Which Adelaide areas do you service?', 'We provide roof repairs and maintenance across Adelaide. Contact Ellis with your suburb and roof issue to confirm an on-site appointment.'],
    ['Can condensation look like a roof leak?', 'Dampness can relate to rainwater entry, condensation or another source. The pattern and accessible roof condition need assessment; a ceiling stain alone cannot confirm the cause.'],
    ['Does a roof inspection automatically include a written report?', 'Confirm the inspection fee, accessible areas, photographs and written documentation when booking. A repair assessment and a detailed condition report are not automatically the same scope.'],
    ['Is cleaning beneath gutter guards included?', 'Tell Ellis which guards are fitted. Confirm whether the debris beneath them is accessible and whether removal and refitting are included in the written quote; these steps are not assumed.'],
    ['Is roof painting the same as roof restoration?', 'No. Painting concerns the finish, while a restoration scope can include preparation and identified repairs as well as a suitable coating. Compare the actual work and exclusions in each quote.'],
    ['Can a metal roof leak be fixed by repainting?', 'Painting does not repair a failed lap, damaged fixing or perforated sheet. Ellis assesses the observed defect and surrounding roof condition before defining the repair scope.'],
  ];
  const current = await readFile(resolve(root,'faq.html'),'utf8');
  const schema = h => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find(n => n['@type'] === 'FAQPage').mainEntity;
  const questions = schema(current);
  assert.equal(baseline.length,13);
  for (const [name,text] of baseline) assert.deepEqual(questions.find(n => n.name === name),{'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}});
  const protectedMarkup = `<button class="faq-question" id="warranty" aria-expanded="false">Do roof repairs come with a warranty?<span>+</span>
</button>
<div class="faq-answer">
<div>
<p>Written warranty information sets out coverage, duration and exclusions for the repair work.</p>
</div>
</div>`;
  assert.ok(current.includes(protectedMarkup),'protected entry markup remains unchanged');
});

test('seven category anchors resolve to useful direct answers and matching complete schema', async () => {
  const page = await browser.newPage();
  await page.goto(base + '/faq.html');
  assert.deepEqual(await page.locator('nav[aria-label="FAQ categories"] a').evaluateAll(es => es.map(e => e.hash.slice(1))), categories);
  const visible = [];
  for (const id of categories) {
    const group = page.locator(`#${id}`);
    assert.equal(await group.count(), 1);
    assert.equal(await group.locator('h2').count(), 1);
    const pairs = await group.locator('details, .faq-item').evaluateAll(es => es.map(e => ({name:(e.querySelector('summary') || e.querySelector('button')).textContent.replace(/\+\s*$/, '').trim(), answer:e.querySelector('.faq-response, .faq-answer').textContent.trim()})));
    assert.ok(pairs.length >= 5 && pairs.length <= 7, `${id} has useful coverage`);
    visible.push(...pairs);
  }
  assert.equal(new Set(visible.map(q => q.name)).size, visible.length, 'no duplicate question padding');
  const schema = await page.locator('script[type="application/ld+json"]').evaluateAll(es => es.flatMap(e => JSON.parse(e.textContent)['@graph'] || []).find(e => e['@type'] === 'FAQPage').mainEntity.map(q => ({name:q.name, answer:q.acceptedAnswer.text})));
  assert.deepEqual(schema, visible, 'every displayed answer matches structured data exactly');
  await page.close();
});

test('each category answers an intent, a homeowner scenario and an educational question from the map', async () => {
  // Hand-selected source phrases guard against replacing a topic with generic padding.
  const coverage = [
    ['roof-leaks', ['Who can find the source of a roof leak in Adelaide?', 'The same ceiling stain has returned after a patch. What should I tell Ellis?', 'Can a roof leak show up far from the damaged area?']], // ADR-0173 / 0374 / 0468
    ['tiles-ridges-flashing', ['Can you replace a few broken roof tiles in Adelaide?', 'I can see cracks along the ridge from the ground. What happens next?', 'What is the difference between rebedding and repointing a roof?']], // ADR-0179 / 0385 / 0482
    ['metal-colorbond', ['Who repairs leaking metal roofs in Adelaide?', 'Can sound metal sheets stay when one area needs repair?', 'What parts of a metal roof are checked when tracing a leak?']], // ADR-0199 / 0400 / 0494
    ['roof-cleaning-moss', ['Can I book roof cleaning without committing to restoration or painting?', 'My terracotta roof has moss in shaded areas. Does it need painting too?', 'Why should the roof material be identified before cleaning?']], // ADR-0222 / 0425 / 0517
    ['gutters-downpipes', ['Does gutter cleaning include outlets and taking the debris away?', 'My gutter is clean but still drips from a join. Will another clean fix it?', 'Do gutter guards remove the need for maintenance?']], // ADR-0216 / 0411 / 0514
    ['maintenance-restoration', ['What should a roof painting quote explain?', 'The roof paint is peeling. Should I just apply another coat?', 'Why does coating preparation matter as well as colour?']], // ADR-0238 / 0437 / 0533
    ['inspections-quotes', ['Does the inspection fee include a repair quote?', 'My two-storey home has a narrow side passage. What should I mention?', 'What information should I provide before booking a roof inspection?']], // ADR-0240 / 0447 / 0467
  ];
  const page = await browser.newPage();
  await page.goto(base + '/faq.html');
  for (const [id,names] of coverage) {
    const questions = await page.locator(`#${id} summary`).allTextContents();
    for (const name of names) assert.ok(questions.includes(name), `${id}: ${name}`);
  }
  await page.close();
});

test('existing inbound question target remains reachable and opens with the keyboard', async () => {
  const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(base + '/faq.html#warranty');
  await page.evaluate(() => document.fonts.ready);
  const button = page.locator('#warranty');
  const position = await button.boundingBox();
  const nav = await page.getByRole('navigation',{name:'FAQ categories'}).boundingBox();
  assert.ok(position.y >= nav.y + nav.height - 1);
  await button.focus(); await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-expanded'),'true');
  assert.ok(await page.locator('.faq-item .faq-answer').isVisible());
  await page.close();
});

test('category jumps and keyboard disclosure remain clear below sticky controls at narrow, wide and short sizes', async () => {
  for (const viewport of [{width:390,height:844},{width:1440,height:945},{width:1440,height:600}]) {
    const page = await browser.newPage({viewport,reducedMotion:'reduce'});
    await page.goto(base + '/faq.html');
    await page.evaluate(() => document.fonts.ready);
    const nav = page.getByRole('navigation', {name:'FAQ categories'});
    assert.ok((await nav.boundingBox()).y < viewport.height, 'categories promptly visible');
    for (const id of categories) {
      const link = nav.locator(`a[href="#${id}"]`);
      assert.ok((await link.boundingBox()).height >= 44);
      await link.focus();
      assert.notEqual(await link.evaluate(e => getComputedStyle(e).outlineStyle), 'none');
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => location.hash === '#' + id, id);
      const heading = await page.locator(`#${id} h2`).boundingBox();
      const controls = await nav.boundingBox();
      assert.ok(heading.y >= controls.y + controls.height - 1, `${id}: heading not obscured`);
      assert.ok(heading.y < viewport.height - 40, `${id}: heading visible after jump`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const disclosure = page.locator('#inspections-quotes details').first();
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await disclosure.getAttribute('open'), '');
    const focus = await disclosure.locator('summary').boundingBox();
    const controls = await nav.boundingBox();
    assert.ok(focus.y >= controls.y + controls.height - 1, 'focused question not obscured');
    await page.keyboard.press('Space');
    assert.equal(await disclosure.getAttribute('open'), null);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    if (viewport.width === 390) {
      assert.equal(await nav.evaluate(e => getComputedStyle(e).overflowX), 'auto');
      assert.ok(await nav.evaluate(e => e.scrollWidth > e.clientWidth), 'one scrollable row');
    }
    await page.close();
  }
});

test('direct hash entry and native answers work without JavaScript', async () => {
  const page = await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(base + '/faq.html#roof-cleaning-moss');
  await page.evaluate(() => document.fonts.ready);
  const details = page.locator('#roof-cleaning-moss details').first();
  await details.locator('summary').click();
  assert.equal(await details.getAttribute('open'), '');
  assert.ok(await details.locator('.faq-response').isVisible());
  const heading = await page.locator('#roof-cleaning-moss h2').boundingBox();
  const nav = await page.getByRole('navigation', {name:'FAQ categories'}).boundingBox();
  assert.ok(heading.y >= nav.y + nav.height - 1);
  await page.close();
});

test('guide directory uses full width for single guides and retains search, clear and all destinations', async () => {
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:945}, reducedMotion:'reduce'});
    await page.goto(base + '/industry-answers.html');
    assert.equal(await page.locator('.article-card').count(),6);
    const paths = await page.locator('.article-card a').evaluateAll(es => es.map(e => e.getAttribute('href')).sort());
    assert.deepEqual(paths,['gutter-downpipe-repairs-adelaide-guide.html','roof-leak-repairs-adelaide-guide.html','roof-repairs-adelaide-guide.html','roof-repointing-ridge-capping-adelaide-guide.html','roof-restoration-adelaide-guide.html','tile-roof-repairs-adelaide-guide.html']);
    for (const grid of await page.locator('.article-card-grid').all()) {
      if (await grid.locator('.article-card').count() === 1) {
        assert.ok((await grid.locator('.article-card').boundingBox()).width >= (await grid.boundingBox()).width - 2, 'single guide fills available width');
      }
    }
    for (const link of await page.locator('.article-card .text-link').all()) assert.ok((await link.boundingBox()).height >= 44);
    const input = page.getByRole('searchbox');
    await input.fill('zzzz-no-match');
    assert.equal(await page.locator('.article-card:visible').count(),0);
    assert.match(await page.locator('.industry-search__status').innerText(),/0 articles found/);
    await page.getByRole('button',{name:'Clear article search'}).click();
    assert.equal(await page.locator('.article-card:visible').count(),6);
    assert.equal(await input.inputValue(),'');
    assert.ok(await input.evaluate(e => e === document.activeElement));
    await input.fill('repointing');
    await page.getByRole('button',{name:'Search articles'}).click();
    assert.equal(await page.locator('.article-card:visible').count(),1);
    assert.match(await page.locator('.article-card:visible').innerText(),/Ridge Capping/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.close();
  }
});
