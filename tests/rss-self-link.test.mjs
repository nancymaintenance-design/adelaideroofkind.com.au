import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import * as cheerio from 'cheerio';
const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
const origin='https://www.adelaideroofkind.com.au';
const atom='http://www.w3.org/2005/Atom';
const read=file=>readFileSync(new URL(file,root),'utf8');
function assertSelf(xml,href){
  const $=cheerio.load(xml,{xmlMode:true});
  assert.equal($('rss').attr('version'),'2.0');
  assert.equal($('rss').attr('xmlns:atom'),atom,'RSS must declare the Atom namespace');
  const self=$('channel').children('atom\\:link[rel="self"]');
  assert.equal(self.length,1,'RSS must have exactly one channel Atom self link');
  assert.equal(self.attr('href'),href);
  assert.equal(self.attr('type'),'application/rss+xml');
  return $;
}
for(const prefix of ['', 'zh/']){
  test((prefix?'Chinese':'English')+' advice RSS advertises its canonical URL once',()=>{
    const $=assertSelf(read('dist/'+prefix+'rss.xml'),origin+'/'+prefix+'rss.xml');
    const feed=JSON.parse(read('dist/'+prefix+'feed.json'));
    assert.equal($('channel > language').text(),prefix?'zh-Hans':'en-au');
    assert.deepEqual($('item > guid').map((_,e)=>$(e).text()).get(),feed.items.map(item=>item.id));
  });
}
test('RSS refresh keeps one self link on repeated generation and leaves the local-services feed unchanged',()=>{
  const {refreshRss}=require('../tools/structured-index.cjs');
  const xml=read('rss.xml'),feed=JSON.parse(read('feed.json'));
  const first=refreshRss(xml,feed,origin+'/rss.xml');
  assertSelf(first,origin+'/rss.xml');
  assert.equal(first,xml,'Generated root RSS must already be synchronized');
  assert.equal(refreshRss(first,feed,origin+'/rss.xml'),first);
  const localXml=read('local-services-rss.xml');
  assert.equal(refreshRss(localXml,JSON.parse(read('local-services-feed.json'))),localXml);
});
