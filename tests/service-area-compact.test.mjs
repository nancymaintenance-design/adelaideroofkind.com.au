import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cheerio from 'cheerio';
test('area keywords live in the fifteen existing district cards without a duplicate regional section',()=>{
  for(const prefix of ['', 'zh/']){
    const doc=cheerio.load(fs.readFileSync(new URL('../dist/'+prefix+'service-areas.html',import.meta.url),'utf8'));
    assert.equal(doc('main > section').length,2,'hero then existing district directory only');
    assert.equal(doc('.district').length,15);
    assert.equal(doc('.district h3 a').length,15,'every district heading is its descriptive service entry');
    for(const card of doc('.district').toArray()){
      const entry=doc(card).find('h3 a');const url=new URL(entry.attr('href'),'https://www.adelaideroofkind.com.au/'+prefix+'service-areas.html');
      assert.equal(url.search,'');assert.equal(url.hash,'');
      assert.equal(url.pathname.startsWith('/zh/'),Boolean(prefix));
      assert.match(entry.text(),prefix?/屋顶维修/:/Roof repairs in/);
      assert.equal(doc(card).find('.street-list a').length,4,'road prefill links retained');
    }
  }
});
