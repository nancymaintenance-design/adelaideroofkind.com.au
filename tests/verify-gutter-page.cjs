const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'gutter-downpipe-repairs-adelaide.html'), 'utf8');
const required = [
  'Gutter and Downpipe Repairs Adelaide',
  'Gutter Fall, Joint and Downpipe Flow Checks',
  'Gutter, Outlet and Downpipe Conditions We Assess',
  'Plan a drainage assessment'
];

const missing = required.filter((value) => !html.includes(value));
if (missing.length) {
  throw new Error(`Gutter page release guard failed: ${missing.join(', ')}`);
}
console.log('Gutter page release guard passed.');
