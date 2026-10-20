import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createPreviewServer}=require('../tools/preview-local.cjs');
const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const origin='https://www.adelaideroofkind.com.au';
const entries=text=>[...text.matchAll(/^- \[([^\]]+)\]\((https:\/\/[^)]+)\): (.+)$/gm)].map(([,label,url,summary])=>({label,url,summary}));

// Catches a return to a bare URL dump, missing Chinese owners, or hidden paths.
test('root llms provides described bilingual service owners without copying locality sitemap',()=>{
  const text=read('llms.txt'),links=entries(text);
  assert.equal((text.match(/^# /gm)||[]).length,1);
  assert.equal(links.length,(text.match(/^- /gm)||[]).length,'every entry has an explicit summary');
  assert.ok(links.length>20);
  for(const file of ['roof-leak-repairs-adelaide.html','roof-repairs-adelaide.html','gutter-downpipe-repairs-adelaide.html','gutter-cleaning-adelaide.html','roof-restoration-adelaide.html','metal-roof-repairs-adelaide.html','roof-painting-adelaide.html','roof-cleaning-adelaide.html','roof-inspection-adelaide.html']){
    for(const prefix of ['/','/zh/'])assert.ok(links.some(l=>l.url===origin+prefix+file),prefix+file);
  }
  assert.equal(new Set(links.map(l=>l.url)).size,links.length);
  assert.ok(links.every(l=>!/^https:\/\/[^/]+\/(?:zh\/)?roof-repairs-(?:norwood|unley|prospect|burnside)/.test(l.url)),'use the area overview, not a suburb dump');
  assert.doesNotMatch(text,/llms-full|\.html\.md|\/(?:api|__editor|\.local-editor)\//);
});

test('local GET serves the same UTF-8 curated document without negotiation or HTML fallback',async()=>{
  const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    for(const route of ['/llms.txt','/zh/llms.txt'])for(const language of ['en-AU','zh-CN']){
      const response=await fetch(base+route,{headers:{'Accept-Language':language}});
      assert.equal(response.status,200);assert.equal(response.url,base+route);
      assert.match(response.headers.get('content-type'),/^text\/plain; charset=utf-8$/i);
      const text=new TextDecoder('utf-8',{fatal:true}).decode(await response.arrayBuffer());
      assert.equal(text.replace(/\r\n/g,'\n'),read('llms.txt').replace(/\r\n/g,'\n'));
      assert.match(text,/^# Ellis Services Group/m);assert.match(text,/中文服务/);
      assert.doesNotMatch(text,/<(?:html|!doctype)|captcha|verify you are human/i);
    }
  }finally{await new Promise(r=>server.close(r));}
});

test('local validator catches missing summaries, duplicate links, wrong domains and invalid paired anchors',()=>{
  const {checkLocal}=require('../tools/llms-audit.cjs');
  const text=read('llms.txt');
  assert.equal(checkLocal(text).issues.length,0);
  for(const bad of [text.replace(/\): [^\n]+/,')'),text.replace(origin,'https://wrong.example'),text+'\n'+text.match(/^- \[.+/m)[0],text.replace('#ridge-repair-project','#not-a-real-project')]){
    assert.ok(checkLocal(bad).issues.length>0);
  }
});

test('GET verifier rejects missing pages and HTML challenges',async()=>{
  const {inspectResponse}=require('../tools/llms-audit.cjs');
  const page={url:origin+'/',language:'en-AU',pairedUrl:origin+'/zh/'};
  assert.ok(inspectResponse(page,{status:404,url:page.url,body:'missing',headers:{}}).issues.length);
  assert.ok(inspectResponse(page,{status:200,url:page.url,body:'<html><title>Just a moment...</title><body>Verify you are human</body></html>',headers:{}}).issues.length);
});

test('independent maintenance command cannot accept an empty or one-language directory',()=>{
  const {parse}=require('../tools/llms-audit.cjs');
  assert.ok(parse('# Ellis Services Group\n\n> hi\n').issues.length);
  const oneLanguage=read('llms.txt').split('\n').filter(line=>!line.includes('https://www.adelaideroofkind.com.au/zh/')).join('\n');
  assert.ok(parse(oneLanguage).issues.length);
});

test('none blocks indexing in both robots meta and HTTP headers',()=>{
  const {inspectResponse}=require('../tools/llms-audit.cjs');
  const entry={url:origin+'/',language:'en-AU',pairedUrl:origin+'/zh/'};
  const body=read('index.html');
  for(const response of [{body:body.replace('</head>','<meta name="robots" content="none"></head>'),headers:{}},{body,headers:{'x-robots-tag':'none'}}])assert.equal(inspectResponse(entry,{...response,status:200,url:entry.url}).noindex,true);
});

test('request diagnostics report transport failure separately from HTTP 404 or a valid directory',()=>{
  const {inspectDirectory}=require('../tools/llms-audit.cjs');
  const bad=inspectDirectory('/llms.txt','en-AU',{transportError:'timed out'},read('llms.txt'));
  assert.ok(bad.issues.length);assert.equal(bad.siteFailureConfirmed,false);
  const missing=inspectDirectory('/llms.txt','en-AU',{status:404,url:origin+'/llms.txt',headers:{'content-type':'text/plain; charset=utf-8'},body:'Not found'},read('llms.txt'));
  assert.ok(missing.issues.some(i=>i.includes('404')));
  const good=inspectDirectory('/llms.txt','en-AU',{status:200,url:origin+'/llms.txt',headers:{'content-type':'text/plain; charset=utf-8'},body:read('llms.txt')},read('llms.txt'));
  assert.equal(good.issues.length,0);assert.equal(good.candidateMatches,true);
});

test('online evidence cannot silently apply to another candidate or another local content snapshot',()=>{
  const {liveCompatibility}=require('../tools/llms-audit.cjs');
  const current={candidateSha256:'current',contentSnapshotSha256:'pages-current'};
  assert.equal(liveCompatibility(current,{candidateSha256:'old',localContentSnapshotSha256:'pages-current'}).liveAppliesToCurrentCandidate,false);
  assert.equal(liveCompatibility(current,{candidateSha256:'current',localContentSnapshotSha256:'pages-old'}).liveAppliesToCurrentCandidate,false);
  assert.equal(liveCompatibility(current,{candidateSha256:'current',localContentSnapshotSha256:'pages-current'}).liveAppliesToCurrentCandidate,true);
});

test('short Chinese project captions remain usable source evidence',()=>{
  const {checkLocal}=require('../tools/llms-audit.cjs');
  const row=checkLocal(read('llms.txt')).entries.find(e=>e.url===origin+'/zh/roof-repairs-adelaide.html#ridge-repair-project');
  assert.ok(row.evidence.length>0,'real short Chinese captions must not disappear under an English length threshold');
  assert.ok(row.evidence.some(text=>text.includes('屋脊')));
});
