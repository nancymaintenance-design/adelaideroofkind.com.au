import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const htmlFiles = readdirSync(root).filter((file) => file.endsWith('.html'));

test('root HTML build inputs have no duplicate or mismatched GA4 tags', () => {
  assert.ok(htmlFiles.length > 0, 'root HTML build inputs exist');
  for (const file of htmlFiles) {
    const html = readFileSync(new URL(file, root), 'utf8');
    const loaders = [...html.matchAll(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/g)]
      .map(([, id]) => id);
    const configs = [...html.matchAll(/gtag\('config', '(G-[A-Z0-9]+)'\);/g)]
      .map(([, id]) => id);
    assert.ok(loaders.length <= 1, `${file} has at most one GA4 loader`);
    assert.deepEqual(configs, loaders, `${file} GA4 config matches its loader`);
  }
});
