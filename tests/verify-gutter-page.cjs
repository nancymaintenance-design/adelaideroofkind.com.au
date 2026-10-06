const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'gutter-downpipe-repairs-adelaide.html'), 'utf8');
const required = [
  'Gutter Repairs Adelaide | Downpipe Repairs & Price Guide',
  'What happens when you request a gutter assessment',
  'Overflow or pooling',
  'Water near electrical fittings'
];

const missing = required.filter((value) => !html.includes(value));
if (missing.length) {
  throw new Error(`Gutter page release guard failed: ${missing.join(', ')}`);
}
console.log('Gutter page release guard passed.');