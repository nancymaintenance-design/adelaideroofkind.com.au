import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const normalise = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
let assertions = 0;
const check = (callback) => { callback(); assertions += 1; };
const destinations = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(([, url]) => new URL(url).pathname.slice(1) || 'index.html');
check(() => assert.equal(destinations.length, 33, 'Canonical sitemap contains 33 pages'));

// Catch missing/duplicate page headings and empty search-result metadata.
for (const file of destinations) {
  const html = read(file);
  check(() => assert.equal([...html.matchAll(/<h1\b[^>]*>/gi)].length, 1, `${file}: exactly one H1`));
  check(() => assert.ok(normalise(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''), `${file}: non-empty title`));
  check(() => assert.ok(html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1]?.trim(), `${file}: non-empty meta description`));
}

const globals = ['index.html', 'services.html', 'service-areas.html', 'faq.html', 'contact.html'];
// Navigation alone must not satisfy the assessment and trust pathways.
for (const file of globals) {
  const main = read(file).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const text = normalise(main);
  check(() => assert.match(main, /href="(?:contact\.html(?:#[^"]*)?|tel:[^"]+|mailto:[^"]+)"|<form\b/, `${file}: enquiry route in main content`));
  check(() => assert.match(text, /on-site (?:roof )?(?:assessment|appointment)/i, `${file}: on-site assessment process`));
  check(() => assert.match(text, /written quote/i, `${file}: written quote process`));
  check(() => assert.match(text, /ground[ -]level/i, `${file}: safe ground-level enquiry information`));
  check(() => assert.match(main, /href="about\.html(?:#[^"]*)?"/, `${file}: About business-evidence path`));
  check(() => assert.match(main, /href="faq\.html#warranty"|id="warranty"/, `${file}: written-warranty path`));
}
check(() => assert.match(read('about.html'), /href="https:\/\/abr\.business\.gov\.au\/ABN\/View\?id=645821745"/, 'About preserves the current ABR URL'));

const faqHtml = read('faq.html');
const nodes = [...faqHtml.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(([, json]) => { const data = JSON.parse(json); return data['@graph'] ?? [data]; });
const faq = nodes.find((node) => node['@type'] === 'FAQPage');
check(() => assert.ok(faq, 'FAQPage structured data exists'));
const pairs = [...faqHtml.matchAll(/<button class="faq-question"[^>]*>([\s\S]*?)<span>[\s\S]*?<div class="faq-answer">\s*<div>\s*<p>([\s\S]*?)<\/p>/g)]
  .map(([, question, answer]) => [normalise(question), normalise(answer)]);
check(() => assert.equal(pairs.length, faq.mainEntity.length, 'Every schema FAQ has a visible question and answer'));
for (const question of faq.mainEntity) {
  check(() => assert.equal(pairs.find(([name]) => name === normalise(question.name))?.[1], normalise(question.acceptedAnswer.text), `${question.name}: visible and schema answers match`));
}
const warranty = 'Written warranty information sets out coverage, duration and exclusions for the repair work.';
check(() => assert.equal(pairs.find(([name]) => name === 'Do roof repairs come with a warranty?')?.[1], warranty, 'Visible warranty uses the agreed statement'));
check(() => assert.equal(faq.mainEntity.find(({ name }) => name === 'Do roof repairs come with a warranty?')?.acceptedAnswer.text, warranty, 'Schema warranty uses the agreed statement'));
console.log(`PASS: ${assertions} assertions across ${destinations.length} sitemap pages and ${globals.length} global trust/conversion destinations.`);
