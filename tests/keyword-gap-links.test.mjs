import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Removing a new destination or its matching id must break navigation.
test('service hub links resolve to the new component and scope sections', () => {
  const hub = read('services.html').match(/<main\b[\s\S]*?<\/main>/i)[0];
  for (const target of [
    'roof-repairs-adelaide.html#metal-roof-repairs',
    'roof-repairs-adelaide.html#valley-repairs',
    'roof-repairs-adelaide.html#flashing-repairs',
    'roof-leak-repairs-adelaide.html#inspection-report',
    'gutter-downpipe-repairs-adelaide.html#box-gutters',
    'gutter-cleaning-adelaide.html#cleaning-scope',
    'roof-restoration-adelaide.html#roof-painting',
  ]) {
    assert.ok(hub.includes(`href="${target}"`), `Hub offers ${target}`);
    const [file, id] = target.split('#');
    assert.ok(read(file).includes(`id="${id}"`), `${target} resolves`);
  }
});
test('advice hub reaches the condensation explanation without a new competing URL', () => {
  assert.ok(read('industry-answers.html').includes('href="roof-leak-repairs-adelaide-guide.html#condensation"'));
  assert.ok(read('roof-leak-repairs-adelaide-guide.html').includes('id="condensation"'));
});
test('every new root-page fragment link resolves to a real unique id', () => {
  const sitemap=read('sitemap.xml');
  const files=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>new URL(x[1]).pathname.slice(1)||'index.html');
  for (const file of files) {
    const html=read(file);
    for (const [,href] of html.matchAll(/href="([^"\s]+\.html#[^"\s]+)"/g)) {
      if (/^(https?:|\/\/)/.test(href)) continue;
      const [target,id]=href.split('#');
      assert.equal([...read(target).matchAll(/\bid="([^"]+)"/g)].filter(x=>x[1]===id).length,1,`${file} → ${href}`);
    }
  }
});
