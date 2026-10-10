import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBuildInput = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('homepage Instagram icon reserves image layout space in the build input', () => {
  const home = readBuildInput('index.html');
  assert.match(home, /<img src="assets\/images\/instagram-elliservices-small\.png" alt="" aria-hidden="true" width="20" height="20">/);
});
