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
// Commercial contracts catch lost assessment, evidence and next-step paths in
// visible main content; header/footer navigation cannot satisfy these links.
const commercial = [
  ['roof-repairs-adelaide.html', 'tile-roof-repairs-adelaide-guide.html', 'roof-leak-repairs-adelaide.html', /tiles?[\s\S]*ridge[\s\S]*flashing[\s\S]*valley/i],
  ['roof-leak-repairs-adelaide.html', 'roof-leak-repairs-adelaide-guide.html', 'roof-repairs-adelaide.html', /water[\s\S]*(?:entry|path)/i],
  ['roof-restoration-adelaide.html', 'roof-restoration-adelaide-guide.html', 'roof-repairs-adelaide.html', /repair-first/i],
  ['gutter-downpipe-repairs-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html', 'gutter-cleaning-adelaide.html', /joints?[\s\S]*outlets?[\s\S]*downpipes?/i],
  ['gutter-cleaning-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html', 'gutter-downpipe-repairs-adelaide.html', /debris[\s\S]*accessible/i],
];
for (const [file, guide, adjacent, intent] of commercial) {
  const main = read(file).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const text = normalise(main);
  const links = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  check(() => assert.match(text, /project photographs/i, `${file}: visible project evidence label`));
  check(() => assert.match(main, /<h2\b[^>]*>[^<]*(?:assess|scope|condition|includes)/i, `${file}: assessment or scope section`));
  check(() => assert.match(text, /on-site assessment/i, `${file}: confirms scope on site`));
  check(() => assert.match(text, /ground[ -]level/i, `${file}: safe enquiry observations`));
  check(() => assert.match(text, intent, `${file}: relevant commercial intent`));
  for (const target of [guide, adjacent, 'about.html']) {
    check(() => assert.ok(links.some(([, href, label]) => href.split('#')[0] === target && normalise(label).length > 10 && !/^read more/i.test(normalise(label))), `${file}: descriptive main-content path to ${target}`));
    check(() => assert.ok(read(target), `${file}: linked destination ${target} exists`));
  }
  check(() => assert.match(main, /href="(?:contact\.html(?:#[^"]*)?|tel:[^"]+|mailto:[^"]+)"|<form\b/, `${file}: enquiry route in main content`));
  check(() => assert.doesNotMatch(text, /roof[ -]cleaning/i, `${file}: no standalone roof-cleaning service claim`));
}
check(() => assert.match(normalise(read('gutter-cleaning-adelaide.html')), /cleaning and repairs (?:are )?quoted separately/i, 'Gutter cleaning and repair quoting stay distinct'));
console.log(`PASS: ${assertions} assertions across ${destinations.length} sitemap pages, ${globals.length} global trust/conversion destinations and ${commercial.length} commercial service contracts.`);
