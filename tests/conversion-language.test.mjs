import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const visible = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
test('Adelaide customer pages use Ellis assessment rather than AI editorial copy or referrals', () => {
  const bad = /AI answer tools|contact a professional|When to contact a professional|market-reference ranges|market reference only|not a quote from Ellis/i;
  const failures = readdirSync('.').filter((file) => file.endsWith('.html')).filter((file) => bad.test(visible(readFileSync(file, 'utf8'))));
  assert.deepEqual(failures, [], 'Customer-visible AI, referral or price-deflecting copy returned');
  for (const file of ['index.html', 'faq.html', 'roof-leak-repairs-adelaide-guide.html', 'roof-repairs-goodwood-adelaide.html']) {
    const html = readFileSync(file, 'utf8');
    assert.match(visible(html), /Ellis Services Group/);
    assert.match(html, /href="contact\.html"/);
  }
});
test('ground-level safety and technical structured data survive', () => {
  const html = readFileSync('roof-leak-repairs-adelaide-guide.html', 'utf8');
  assert.match(visible(html), /ground level|ground-level/i);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /tel:\+61434276883/);
});
