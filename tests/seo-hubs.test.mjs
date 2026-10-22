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
  ['Roof Leak Detection and Repairs', ['roof-leak-repairs-adelaide.html']],
  ['Tile, ridge capping & flashing repairs', ['roof-repairs-adelaide.html']],
  ['Roof Restoration and Repair-first Preparation', ['roof-restoration-adelaide.html']],
  ['Gutter and Downpipe Leak Repairs', ['gutter-downpipe-repairs-adelaide.html']],
  ['Blocked Gutter Cleaning and Outlet Clearing', ['gutter-cleaning-adelaide.html']],
  ['Metal and Colorbond roof repairs', ['metal-roof-repairs-adelaide.html']],
  ['Roof painting and maintenance', ['roof-painting-adelaide.html']],
  ['Roof surface cleaning', ['roof-cleaning-adelaide.html']],
  ['Roof condition inspections', ['roof-inspection-adelaide.html']],
]) {
  test(`Services ${heading} group leads to a matching service page`, () => {
    const cards = [...main('services.html').matchAll(/<article class="service-card">[\s\S]*?<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/article>/g)].map(([, title,content])=>({heading:textContent(title),content}));
    assert.equal(cards.length,9,'one coherent directory contains all nine service cards');
    const group = cards.find((item) => item.heading === heading);
    assert.ok(group, `${heading} service card exists`);
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
  test(`Service Areas ${heading} destination remains in a compact district card`, () => {
    const group = [...main('service-areas.html').matchAll(/<section class="district">([\s\S]*?)<\/section>/g)].map(([,content])=>({content})).find(item=>localLinks(item.content).some(link=>link.href===destination));
    assert.ok(group, `${heading} locality card exists`);
    assert.ok(localLinks(group.content).some(({ href, label }) =>
      href === destination && /^Roof repairs in /.test(label)),
    `${heading} has a descriptive locality link`);
  });
}

test('FAQ topics group the existing questions and retain their FAQPage schema answers', () => {
  const html = read('faq.html');
  const groups = h2Groups(main('faq.html'));
  for (const heading of ['Roof Leaks & Rainwater Entry', 'Tiles, Ridges & Flashing', 'Metal & Colorbond Roofs', 'Roof Cleaning & Moss', 'Gutters, Downpipes & Drainage', 'Roof Maintenance, Painting & Restoration', 'Inspections, Booking & Quotes']) {
    const group = groups.find((item) => item.heading === heading);
    assert.ok(group, `${heading} H2 section exists`);
    assert.match(group.content, /<summary>/, `${heading} contains direct questions`);
  }
  const jsonLd = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(([, json]) => JSON.parse(json)['@graph'] ?? []);
  const faq = jsonLd.find((node) => node['@type'] === 'FAQPage');
  assert.ok(faq, 'FAQPage structured data remains present');
  assert.equal(faq.mainEntity.length, 49);
  const visibleQuestions = [...main('faq.html').matchAll(/<summary>([\s\S]*?)<\/summary>|<button class="faq-question"[^>]*>([\s\S]*?)<span>/g)]
    .map(([, summary, button]) => textContent(summary ?? button));
  for (const question of faq.mainEntity) {
    assert.ok(question.acceptedAnswer?.text, `${question.name} keeps its answer`);
    assert.ok(visibleQuestions.includes(question.name), `${question.name} remains visible`);
  }
});
