import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const main = file => read(file).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
const headings = file => [...main(file).matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => m[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
// Catches the About hero/story reverting to generic home-service promises.
test('About identifies roof repair work, inspection and quote process in semantic headings', () => {
  const hs = headings('about.html');
  assert.match(hs[0], /Ellis.*Roof Repairs.*Adelaide/i);
  assert.ok(hs.some(h => /roof inspections.*written quotes/i.test(h)));
  assert.ok(hs.some(h => /business.*contact details/i.test(h)));
});
// Catches service sections losing the actual components and problem being addressed.
test('service headings describe tile, metal and drainage repair problems', () => {
  assert.ok(headings('roof-repairs-adelaide.html').some(h => /tile.*ridge.*flashing.*valley.*repair checks/i.test(h)));
  assert.match(main('roof-repairs-adelaide.html'), /Cracked, slipped or missing roof tiles/i);
  assert.ok(headings('metal-roof-repairs-adelaide.html').some(h => /metal roof leak repairs.*screws.*washers.*flashing/i.test(h)));
  assert.ok(headings('gutter-cleaning-adelaide.html').some(h => /blocked gutter cleaning.*outlet clearing/i.test(h)));
  assert.ok(headings('roof-cleaning-adelaide.html').some(h => /roof moss.*lichen removal/i.test(h)));
});
// Catches question-style promotional headings leaking outside actual FAQ blocks.
test('non-FAQ main headings use declarative service and advice wording', () => {
  for (const file of readdirSync(root).filter(f => f.endsWith('.html') && !read(f).includes('noindex'))) {
    if (file === 'faq.html') continue;
    const html = main(file)
      .replace(/<section\b[^>]*(?:class="[^"]*faq[^"]*"|id="[^"]*faq[^"]*")[^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<h2\b[^>]*>[^<]*FAQs<\/h2>[\s\S]*?(?=<h2\b|<\/article>)/gi, '');
    for (const m of html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) assert.ok(!m[2].includes('?'), `${file}: ${m[2]}`);
  }
});
// Catches keyword stuffing or loss of the local coverage action behind near-me wording.
test('locality advice headings identify the actual linked service and guide topics', () => {
  const topics = [
    ['adelaide-cbd', /leak/i], ['burnside-adelaide', /restoration/i],
    ['campbelltown-adelaide', /leak.*tile|tile.*leak/i], ['glen-osmond-adelaide', /ridge/i],
    ['glenelg-adelaide', /roof repair/i], ['goodwood-adelaide', /leak/i],
    ['henley-beach-adelaide', /gutter cleaning/i], ['kensington-adelaide', /leak/i],
    ['modbury-adelaide', /gutter cleaning/i], ['north-adelaide', /ridge/i],
    ['norwood-adelaide', /restoration/i], ['port-adelaide', /gutter.*downpipe|drainage/i],
    ['prospect-adelaide', /tile/i], ['salisbury-adelaide', /gutter.*downpipe|drainage/i],
    ['unley-adelaide', /gutter.*downpipe|drainage/i],
  ];
  for (const [area, topic] of topics) {
    const file = `roof-repairs-${area}.html`;
    const section = main(file).match(/<h2\b[^>]*>([^<]+)<\/h2><p><a href="([^"]+)">([^<]+)<\/a> explains the service scope[\s\S]*?For background before you enquire, see <a href="([^"]+)">([^<]+)<\/a>/i);
    assert.ok(section, `${file}: service and guide advice section exists`);
    assert.match(section[1], topic, `${file}: heading names the linked advice topic`);
    assert.match(section[3] + ' ' + section[5], topic, `${file}: service/guide text supports the topic`);
  }
});
test('near-me wording connects the reader to existing coverage and a suburb enquiry', () => {
  const html = main('index.html');
  assert.match(html, /roof repairs near me/i);
  assert.match(html, /Norwood/); assert.match(html, /Unley/); assert.match(html, /Glenelg/);
  assert.match(html, /href="service-areas.html"/);
  assert.match(html, /suburb.*(?:appointment|assessment)/i);
  assert.doesNotMatch(html, /we (?:provide|repair).*near me/i);
});
// Catches a service H1 losing the original city while its title remains locally targeted.
for (const [file, service] of [
  ['roof-leak-repairs-adelaide.html', /roof leak.*repair/i],
  ['roof-restoration-adelaide.html', /roof restoration/i],
]) {
  test(`${file} H1 retains service and Adelaide targeting`, () => {
    const h1 = main(file).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
    assert.match(h1, service, `${file}: H1 identifies the service`);
    assert.match(h1, /\bAdelaide\b/, `${file}: H1 retains the service city`);
  });
}
// Catches local identity, accessible anchors and search identity being removed during copy edits.
test('core pages retain local identity, canonical metadata and semantic anchors', () => {
  for (const file of ['index.html', 'about.html', 'contact.html']) {
    const html = read(file);
    assert.equal((main(file).match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /<link rel="canonical" href="https:\/\/www.adelaideroofkind.com.au\//);
    assert.match(html, /63 Pirie St, Adelaide SA 5000/);
    assert.match(html, /0434 276 883/);
    assert.match(html, /<main id="main">/);
  }
  assert.match(read('roof-leak-repairs-adelaide.html'), /id="roof-leak-project"/);
  assert.match(read('roof-painting-adelaide.html'), /Foothills/);
  assert.match(read('metal-roof-repairs-adelaide.html'), /Magill/);
});
