import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const measurementId = 'G-509FE1XE06';
const packageFiles = execFileSync('tar', ['-tf', 'ellis-services-group-site.zip'], { encoding: 'utf8' }).split(/\r?\n/).filter(file => file.endsWith('.html'));

test('deployment package includes one Adelaide Roof Kind GA4 tag per HTML page', () => {
  for (const file of packageFiles) {
    const html = execFileSync('tar', ['-xOf', 'ellis-services-group-site.zip', file], { encoding: 'utf8' });
    assert.match(html, new RegExp(`https://www\\.googletagmanager\\.com/gtag/js\\?id=${measurementId}`), file);
    assert.equal((html.match(new RegExp(`gtag\\('config', '${measurementId}'\\);`, 'g')) || []).length, 1, file);
  }
});
