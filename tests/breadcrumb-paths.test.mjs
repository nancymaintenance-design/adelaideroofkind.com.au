import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as cheerio from 'cheerio';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'..');
const origin='https://www.adelaideroofkind.com.au';
const read=route=>fs.readFileSync(path.join(root,'dist',route==='/'?'index.html':route.endsWith('/')?route.slice(1)+'index.html':route.slice(1)),'utf8');
const nodes=doc=>doc('script[type="application/ld+json"]').toArray().flatMap(e=>{const data=JSON.parse(doc(e).html());return data['@graph']||[data];});
const routes=fs.readdirSync(root).filter(f=>f.endsWith('.html')).flatMap(file=>{
  const doc=cheerio.load(fs.readFileSync(path.join(root,file),'utf8'));
  const route=file==='index.html'?'/':'/'+file;
  return doc('link[rel="canonical"]').attr('href')===origin+route?[route,route==='/'?'/zh/':'/zh'+route]:[];
});

// Catches schema-only navigation, missing Chinese output and accidental alias coverage.
test('every applicable canonical page exposes one usable initial-HTML breadcrumb',()=>{
  assert.equal(routes.length,74);
  for(const route of routes){
    const doc=cheerio.load(read(route));
    const nav=doc('main nav[data-breadcrumb]');
    if(['/', '/zh/'].includes(route)){assert.equal(nav.length,0);assert.equal(nodes(doc).filter(n=>n['@type']==='BreadcrumbList').length,0);continue;}
    assert.equal(nav.length,1,route+' has visible breadcrumbs');
    assert.equal(nav.attr('aria-label'),route.startsWith('/zh/')?'面包屑导航':'Breadcrumb');
    assert.ok(nav.find('ol > li').length>=2,route);
    assert.equal(nav.find('[aria-current="page"]').length,1);
    assert.equal(nav.find('li').last().find('a').length,0);
    for(const link of nav.find('a').toArray()){
      const href=doc(link).attr('href');assert.ok(href.startsWith(origin+'/'));
      assert.ok(!doc(link).attr('target')&&!doc(link).attr('rel'));
      assert.equal(new URL(href).pathname.startsWith('/zh/'),route.startsWith('/zh/'));
    }
  }
});

test('single-service guides lead to the right service and mixed drainage advice stays in its useful hub',()=>{
  const expectations=[['/roof-leak-repairs-adelaide-guide.html','/roof-leak-repairs-adelaide.html'],['/tile-roof-repairs-adelaide-guide.html','/roof-repairs-adelaide.html'],['/roof-repointing-ridge-capping-adelaide-guide.html','/roof-repairs-adelaide.html'],['/roof-restoration-adelaide-guide.html','/roof-restoration-adelaide.html'],['/gutter-downpipe-repairs-adelaide-guide.html','/industry-answers.html']];
  for(const [route,parent]of expectations)for(const prefix of ['', '/zh']){
    const doc=cheerio.load(read(prefix+route));
    assert.equal(doc('[data-breadcrumb] a').last().attr('href'),origin+prefix+parent);
    assert.ok(doc('.service-hero-actions a.button').length>=2,'service and enquiry actions visible near guide heading');
    const ancestor=cheerio.load(read(prefix+parent));
    assert.ok(ancestor('main a[href]').toArray().some(a=>new URL(ancestor(a).attr('href'),origin+prefix+parent).pathname===prefix+route),'parent offers the guide');
  }
});

test('visible paths and one BreadcrumbList agree without destroying business schema or canonical pairing',()=>{
  for(const route of routes.filter(r=>!['/','/zh/'].includes(r))){
    const doc=cheerio.load(read(route));const graph=nodes(doc),crumbs=graph.filter(n=>n['@type']==='BreadcrumbList');
    assert.equal(crumbs.length,1,route);
    const items=crumbs[0].itemListElement;
    assert.equal(items.length,doc('[data-breadcrumb] li').length);
    items.forEach((n,i)=>{
      const li=doc('[data-breadcrumb] li').eq(i);assert.equal(n.position,i+1);assert.equal(n.name,li.text().trim());
      assert.equal(n.item,i===items.length-1?origin+route:li.find('a').attr('href'));
    });
    assert.equal(doc('link[rel="canonical"]').attr('href'),origin+route);
    const page=graph.find(n=>n.url===origin+route&&['WebPage','AboutPage','ContactPage','CollectionPage'].includes(n['@type']));
    assert.equal(page.breadcrumb['@id'],origin+route+'#breadcrumb');
    const sourceFile=route.replace(/^\/zh\//,'/').slice(1);
    const source=cheerio.load(fs.readFileSync(path.join(root,sourceFile),'utf8'));
    for(const node of nodes(source).filter(n=>['ProfessionalService','Organization','Service','Article','FAQPage'].includes(n['@type']))){
      assert.ok(graph.some(n=>n['@type']===node['@type']),route+' preserves '+node['@type']);
    }
    assert.equal(doc('link[hreflang="zh-Hans"]').attr('href'),origin+(route.startsWith('/zh/')?route:'/zh'+route));
  }
});

test('explicit mapping rejects cycles, missing parents, cross-language links and unsafe destinations',()=>{
  assert.ok(fs.existsSync(path.join(root,'tools/navigation.cjs')),'shared navigation implementation exists');
  const {records,validateMap}=require('../tools/navigation.cjs');
  assert.equal(validateMap(records).length,0);
  const guide=records.find(r=>r.url===origin+'/roof-leak-repairs-adelaide-guide.html');
  for(const parent of [guide.url,origin+'/not-a-page.html',origin+'/zh/services.html','https://example.com/']){
    const changed=records.map(r=>r===guide?{...r,primary_parent_url:parent}:r);
    assert.ok(validateMap(changed).length>0,parent+' rejected');
  }
  const mutations=[
    {...guide,related_owner_urls:[origin+'/zh/roof-leak-repairs-adelaide.html']},
    {...guide,related_owner_urls:[origin+'/about.html']},
    {...guide,resources:[{url:origin+'/missing.html',label:'Missing'}]},
    {...guide,resources:[{url:origin+'/zh/roof-repairs-adelaide.html',label:'Wrong language'}]}
  ];
  for(const mutation of mutations)assert.ok(validateMap(records.map(r=>r===guide?mutation:r)).length>0,'invalid supporting destination rejected');
});

test('rendering is idempotent and safely encodes customer labels',()=>{
  assert.ok(fs.existsSync(path.join(root,'tools/navigation.cjs')));
  const {renderPage,records}=require('../tools/navigation.cjs');
  const record=records.find(r=>r.url===origin+'/services.html');const html=read('/services.html');
  assert.equal(renderPage(renderPage(html,record),record),renderPage(html,record));
  const changed=records.map(r=>r.url===record.url?{...r,breadcrumb_label:'Tiles & "ridges" </script>'}:r);
  const result=renderPage(html,changed.find(r=>r.url===record.url),changed);
  const doc=cheerio.load(result);assert.equal(doc('[aria-current="page"]').filter('span').text(),'Tiles & "ridges" </script>');
  assert.doesNotThrow(()=>nodes(doc));assert.equal(doc('script:not([src]):not([type="application/ld+json"])').length,cheerio.load(html)('script:not([src]):not([type="application/ld+json"])').length);
});

test('every mapped public page gives a main-content telephone and enquiry route',()=>{
  const {inspect}=require('../tools/navigation-report.cjs');
  assert.deepEqual(inspect(path.join(root,'dist')).issues,[]);
});
