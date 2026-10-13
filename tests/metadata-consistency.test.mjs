import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const origin = 'https://www.adelaideroofkind.com.au';
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const graph = (html) => [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap(([, json]) => JSON.parse(json)['@graph'] ?? [JSON.parse(json)]);

const specialistPages = [
  'metal-roof-repairs-adelaide.html',
  'roof-painting-adelaide.html',
  'roof-cleaning-adelaide.html',
  'roof-inspection-adelaide.html',
];

test('homepage main content provides resolving entries to each specialist service', () => {
  const main = read('index.html').match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? '';
  for (const file of specialistPages) {
    assert.match(main, new RegExp(`href="${file}"`), `homepage links to ${file}`);
    assert.ok(existsSync(new URL(file, root)), `${file} resolves to a local page`);
  }
});

test('specialist metadata channels stay concise and synchronized with WebPage schema', () => {
  for (const file of specialistPages) {
    const html = read(file);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1].replaceAll('&amp;', '&');
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1].replaceAll('&amp;', '&');
    const ogDescription = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
    const twitterTitle = html.match(/<meta name="twitter:title" content="([^"]+)"/)?.[1].replaceAll('&amp;', '&');
    const twitterDescription = html.match(/<meta name="twitter:description" content="([^"]+)"/)?.[1];
    const page = graph(html).find((node) => node['@type'] === 'WebPage');

    assert.ok(title.length <= 60, `${file}: title is concise`);
    assert.ok(description.length <= 155, `${file}: description is concise`);
    assert.equal(ogTitle, title, `${file}: Open Graph title matches title`);
    assert.equal(twitterTitle, title, `${file}: Twitter title matches title`);
    assert.equal(ogDescription, description, `${file}: Open Graph description matches`);
    assert.equal(twitterDescription, description, `${file}: Twitter description matches`);
    assert.equal(page.name, title.replace(/ \| Ellis(?: Services Group)?$/, ''), `${file}: WebPage name matches the intent title`);
    assert.equal(page.description, description, `${file}: WebPage description matches metadata`);
  }
  const metalTitle = read('metal-roof-repairs-adelaide.html').match(/<title>(.*?)<\/title>/)?.[1].replaceAll('&amp;', '&');
  assert.match(metalTitle, /Metal.*Colorbond.*Adelaide/i);
});

test('guide Article dates, visible update labels and sitemap lastmod agree', () => {
  const sitemap = read('sitemap.xml');
  const entries = new Map([...sitemap.matchAll(/<url>\s*<loc>https:\/\/www\.adelaideroofkind\.com\.au\/([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
    .map(([, file, date]) => [file, date]));
  for (const file of [
    'roof-leak-repairs-adelaide-guide.html',
    'tile-roof-repairs-adelaide-guide.html',
    'roof-repointing-ridge-capping-adelaide-guide.html',
    'gutter-downpipe-repairs-adelaide-guide.html',
    'roof-restoration-adelaide-guide.html',
  ]) {
    const html = read(file);
    const article = graph(html).find((node) => node['@type'] === 'Article');
    assert.equal(article.dateModified, entries.get(file), `${file}: Article and sitemap dates match`);
    const visible = new Date(`${article.dateModified}T00:00:00Z`).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    assert.match(html, new RegExp(`Content updated ${visible.replaceAll(' ', '\\s+')}`), `${file}: visible update matches`);
    assert.equal(article.datePublished, undefined, `${file}: unknown publication date is not invented`);
  }
});

test('guide Article images and breadcrumb URLs are canonical absolute URLs', () => {
  for (const file of [
    'roof-repairs-adelaide-guide.html',
    'roof-leak-repairs-adelaide-guide.html',
    'tile-roof-repairs-adelaide-guide.html',
    'roof-repointing-ridge-capping-adelaide-guide.html',
    'gutter-downpipe-repairs-adelaide-guide.html',
    'roof-restoration-adelaide-guide.html',
  ]) {
    const html = read(file);
    const nodes = graph(html);
    const article = nodes.find((node) => node['@type'] === 'Article');
    const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    const image = new URL(article.image);
    assert.equal(image.origin, origin, `${file}: Article image uses the canonical origin`);
    assert.ok(existsSync(new URL(image.pathname.slice(1), root)), `${file}: Article image resolves locally`);
    assert.equal(breadcrumb.itemListElement[0].item, `${origin}/`, `${file}: Home breadcrumb uses canonical root`);
    for (const { item } of breadcrumb.itemListElement) assert.equal(new URL(item).origin, origin, `${file}: breadcrumb URL is absolute and canonical`);
  }
});
