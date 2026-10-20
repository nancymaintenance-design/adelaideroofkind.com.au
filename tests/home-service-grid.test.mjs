import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cheerio from 'cheerio';

test('homepage grid ends with nine cards while knowledge remains accessible in navigation', () => {
  for (const prefix of ['', 'zh/']) {
    const doc = cheerio.load(fs.readFileSync(new URL('../dist/' + prefix + 'index.html', import.meta.url), 'utf8'));
    assert.equal(doc('.services-grid .service-card').length, 9, prefix + ' grid must have three complete desktop rows');
    assert.equal(doc('.services-grid .service-card a[href$="industry-answers.html"]').length, 0);
    assert.equal(doc('#primary-navigation a[href$="industry-answers.html"]').length, 1);
    assert.ok(doc('main a[href$="roof-leak-repairs-adelaide-guide.html"]').length > 0, 'existing knowledge content stays accessible');
  }
});
