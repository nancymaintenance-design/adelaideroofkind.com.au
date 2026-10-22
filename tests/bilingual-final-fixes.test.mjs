import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const {chinese}=require('../tools/bilingual.cjs');
const read=file=>readFileSync(path.join(root,file),'utf8');
const schema=html=>[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(match=>{const value=JSON.parse(match[1]);return value['@graph']||[value];});

test('text arrays translate and enter missing coverage while schema codes, URLs, identifiers and enum arrays remain unchanged',()=>{
  const value={'@type':'Service',serviceType:['New service',['Roof cleaning']],description:['Roof cleaning'],identifier:['Internal service ID'],url:['https://example.invalid/'],sameAs:['https://example.invalid/profile'],availableChannel:['https://schema.org/OnlineOnly'],address:{addressCountry:['AU'],addressRegion:['SA']}};
  const html='<html lang="en-AU"><head><script type="application/ld+json">'+JSON.stringify(value)+'</script></head></html>';
  const missing=new Set();const result=schema(chinese(html,'index.html',{'roof cleaning':'屋顶清洗'},new Set(),missing))[0];
  assert.deepEqual([...missing],['New service']);
  assert.deepEqual(result.serviceType,['New service',['屋顶清洗']]);assert.deepEqual(result.description,['屋顶清洗']);
  for(const key of ['identifier','url','sameAs','availableChannel','address'])assert.deepEqual(result[key],value[key],key);
});

test('new real-page schema array label blocks actual validator and build before artifact removal',()=>{
  const fixture=mkdtempSync(path.join(tmpdir(),'ark-schema-'));
  try {
    for(const name of ['tools','assets/js','api','clarity-assets','content'])cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
    for(const name of require('../tools/build-static.cjs').collectPublicFiles(root).filter(name=>!name.includes(path.sep)))cpSync(path.join(root,name),path.join(fixture,name));
    const run=(script,...args)=>spawnSync(process.execPath,[path.join(fixture,script),...args],{encoding:'utf8'});
    assert.equal(run('tools/bilingual.cjs','check').status,0);
    const target=path.join(fixture,'roof-repairs-burnside-adelaide.html');
    writeFileSync(target,readFileSync(target,'utf8').replace('"serviceType":[','"serviceType":["Untranslated new roof service",'));
    const check=run('tools/bilingual.cjs','check');assert.notEqual(check.status,0);assert.match(check.stderr,/missing\/stale Chinese translations/);
    mkdirSync(path.join(fixture,'dist'));writeFileSync(path.join(fixture,'dist','keep.txt'),'previous preview');
    const build=run('tools/build-static.cjs');assert.notEqual(build.status,0);assert.match(build.stderr,/missing\/stale Chinese translations/);
    assert.equal(readFileSync(path.join(fixture,'dist','keep.txt'),'utf8'),'previous preview');
    writeFileSync(path.join(fixture,'content/zh-Hans/99-test.json'),JSON.stringify({'untranslated new roof service':'新增屋顶服务'}));
    assert.equal(run('tools/bilingual.cjs','check').status,0,'reviewed translation unblocks the real validator');
  } finally {rmSync(fixture,{recursive:true,force:true});}
});

test('generated Burnside serviceType array is fully Chinese',()=>{
  const service=schema(read('dist/zh/roof-repairs-burnside-adelaide.html')).find(node=>node['@type']==='Service');
  assert.deepEqual(service.serviceType,['屋顶维修','屋顶翻新','屋顶漏水调查','檐沟清理']);
  let arrayPages=0;
  for(const file of readdirSync(path.join(root,'dist/zh')).filter(file=>file.endsWith('.html')))for(const node of schema(read('dist/zh/'+file))) {
    if(!Array.isArray(node.serviceType))continue;
    arrayPages++;
    for(const label of node.serviceType.flat(Infinity))assert.match(label,/[\u3400-\u9fff]/,file+': '+label);
  }
  assert.ok(arrayPages>5,'cover all generated real service arrays');
});

test('Chinese homepage empty and malformed-email validation is Chinese in an English browser with zero requests; English retains native validation',async()=>{
  const browser=await chromium.launch();
  try {
    for(const [locale,file] of [['zh-Hans','dist/zh/index.html'],['en-AU','index.html']]) {
      const page=await browser.newPage({locale:'en-AU'});
      const form=read(file).match(/<form\b[^>]*data-contact-form[^>]*>[\s\S]*?<\/form>/)[0];
      await page.setContent(`<html lang="${locale}"><body>${form}</body></html>`);
      await page.evaluate(()=>{window.requests=0;window.fetch=async()=>{window.requests++;throw Error('No network permitted');};});
      await page.addScriptTag({content:read('assets/js/contact-form.js')});
      await page.locator('button[type="submit"]').click();
      const empty=await page.locator('[name="name"]').evaluate(field=>field.validationMessage);
      if(locale==='zh-Hans')assert.equal(empty,'请填写此必填项。');else assert.match(empty,/fill out this field/);
      for(const [name,value] of [['name','Test'],['email','invalid-email'],['phone','0400000000'],['suburb','Burnside']])await page.locator(`[name="${name}"]`).fill(value);
      await page.locator('[name="service"]').selectOption('Roof leak');await page.locator('button[type="submit"]').click();
      const invalid=await page.locator('[name="email"]').evaluate(field=>field.validationMessage);
      if(locale==='zh-Hans')assert.equal(invalid,'请输入有效的电子邮箱地址。');else assert.match(invalid,/@/);
      assert.equal(await page.evaluate(()=>window.requests),0);
      assert.equal(await page.locator('form').evaluate(form=>form.noValidate),locale==='zh-Hans');await page.close();
    }
  } finally {await browser.close();}
});
