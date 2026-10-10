import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const origin = 'https://www.adelaideroofkind.com.au';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const structuredData = (html) => [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap(([, json]) => {
    const data = JSON.parse(json);
    return data['@graph'] ?? [data];
  });

test('/index.html permanently redirects to the canonical homepage', () => {
  const { redirects } = JSON.parse(read('vercel.json'));
  assert.ok(redirects.some(({ source, destination, permanent }) =>
    source === '/index.html' && destination === '/' && permanent === true));
});

test('homepage brand and Home navigation links resolve to the canonical path', () => {
  const home = read('index.html');
  const links = [...home.matchAll(/<a\b([^>]*\b(?:class="brand"|aria-current="page")[^>]*)>/g)]
    .map(([, attributes]) => attributes.match(/\bhref="([^"]+)"/)?.[1]);
  assert.equal(links.length, 3);
  assert.deepEqual(links, ['/', '/', '/']);
});

test('homepage WebPage names the roof repairs page while retaining ProfessionalService', () => {
  const nodes = structuredData(read('index.html'));
  assert.equal(nodes.find((node) => node['@type'] === 'WebPage')?.name,
    'Roof Repairs Adelaide | Ellis Services Group');
  assert.ok(nodes.some((node) => node['@type'] === 'ProfessionalService'));
});

for (const [file, label] of [
  ['services.html', 'Services'],
  ['service-areas.html', 'Service Areas'],
]) {
  test(`${label} publishes a two-step breadcrumb to its canonical URL`, () => {
    const html = read(file);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical, `${origin}/${file}`);
    const breadcrumb = structuredData(html).find((node) => node['@type'] === 'BreadcrumbList');
    assert.ok(breadcrumb, `${file} has BreadcrumbList JSON-LD`);
    assert.deepEqual(breadcrumb.itemListElement.map(({ position, item }) => [position, item]), [
      [1, `${origin}/`],
      [2, canonical],
    ]);
  });
}
