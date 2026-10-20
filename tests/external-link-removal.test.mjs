import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as cheerio from 'cheerio';
const root=new URL('../dist/',import.meta.url);
const blocked=/https?:\/\/(?:colorbond\.com|www\.monier\.com\.au|asbestos\.sa\.gov\.au|privacy\.microsoft\.com)\//i;
test('public bilingual output has no removed external destinations or empty replacement paragraphs',()=>{
  const scan=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);if(entry.isDirectory())scan(file);
    else if(/\.(html|json|xml|txt)$/.test(entry.name)){
      const body=fs.readFileSync(file,'utf8');assert.ok(!blocked.test(body),file+' must not retain removed URLs');
      if(entry.name.endsWith('.html')){const doc=cheerio.load(body);doc('main p:not([aria-live]):not([hidden])').each((_,p)=>assert.ok(doc(p).text().trim()||doc(p).find('img,input').length,file+' empty paragraph'));}
    }
  }};scan(fileURLToPath(root));
  for(const prefix of ['', 'zh/']){
    const about=cheerio.load(fs.readFileSync(new URL(prefix+'about.html',root),'utf8'));
    assert.equal(about('a[href="https://abr.business.gov.au/ABN/View?id=645821745"]').length,1);
    const cleaning=cheerio.load(fs.readFileSync(new URL(prefix+'roof-cleaning-adelaide.html',root),'utf8'));
    assert.ok(cleaning('a[href$="metal-roof-repairs-adelaide.html"]').length>0,'related service remains accessible');
    const privacy=cheerio.load(fs.readFileSync(new URL(prefix+'clarity-privacy.html',root),'utf8'));
    assert.ok(privacy('a[href$="contact.html"]').length>0,'privacy support stays within site');
  }
});
