import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const ld=html=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>JSON.parse(m[1])['@graph']||[JSON.parse(m[1])]);
const strip=html=>html.replace(/\r\n/g,'\n').replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'');

test('schema generation is reproducible and changes only JSON-LD, never visible markup',()=>{
  const { enrichHtml }=require('../tools/structured-index.cjs');
  let count=0;
  for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
    const current=read(file);
    const regenerated=enrichHtml(current,file);
    assert.equal(strip(current),strip(regenerated),file+' visible markup changed');
    assert.equal(enrichHtml(current,file),current,file+' generated schema is stale');
    if(ld(current).some(n=>n['@type']==='WebSite'))count++;
  }
  assert.ok(count>=37);
});

test('canonical pages connect stable company, site, page and service/article entities',()=>{
  for(const file of readdirSync(root).filter(f=>f.endsWith('.html'))){
    const html=read(file),nodes=ld(html);
    if(!nodes.some(n=>n['@type']==='WebSite'))continue;
    const ids=nodes.map(n=>n['@id']).filter(Boolean);
    assert.equal(new Set(ids).size,ids.length,file+' duplicate entities');
    const company=nodes.find(n=>n['@id']?.endsWith('/#organization'));
    assert.ok(company.description,file);
    const page=nodes.find(n=>['WebPage','AboutPage','ContactPage','CollectionPage'].includes(n['@type']));
    assert.ok(page.isPartOf['@id'].endsWith('/#website'),file);
    assert.ok(page.inLanguage==='en-AU',file);
    for(const entity of nodes.filter(n=>['Service','Article'].includes(n['@type']))){
      assert.ok(entity['@id'],file);
      assert.equal(entity.mainEntityOfPage['@id'],page['@id'],file);
      assert.equal(page.mainEntity['@id'],entity['@id'],file);
    }
  }
});

test('bilingual feeds have real content and page-derived topics, service feed covers company plus nine services',()=>{
  const { pageRecord }=require('../tools/structured-index.cjs');
  for(const prefix of ['','zh/'])for(const file of ['feed.json','local-services-feed.json','services-feed.json']){
    const feed=JSON.parse(read('dist/'+prefix+file));
    assert.equal(feed.version,'https://jsonfeed.org/version/1.1');
    assert.equal(new Set(feed.items.map(i=>i.id)).size,feed.items.length);
    assert.equal(feed.items.length,file==='feed.json'?6:file==='services-feed.json'?10:15);
    for(const item of feed.items){
      const route=new URL(item.url).pathname;
      const record=pageRecord(read('dist/'+(route==='/'?'index.html':route.slice(1))));
      assert.equal(item.title,record.heading);
      assert.equal(item.content_text,record.summary);
      assert.equal(item.summary,record.summary);
      assert.deepEqual(item.tags,record.topics);
      assert.ok(item.tags.length<=6);
      if(prefix)assert.match(item.content_text,/[\u3400-\u9fff]/);
    }
  }
});

test('English and Chinese structured topics match their visible headings and links resolve',()=>{
  const { pageRecord }=require('../tools/structured-index.cjs');
  for(const prefix of ['','zh/'])for(const file of ['about.html','services.html','roof-repairs-adelaide.html','roof-repairs-adelaide-guide.html']){
    const html=read('dist/'+prefix+file),record=pageRecord(html),nodes=ld(html);
    const page=nodes.find(n=>['WebPage','AboutPage','CollectionPage'].includes(n['@type']));
    assert.deepEqual(page.keywords,record.topics);
    for(const node of nodes.filter(n=>n['@type']==='Service')){
      assert.ok(node.name);
      if(prefix)assert.match(node.name,/[\u3400-\u9fff]/);
    }
    const feeds=nodes.find(n=>n['@type']==='WebSite').subjectOf;
    assert.ok(feeds.some(f=>f.url.endsWith('/'+prefix+'services-feed.json')));
  }
});

test('existing JSON/RSS item identities and date history are preserved',()=>{
  const cheerio=require('cheerio');
  for(const [json,rss] of [['feed.json','rss.xml'],['local-services-feed.json','local-services-rss.xml']]){
    const current=JSON.parse(read(json));
    const slugs=json==='feed.json'?['roof-repairs-adelaide-guide','roof-leak-repairs-adelaide-guide','tile-roof-repairs-adelaide-guide','roof-repointing-ridge-capping-adelaide-guide','gutter-downpipe-repairs-adelaide-guide','roof-restoration-adelaide-guide']:['roof-repairs-adelaide-cbd','roof-repairs-north-adelaide','roof-repairs-norwood-adelaide','roof-repairs-kensington-adelaide','roof-repairs-burnside-adelaide','roof-repairs-unley-adelaide','roof-repairs-goodwood-adelaide','roof-repairs-glen-osmond-adelaide','roof-repairs-prospect-adelaide','roof-repairs-salisbury-adelaide','roof-repairs-modbury-adelaide','roof-repairs-campbelltown-adelaide','roof-repairs-henley-beach-adelaide','roof-repairs-glenelg-adelaide','roof-repairs-port-adelaide'];
    const urls=slugs.map(s=>'https://www.adelaideroofkind.com.au/'+s+'.html');
    assert.deepEqual(current.items.map(i=>i.id),urls);
    for(const item of current.items){
      assert.equal(item.url,item.id);
      assert.equal(item.date_published,json==='feed.json'?'2026-09-27T00:00:00+09:30':undefined);
      assert.equal(item.date_modified,json==='feed.json'?'2026-10-15T00:00:00+10:30':'2026-10-08T12:00:00+08:00');
    }
    const after=cheerio.load(read(rss),{xmlMode:true});
    assert.deepEqual(after('guid').map((i,e)=>after(e).text()).get(),urls);
    assert.deepEqual(after('pubDate').map((i,e)=>after(e).text()).get(),json==='feed.json'?Array(6).fill('Sun, 27 Sep 2026 00:00:00 +0000'):[]);
  }
});

test('Chinese company topic references target the localized service entities',()=>{
  for(const file of ['index.html','services.html']){
    const nodes=ld(read('dist/zh/'+file));
    const company=nodes.find(n=>n['@type']==='ProfessionalService');
    assert.equal(company.knowsAbout.length,9);
    for(const topic of company.knowsAbout)assert.match(topic['@id'],/\/zh\/.+#service$/);
  }
});

test('both RSS languages have the same page-derived categories as their JSON Feed',()=>{
  const cheerio=require('cheerio');
  for(const prefix of ['','zh/'])for(const [json,rss] of [['feed.json','rss.xml'],['local-services-feed.json','local-services-rss.xml']]){
    const feed=JSON.parse(read('dist/'+prefix+json));
    const $=cheerio.load(read('dist/'+prefix+rss),{xmlMode:true});
    $('item').each((i,e)=>assert.deepEqual($(e).find('category').map((i,t)=>$(t).text()).get(),feed.items[i].tags));
  }
});

test('JSON Feed HTTP types are explicitly configured for all six bilingual endpoints',()=>{
  const {headers}=JSON.parse(read('vercel.json'));
  for(const prefix of ['/','/zh/'])for(const file of ['feed.json','local-services-feed.json','services-feed.json'])assert.ok(headers.some(h=>h.source===prefix+file&&h.headers.some(v=>v.key==='Content-Type'&&v.value==='application/feed+json; charset=utf-8')));
});
