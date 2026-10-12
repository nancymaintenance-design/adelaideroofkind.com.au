import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
for(const file of ['metal-roof-repairs-adelaide.html','roof-painting-adelaide.html','roof-cleaning-adelaide.html','roof-inspection-adelaide.html']) {
  test(`${file} is a discoverable specialist service with visible FAQ answers and local images`,()=>{
    assert.ok(existsSync(new URL(file,root)), 'specialist page exists');
    const html=read(file),main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)[1];
    assert.equal((main.match(/<h1\b/g)||[]).length,1);
    assert.ok(read('sitemap.xml').includes('/'+file));
    for(const hub of ['services.html','industry-answers.html']) assert.ok(read(hub).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)[1].includes(`href="${file}"`),hub);
    const graph=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m=>JSON.parse(m[1])['@graph']||[]);
    const faq=graph.find(n=>n['@type']==='FAQPage');assert.ok(faq.mainEntity.length>=4);
    const text=main.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
    for(const q of faq.mainEntity){assert.ok(text.includes(q.name));assert.ok(text.includes(q.acceptedAnswer.text));}
    for(const m of main.matchAll(/<img\b[^>]*src="([^"]+)"/g)) assert.ok(existsSync(new URL(m[1],root)),m[1]);
    assert.ok(main.includes('contact.html'));
  });
}
