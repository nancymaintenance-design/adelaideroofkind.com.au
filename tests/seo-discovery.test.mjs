import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const origin = 'https://www.adelaideroofkind.com.au';
const read = (file) => readFileSync(new URL(file, root), 'utf8');

test('AI-readable summary identifies the business and current public contact details', () => {
  const summary = read('llms.txt');
  assert.match(summary, /Ellis Services Group/);
  assert.match(summary, /0434 276 883/);
  assert.match(summary, /ellisservicesgroup9@outlook\.com/);
  assert.match(summary, /Updated: 2026-10-10/);
});

test('AI-readable summary links to existing canonical site pages', () => {
  const summary = read('llms.txt');
  const links = [...summary.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(([, href]) => href);
  assert.ok(links.length >= 8, 'lists core services and guides');
  assert.ok(links.includes(`${origin}/`), 'includes canonical homepage');
  for (const href of links) {
    const url = new URL(href);
    assert.equal(url.origin, origin, href);
    assert.equal(url.search, '', href);
    assert.equal(url.hash, '', href);
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    assert.ok(existsSync(new URL(file, root)), `${href} resolves to a repository file`);
    assert.match(read(file), new RegExp(`<link rel="canonical" href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`), href);
  }
});

test('robots preserves open crawling and the sitemap declaration', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/www\.adelaideroofkind\.com\.au\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /^Disallow:/m);
});

test('sitemap dates only the materially revised core pages', () => {
  const sitemap = read('sitemap.xml');
  const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)];
  const dates = new Map(entries.map(([, url, date]) => [url, date]));
  for (const path of ['/', '/services.html', '/service-areas.html', '/faq.html']) {
    assert.equal(dates.get(`${origin}${path}`), '2026-10-10', path);
  }
  for (const [url, date] of dates) {
    if (/\/roof-repairs-(?:adelaide-cbd|north-adelaide|norwood-adelaide)\.html$/.test(url)) {
      assert.equal(date, undefined, `${url} has no new lastmod`);
    }
  }
});
