import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const readPackageFile = (file) => execFileSync('tar', ['-xOf', 'ellis-services-group-site.zip', file], { encoding: 'utf8' });

test('deployed Instagram icon reserves image layout space', () => {
  const home = readPackageFile('index.html');
  assert.match(home, /<img src="assets\/images\/instagram-elliservices\.png" alt="" aria-hidden="true" width="\d+" height="\d+">/);
});
