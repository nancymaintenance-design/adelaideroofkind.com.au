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
// Missing or generic advice links strand readers before the relevant service.
const guides = [
  ['roof-repairs-adelaide-guide.html', 'roof-repairs-adelaide.html'],
  ['roof-leak-repairs-adelaide-guide.html', 'roof-leak-repairs-adelaide.html'],
  ['tile-roof-repairs-adelaide-guide.html', 'roof-repairs-adelaide.html'],
  ['roof-repointing-ridge-capping-adelaide-guide.html', 'roof-repairs-adelaide.html'],
  ['gutter-downpipe-repairs-adelaide-guide.html', 'gutter-downpipe-repairs-adelaide.html'],
  ['roof-restoration-adelaide-guide.html', 'roof-restoration-adelaide.html'],
];
const mainContent = (file) => read(file).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
const descriptivePath = (html, target) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .some(([, href, label]) => href.split('#')[0] === target && normalise(label).length > 10 && !/^(?:read (?:more|article)|click here)/i.test(normalise(label)));
for (const [file, service] of guides) {
  const main = mainContent(file);
  const intro = main.match(/<div class="prose">\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  check(() => assert.equal([...main.matchAll(/<h1\b[^>]*>/gi)].length, 1, `${file}: one guide H1`));
  check(() => assert.ok([...main.matchAll(/<h2\b[^>]*>/gi)].length >= 3, `${file}: at least three guidance sections`));
  check(() => assert.ok(normalise(intro).length > 80 && !normalise(intro).endsWith('?'), `${file}: answer-first introduction before guidance sections`));
  check(() => assert.ok(descriptivePath(main, service), `${file}: descriptive matching commercial path to ${service}`));
  check(() => assert.match(main, /href="(?:contact\.html(?:#[^"]*)?|tel:[^"]+|mailto:[^"]+)"/, `${file}: contact route`));
  check(() => assert.match(normalise(main), /ground[ -]level/i, `${file}: ground-level safety boundary`));
}
const adviceHub = mainContent('industry-answers.html');
for (const target of [...guides.map(([file]) => file), ...commercial.map(([file]) => file)]) {
  check(() => assert.ok(descriptivePath(adviceHub, target), `Industry Answers: descriptive path to ${target}`));
}
check(() => assert.match(adviceHub, /href="contact\.html"/, 'Industry Answers: contact route'));
// Exercise the production substring predicate against real article text so
// suggested searches continue to reveal the relevant guide after copy edits.
const searchExpression = read('assets/js/main.js').match(/const matches = ([^;]+);/)?.[1];
assert.ok(searchExpression, 'Industry Answers search predicate exists');
const searchMatches = new Function('article', 'query', `return ${searchExpression};`);
const adviceCards = [...adviceHub.matchAll(/<article class="article-card">([\s\S]*?)<\/article>/g)]
  .map(([, card]) => ({ textContent: card.replace(/<[^>]*>/g, ''), html: card }));
for (const [query, target] of [
  ['roof leak', 'roof-leak-repairs-adelaide-guide.html'],
  ['tiles', 'tile-roof-repairs-adelaide-guide.html'],
  ['roof leaks', 'roof-leak-repairs-adelaide-guide.html'],
  ['gutters', 'gutter-downpipe-repairs-adelaide-guide.html'],
  ['restoration', 'roof-restoration-adelaide-guide.html'],
]) {
  check(() => assert.ok(adviceCards.some((card) => card.html.includes(`href="${target}"`) && searchMatches(card, query)), `Industry Answers: suggested search "${query}" reveals ${target}`));
}
// A locality reader needs safe enquiry prompts and a relevant next step in
// visible content. Header navigation and links on duplicate pages cannot pass.
const localities = [
  ['roof-repairs-adelaide-cbd.html', 'Adelaide CBD', 'Pirie Street', 'roof-leak-repairs-adelaide.html', 'roof-leak-repairs-adelaide-guide.html'],
  ['roof-repairs-north-adelaide.html', 'North Adelaide', 'O’Connell Street', 'roof-repairs-adelaide.html', 'roof-repointing-ridge-capping-adelaide-guide.html'],
  ['roof-repairs-norwood-adelaide.html', 'Norwood', 'The Parade', 'roof-restoration-adelaide.html', 'roof-restoration-adelaide-guide.html'],
  ['roof-repairs-kensington-adelaide.html', 'Kensington', 'Kensington Road', 'roof-leak-repairs-adelaide.html', 'roof-leak-repairs-adelaide-guide.html'],
  ['roof-repairs-burnside-adelaide.html', 'Burnside', 'Glynburn Road', 'roof-restoration-adelaide.html', 'roof-restoration-adelaide-guide.html'],
  ['roof-repairs-unley-adelaide.html', 'Unley', 'Unley Road', 'gutter-downpipe-repairs-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html'],
  ['roof-repairs-goodwood-adelaide.html', 'Goodwood', 'Goodwood Road', 'roof-leak-repairs-adelaide.html', 'roof-leak-repairs-adelaide-guide.html'],
  ['roof-repairs-glen-osmond-adelaide.html', 'Glen Osmond', 'Glen Osmond Road', 'roof-repairs-adelaide.html', 'roof-repointing-ridge-capping-adelaide-guide.html'],
  ['roof-repairs-prospect-adelaide.html', 'Prospect', 'Prospect Road', 'roof-repairs-adelaide.html', 'tile-roof-repairs-adelaide-guide.html'],
  ['roof-repairs-salisbury-adelaide.html', 'Salisbury', 'Main North Road', 'gutter-downpipe-repairs-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html'],
  ['roof-repairs-modbury-adelaide.html', 'Modbury', 'North East Road', 'gutter-cleaning-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html'],
  ['roof-repairs-campbelltown-adelaide.html', 'Campbelltown', 'Lower North East Road', 'roof-leak-repairs-adelaide.html', 'tile-roof-repairs-adelaide-guide.html'],
  ['roof-repairs-henley-beach-adelaide.html', 'Henley Beach', 'Henley Beach Road', 'gutter-cleaning-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html'],
  ['roof-repairs-glenelg-adelaide.html', 'Glenelg', 'Anzac Highway', 'roof-repairs-adelaide.html', 'roof-repairs-adelaide-guide.html'],
  ['roof-repairs-port-adelaide.html', 'Port Adelaide', 'Port Road', 'gutter-downpipe-repairs-adelaide.html', 'gutter-downpipe-repairs-adelaide-guide.html'],
];
for (const [file, locality, road, service, guide] of localities) {
  const main = mainContent(file);
  const text = normalise(main);
  const enquiry = main.match(/<section\b[^>]*class="[^"]*\blocality-enquiry\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? '';
  const enquiryText = normalise(enquiry);
  check(() => assert.ok(destinations.includes(file), `${file}: named canonical sitemap locality`));
  check(() => assert.equal([...main.matchAll(/<h1\b[^>]*>/gi)].length, 1, `${file}: one locality H1`));
  check(() => assert.ok(text.includes(locality) && text.includes(road), `${file}: locality and existing road retained`));
  check(() => assert.match(text, /on-site (?:roof )?assessment/i, `${file}: on-site assessment language`));
  check(() => assert.match(enquiryText, /ground[ -]level/i, `${file}: ground-level enquiry guidance`));
  check(() => assert.match(enquiryText, /do not climb onto the roof/i, `${file}: no roof-access request to the visitor`));
  check(() => assert.ok(enquiryText.includes(locality) && /road|cross street/i.test(enquiryText), `${file}: locality and road enquiry prompt`));
  check(() => assert.match(enquiryText, /roof material[^.]*if (?:known|you know)/i, `${file}: asks for roof material only if known`));
  check(() => assert.match(enquiryText, /access (?:constraints|restrictions|details)/i, `${file}: access enquiry prompt`));
  check(() => assert.match(enquiryText, /symptom|leak|overflow|tile|ridge|flashing|debris|corrosion/i, `${file}: useful symptom enquiry context`));
  for (const target of [service, guide, 'service-areas.html', 'about.html']) {
    check(() => assert.ok(descriptivePath(enquiry, target), `${file}: descriptive enquiry path to ${target}`));
    check(() => assert.ok(read(target), `${file}: enquiry destination ${target} exists`));
  }
  check(() => assert.match(enquiry, /href="faq\.html#warranty"/, `${file}: visible written-warranty path`));
  check(() => assert.match(enquiry, /href="#contact"|href="contact\.html"|href="tel:[^"]+"|href="mailto:[^"]+"/, `${file}: enquiry contact route`));
  check(() => assert.doesNotMatch(text, /24[ -]hour|free inspection|insurance[ -]approved|guaranteed to stop all leaks|\b\d+(?:\.\d+)?[ -]*(?:year|month|week|day)s?[ -]+(?:written[ -]+)?warrant(?:y|ies)|warrant(?:y|ies)[^.]*\b\d+(?:\.\d+)?[ -]*(?:year|month|week|day)s?\b/i, `${file}: no prohibited availability, credential, outcome or numeric warranty claim`));
}
console.log(`PASS: ${assertions} assertions across ${destinations.length} sitemap pages, ${globals.length} global trust/conversion destinations, ${commercial.length} commercial service contracts, ${guides.length} advice guides and ${localities.length} canonical localities.`);
