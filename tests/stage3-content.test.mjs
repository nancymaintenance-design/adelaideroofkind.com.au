import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html=readFileSync('roof-restoration-adelaide-guide.html','utf8');
// A removed material decision or scope module must fail this page contract.
test('restoration guide separates material, finish, defect repairs and quote scope',()=>{
  for(const topic of [/Concrete roof tiles/,/Terracotta roof tiles/,/Metal roofing/,/Finish work and defect repairs serve different purposes/,/Plan repairs before restoration finishes/,/Check what the quote includes and excludes/]) assert.ok(topic.test(html),String(topic));
});
test('restoration guide provides five local HTML destinations and a service backlink',()=>{
  for(const file of ['roof-restoration-adelaide.html','roof-repairs-adelaide.html','tile-roof-repairs-adelaide-guide.html','roof-repointing-ridge-capping-adelaide-guide.html','contact.html']){
    assert.ok(html.includes(`href="${file}"`),file);
    assert.ok(existsSync(file),file);
  }
  assert.ok(readFileSync('roof-restoration-adelaide.html','utf8').includes('href="roof-restoration-adelaide-guide.html"'));
});
test('restoration guide keeps its canonical and company contact identity',()=>{
  assert.ok(html.includes('rel="canonical" href="https://www.adelaideroofkind.com.au/roof-restoration-adelaide-guide.html"'));
  assert.ok(html.includes('0434 276 883'));
  assert.ok(html.includes('ellisservicesgroup9@outlook.com'));
  assert.doesNotMatch(html,/Monier|LYSAGHT|BlueScope/);
});
