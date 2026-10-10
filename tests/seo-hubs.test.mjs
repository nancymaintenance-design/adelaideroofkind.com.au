import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const main = (file) => read(file).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
const textContent = (html) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

function h2Groups(html) {
  return [...html.matchAll(/<section\b[^>]*>[\s\S]*?<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<\/section>/gi)]
    .map(([, heading, content]) => ({ heading: textContent(heading), content }));
}

function localLinks(content) {
  return [...content.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, label]) => ({ href: href.split(/[?#]/)[0], label: textContent(label) }))
    .filter(({ href }) => /^[a-z0-9-]+\.html$/i.test(href) && existsSync(new URL(href, root)));
}

for (const [heading, destinations] of [
  ['Leak investigation', ['roof-leak-repairs-adelaide.html']],
  ['Tile, ridge and flashing repairs', ['roof-repairs-adelaide.html']],
  ['Roof restoration', ['roof-restoration-adelaide.html']],
  ['Drainage and cleaning', ['gutter-downpipe-repairs-adelaide.html', 'gutter-cleaning-adelaide.html']],
]) {
  test(`Services ${heading} group leads to a matching service page`, () => {
    const group = h2Groups(main('services.html')).find((item) => item.heading === heading);
    assert.ok(group, `${heading} H2 section exists`);
    assert.ok(localLinks(group.content).some(({ href, label }) =>
      destinations.includes(href) && label.length >= 18 && /roof|tile|gutter|drainage|leak|restoration/i.test(label)),
    `${heading} has a descriptive link to an existing relevant service page`);
  });
}

for (const [heading, destination] of [
  ['Central', 'roof-repairs-adelaide-cbd.html'],
  ['North/North-East', 'roof-repairs-modbury-adelaide.html'],
  ['Inner East', 'roof-repairs-norwood-adelaide.html'],
  ['Inner South', 'roof-repairs-unley-adelaide.html'],
  ['West/Coastal', 'roof-repairs-henley-beach-adelaide.html'],
]) {
  test(`Service Areas ${heading} group leads to an existing locality page`, () => {
    const group = h2Groups(main('service-areas.html')).find((item) => item.heading === heading);
    assert.ok(group, `${heading} H2 section exists`);
    assert.ok(localLinks(group.content).some(({ href, label }) =>
      href === destination && /^Roof repairs in /.test(label)),
    `${heading} has a descriptive locality link`);
  });
}

test('FAQ topics group the existing questions and retain their FAQPage schema answers', () => {
  const html = read('faq.html');
  const groups = h2Groups(main('faq.html'));
  for (const heading of ['Leaks', 'Roof components', 'Drainage', 'Process and quotes']) {
    const group = groups.find((item) => item.heading === heading);
    assert.ok(group, `${heading} H2 section exists`);
    assert.match(group.content, /class="faq-question"/, `${heading} contains a question`);
  }
  const jsonLd = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(([, json]) => JSON.parse(json)['@graph'] ?? []);
  const faq = jsonLd.find((node) => node['@type'] === 'FAQPage');
  assert.ok(faq, 'FAQPage structured data remains present');
  assert.equal(faq.mainEntity.length, 8);
  const visibleQuestions = [...main('faq.html').matchAll(/<button class="faq-question"[^>]*>([\s\S]*?)<span>/g)]
    .map(([, question]) => textContent(question));
  for (const question of faq.mainEntity) {
    assert.ok(question.acceptedAnswer?.text, `${question.name} keeps its answer`);
    assert.ok(visibleQuestions.includes(question.name), `${question.name} remains visible`);
  }
});
