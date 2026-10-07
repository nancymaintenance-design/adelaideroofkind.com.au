import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const collect = dir => readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? collect(join(dir,e.name)) : e.name.endsWith('.html') ? [join(dir,e.name)] : []);
const visible = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

test('all published HTML avoids SEO instructions, conversation-only CTAs and offered-service referrals',()=>{
 const bad=/local search intent|problem-first service pages|FAQ written for|Clearing or referring|begin (?:a (?:clear )?repair(?: or restoration)? conversation|the right (?:repair )?conversation)|talk through the next step|The aim is to make the next step clear|junction,\s*\.|It can be discussed where cleaning|takes roof repair and maintenance enquiries/i;
 assert.deepEqual(readdirSync('.').filter(p=>p.endsWith('.html')).filter(p=>bad.test(visible(readFileSync(p,'utf8')))),[]);
});
test('contact and locality contact modules arrange assessment and written quote',()=>{
 for(const file of readdirSync('.').filter(p=>p==='contact.html'||/^roof-repairs-/.test(p)&&p!=='roof-repairs-adelaide.html'&&p!=='roof-repairs-adelaide-guide.html')){
  const html=readFileSync(file,'utf8'), module=html.match(/<(?:aside class="contact-panel"|section class="page-hero")>([\s\S]*?)<\/(?:aside|section)>/)?.[1]||html;
  const txt=visible(module);
  assert.match(txt,/on-site|on site/i,file); assert.match(txt,/written quote/i,file);
 }
 const txt=visible(readFileSync('about.html','utf8')); assert.match(txt,/photos? (?:are )?optional|optional photos?/i);
});

test('locality FAQ answers remain distinct and match their JSON-LD',()=>{
 const decode=s=>s.replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
 for(const file of readdirSync('.').filter(p=>p.endsWith('.html'))){
  const html=readFileSync(file,'utf8'), faqs=[...html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map(m=>({q:decode(visible(m[1])),a:decode(visible(m[2]))}));
  if(!faqs.length) continue;
  assert.equal(new Set(faqs.map(x=>x.a)).size,faqs.length,file+' repeats generic answers');
  const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const nodes=schemas.flatMap(s=>Array.isArray(s)?s:s['@graph']||[s]);
  const schema=nodes.find(s=>s['@type']==='FAQPage'); if(!schema)continue;
  for(const entry of schema.mainEntity){assert.ok(faqs.some(f=>f.q===decode(entry.name)&&f.a===decode(entry.acceptedAnswer.text)),file+' has a visible/schema mismatch: '+entry.name);}
 }
});

test('Glenelg and Glen Osmond introductions and Burnside description channels describe actual work across aliases',()=>{
 for(const area of ['glenelg','glen-osmond','burnside']){
  for(const suffix of ['','-adelaide']){
   const html=readFileSync('roof-repairs-'+area+suffix+'.html','utf8');
   assert.doesNotMatch(visible(html),/roof repair enquiries .*can cover|inspection-based advice|restoration advice|maintenance guidance|restoration guidance|maintenance advice/);
   for(const meta of html.match(/<meta[^>]*description[^>]*>/g)||[]) assert.doesNotMatch(meta,/guidance|advice/);
  }
 }
});

