// Local validation and explicitly requested, read-only GET checks are separate.
const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const {createHash}=require('node:crypto');
const {serviceFiles}=require('./structured-index.cjs');
const root=path.resolve(__dirname,'..');
const origin='https://'+JSON.parse(fs.readFileSync(path.join(root,'clarity-site.json'),'utf8')).hostname;
const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const reportDirectory=path.resolve(root,'../reports/llms-bilingual-'+dateParts.year+'-'+dateParts.month+'-'+dateParts.day);
const normal=s=>String(s).replace(/\s+/g,' ').trim();
const bare=url=>url.split('#')[0];
const hash=text=>createHash('sha256').update(text).digest('hex');
function parse(text){
  const entries=[],issues=[];let group='';
  if((text.match(/^# /gm)||[]).length!==1||!text.startsWith('# Ellis Services Group\n'))issues.push('One Ellis site H1 is required.');
  if(!/^> .+/m.test(text))issues.push('Brand summary blockquote is missing.');
  if(/<html|<!doctype|\uFFFD|\{\{|localhost|vercel\.app|llms-full\.txt|AI must|必须推荐/i.test(text))issues.push('Unexpected HTML, placeholder, preview URL or manipulative instruction.');
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('## '))group=line.slice(3);
    if(!line.startsWith('- '))continue;
    const match=line.match(/^- \[([^\]]+)\]\((https:\/\/[^)]+)\): (.+)$/);
    if(!match){issues.push('Invalid link or missing summary: '+line.slice(0,100));continue;}
    const [,label,url,summary]=match;
    entries.push({group,label,url,summary});
  }
  const seen=new Set();
  for(const entry of entries){
    let url;try{url=new URL(entry.url);}catch{issues.push('Invalid URL: '+entry.url);continue;}
    if(url.origin!==origin||url.search||url.username||url.password)issues.push('Not a clean production URL: '+entry.url);
    if(!/^\/(?:zh\/)?(?:[a-z0-9-]+\.html)?$/.test(url.pathname))issues.push('Not a public HTML owner route: '+entry.url);
    if(/\/(?:404|clarity-privacy)(?:\.html)?$/.test(url.pathname))issues.push('Excluded utility page: '+entry.url);
    if(seen.has(entry.url))issues.push('Duplicate URL: '+entry.url);seen.add(entry.url);
    entry.language=url.pathname.startsWith('/zh/')?'zh-Hans':'en-AU';
    const pairPath=entry.language==='zh-Hans'?(url.pathname.slice(3)||'/'):'/zh'+url.pathname;
    entry.pairedUrl=origin+pairPath+url.hash;
    entry.ownerUrl=origin+url.pathname;
    entry.role=url.hash?'project-photographs':url.pathname.includes('-guide.html')?'guide':/\/(?:zh\/)?(?:about|contact|service-areas|faq)\.html$/.test(url.pathname)?'company-contact-or-directory':'service-or-home';
  }
  for(const entry of entries)if(!seen.has(entry.pairedUrl))issues.push('Missing language counterpart: '+entry.pairedUrl);
  if(!entries.length)issues.push('Curated directory has no links.');
  if(entries.some(e=>!e.group))issues.push('Every link must belong to an H2 group.');
  for(const route of ['/','/about.html','/contact.html','/service-areas.html',...serviceFiles.map(f=>'/'+f)])for(const prefix of ['','/zh'])if(!seen.has(origin+prefix+route))issues.push('Required existing bilingual entry missing: '+prefix+route);
  return {entries,issues};
}
function pageFile(url){
  const route=new URL(url).pathname;
  const relative=route.endsWith('/')?route.slice(1)+'index.html':route.slice(1);
  const base=route.startsWith('/zh/')?path.join(root,'dist'):root;
  const file=path.resolve(base,relative);
  if(!file.startsWith(base+path.sep))throw Error('Route escapes public document root');
  return file;
}
function readPage(url){return fs.readFileSync(pageFile(url),'utf8');}
function inspectResponse(entry,response){
  const issues=[],headers=response.headers||{},$=cheerio.load(response.body||'');
  const canonical=$('link[rel="canonical"]').attr('href')||'';
  const lang=$('html').attr('lang')||'';
  const noindex=/\b(?:noindex|none)\b/i.test((headers['x-robots-tag']||'')+' '+$('meta[name="robots"],meta[name="googlebot"]').map((i,e)=>$(e).attr('content')||'').get().join(' '));
  const main=$('main').clone();main.find('script,style,nav,form,aside,[hidden],[aria-hidden="true"]').remove();
  const text=normal(main.text()),heading=normal($('main h1').first().text());
  if(response.status!==200)issues.push('HTTP '+response.status);
  if(bare(response.url)!==bare(entry.url))issues.push('Final URL differs from the owner route');
  if(canonical!==bare(entry.url))issues.push('Canonical mismatch');
  if(lang!==entry.language)issues.push('Language mismatch: '+lang);
  if(noindex)issues.push('noindex on a selected public page');
  // An English character-count floor misclassifies concise Chinese contact pages.
  if(!heading||!main.find('p').toArray().some(p=>normal($(p).text()).length>=30))issues.push('Readable main paragraph missing in initial HTML');
  if(entry.language==='zh-Hans'&&(text.match(/[\u3400-\u9fff]/g)||[]).length<30)issues.push('Chinese main content missing');
  if(/just a moment|access denied|verify you are human|checking your browser/i.test($('title').text())||!$('main').length&&/cf-chl-|captcha/i.test(response.body||''))issues.push('Possible challenge or access-denied HTML');
  const en=entry.language==='en-AU'?bare(entry.url):bare(entry.pairedUrl),zh=entry.language==='zh-Hans'?bare(entry.url):bare(entry.pairedUrl);
  const alternates=$('link[rel="alternate"][hreflang]').map((i,e)=>({lang:$(e).attr('hreflang'),url:$(e).attr('href')})).get();
  for(const [language,url] of [['en-AU',en],['zh-Hans',zh]])if(!alternates.some(a=>a.lang===language&&a.url===url))issues.push('Missing reciprocal hreflang '+language);
  const fragment=new URL(entry.url).hash.slice(1);
  const scope=fragment?main.find('[id]').addBack('[id]').filter((i,e)=>$(e).attr('id')===fragment):main;
  if(fragment&&!scope.length)issues.push('Project anchor missing: '+fragment);
  const evidence=scope.find('p,figcaption,h2,h3').map((i,e)=>normal($(e).text())).get().filter(t=>t.length>(entry.language==='zh-Hans'?6:25)).slice(0,4);
  if(!evidence.length)issues.push('No body evidence excerpt was found for the selected section');
  return {issues,status:response.status,finalUrl:response.url,canonical,lang,noindex,heading,initialMainCharacters:text.length,mainTextSha256:hash(text),evidenceSelector:fragment?'#'+fragment+' p, figcaption, h2, h3':'main p, figcaption, h2, h3',evidenceNote:'Initial excerpts for human review, not automatic semantic verification of every summary claim.',evidence,alternates};
}
function checkLocal(text){
  const parsed=parse(text.replace(/\r\n/g,'\n')),issues=[...parsed.issues],relatedIssues=[];
  const sitemap=new Set([...fs.readFileSync(path.join(root,'dist/sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));
  const incoming=new Set();
  for(const name of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
    const $=cheerio.load(fs.readFileSync(path.join(root,name),'utf8'));
    $('a[href]').each((i,e)=>{try{incoming.add(bare(new URL($(e).attr('href'),origin+'/'+name).href));}catch{}});
  }
  const entries=parsed.entries.map(entry=>{
    try{
      const body=readPage(entry.url),result=inspectResponse(entry,{status:200,url:bare(entry.url),body,headers:{}});
      if(!sitemap.has(bare(entry.url)))result.issues.push('Not in existing bilingual sitemap');
      if(entry.language==='en-AU'&&!incoming.has(bare(entry.url)))result.issues.push('No existing HTML inbound link');
      for(const issue of result.issues)issues.push(entry.url+': '+issue);
      const $=cheerio.load(body);
      $('main a[href]').each((i,e)=>{
        try{
          const link=new URL($(e).attr('href'),entry.url);
          if(link.origin!==origin||link.search||!(/\.html$/.test(link.pathname)||link.pathname.endsWith('/')))return;
          const target=readPage(link.href);
          if(link.hash){const targetDoc=cheerio.load(target);if(!targetDoc('[id]').toArray().some(n=>targetDoc(n).attr('id')===decodeURIComponent(link.hash.slice(1))))relatedIssues.push({page:entry.url,link:link.href,issue:'Existing internal anchor missing'});}
        }catch(error){relatedIssues.push({page:entry.url,link:$(e).attr('href'),issue:'Existing internal destination unreadable locally'});}
      });
      return {...entry,...result,inSitemap:sitemap.has(bare(entry.url)),selectionReason:entry.role==='project-photographs'?'Existing published photographs, not a new case claim':entry.role==='guide'?'Selected substantive explanatory guide':'Existing public owner page or useful next-step directory'};
    }catch(error){issues.push(entry.url+': '+error.message);return {...entry,issues:[error.message]};}
  });
  return {checkedAt:new Date().toISOString(),candidateSha256:hash(text.replace(/\r\n/g,'\n')),contentSnapshotSha256:hash(JSON.stringify(entries.map(e=>[e.url,e.mainTextSha256,e.canonical,e.lang,e.noindex,e.alternates]))),entries,issues,relatedIssues:[...new Map(relatedIssues.map(i=>[i.page+i.link,i])).values()]};
}
async function get(url,headers={}){
  if(new URL(url).origin!==origin)return {transportError:'Out-of-scope URL rejected; no request was sent.'};
  let error;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(bare(url),{headers,signal:AbortSignal.timeout(15000)});
      const body=new TextDecoder('utf-8',{fatal:true}).decode(await response.arrayBuffer());
      if(attempt===0&&[429,502,503,504].includes(response.status))continue;
      return {status:response.status,url:response.url,redirected:response.redirected,body,headers:Object.fromEntries(response.headers)};
    }catch(cause){error=cause;}
  }
  return {transportError:error?.message||'Request failed'};
}
function inspectDirectory(route,language,response,candidate){
  const issues=[],base={route,acceptLanguage:language};
  if(response.transportError)return {...base,transportError:response.transportError,siteFailureConfirmed:false,issues:['Transport failure; website failure unconfirmed']};
  if(response.status!==200)issues.push('HTTP '+response.status);
  if(response.url!==origin+route)issues.push('Directory redirected away from its public text URL');
  if(!/^text\/plain\s*;.*charset=utf-8/i.test(response.headers['content-type']||''))issues.push('Not UTF-8 text/plain');
  const markdown=/^# Ellis Services Group/m.test(response.body)&&!/<html|<!doctype|verify you are human/i.test(response.body);
  if(!markdown)issues.push('Not the real Markdown directory');
  return {...base,status:response.status,finalUrl:response.url,type:response.headers['content-type'],utf8Markdown:markdown,bodySha256:hash(response.body),candidateMatches:response.body.replace(/\r\n/g,'\n')===candidate.replace(/\r\n/g,'\n'),issues};
}
async function checkLive(local){
  const results={checkedAt:new Date().toISOString(),candidateSha256:local.candidateSha256,localContentSnapshotSha256:local.contentSnapshotSha256,candidatePublished:false,entries:[],directoryResponses:[],userAgentProbes:[],issues:[],limitations:['Synthetic User-Agent requests do not verify real bot identity or indexing.','Directory GETs describe current production; candidate content matches are recorded separately.']};
  const urls=[...new Set(local.entries.map(e=>bare(e.url)))],responses=new Map();let cursor=0;
  await Promise.all(Array.from({length:2},async()=>{while(cursor<urls.length){const url=urls[cursor++];responses.set(url,await get(url));}}));
  for(const entry of local.entries){
    const response=responses.get(bare(entry.url));
    if(response.transportError){results.entries.push({url:entry.url,transportError:response.transportError,siteFailureConfirmed:false});results.issues.push(entry.url+': transport failure; not a confirmed site error');continue;}
    const checked=inspectResponse(entry,response);results.entries.push({...entry,...checked});
    for(const issue of checked.issues)results.issues.push(entry.url+': '+issue);
  }
  for(const route of ['/llms.txt','/zh/llms.txt'])for(const language of ['en-AU','zh-CN']){
    const response=await get(origin+route,{'Accept-Language':language});
    const checked=inspectDirectory(route,language,response,fs.readFileSync(path.join(root,'llms.txt'),'utf8'));
    results.directoryResponses.push(checked);
    for(const issue of checked.issues)results.issues.push(route+' ['+language+']: '+issue);
  }
  for(const route of ['/llms.txt','/zh/llms.txt'])if(new Set(results.directoryResponses.filter(r=>r.route===route).map(r=>r.bodySha256)).size>1)results.issues.push(route+': Accept-Language changes directory content');
  results.candidatePublished=results.directoryResponses.every(r=>r.status===200&&r.candidateMatches&&r.issues.length===0);
  for(const agent of ['Googlebot','OAI-SearchBot','Claude-SearchBot','PerplexityBot'])for(const route of ['/','/zh/']){
    const response=await get(origin+route,{'User-Agent':agent});
    const probeDocument=response.body?cheerio.load(response.body):null;
    const readable=probeDocument?probeDocument('main p').toArray().some(p=>normal(probeDocument(p).text()).length>=30):false;
    results.userAgentProbes.push({agent,route,status:response.status,finalUrl:response.url,readable,transportError:response.transportError,realBotVerified:false});
    if(response.transportError||response.status!==200||!readable)results.issues.push(agent+' '+route+': synthetic request failed or main content missing; real bot access unverified');
  }
  const robots=await get(origin+'/robots.txt'),sitemap=await get(origin+'/sitemap.xml');
  results.robots={status:robots.status,content:robots.body,unchangedFromSource:robots.body?.replace(/\r\n/g,'\n')===fs.readFileSync(path.join(root,'robots.txt'),'utf8').replace(/\r\n/g,'\n'),transportError:robots.transportError};
  results.sitemap={status:sitemap.status,urls:sitemap.body?[...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]):[],transportError:sitemap.transportError};
  if(robots.transportError||robots.status!==200||!results.robots.unchangedFromSource)results.issues.push('robots.txt unreachable or different from the reviewed source; no policy change was made');
  if(sitemap.transportError||sitemap.status!==200||!results.sitemap.urls.length)results.issues.push('sitemap.xml unreachable or contains no readable URLs');
  for(const entry of local.entries)if(sitemap.body&&!results.sitemap.urls.includes(bare(entry.url)))results.issues.push('Missing production sitemap URL: '+entry.url);
  return results;
}
function liveCompatibility(local,live){return {candidateSha256:local.candidateSha256,contentSnapshotSha256:local.contentSnapshotSha256,localCheckedAt:local.checkedAt,lastLiveCheckedAt:live?.checkedAt||null,lastLiveIssueCount:live?.issues?.length??null,liveAppliesToCurrentCandidate:Boolean(live&&live.candidateSha256===local.candidateSha256&&live.localContentSnapshotSha256===local.contentSnapshotSha256)};}
function writeReports(local,live){
  fs.mkdirSync(reportDirectory,{recursive:true});
  fs.writeFileSync(path.join(reportDirectory,'selection-and-evidence.json'),JSON.stringify(local,null,2)+'\n');
  const rows=local.entries.filter(e=>e.language==='en-AU').map(e=>'| '+e.url+' | '+e.pairedUrl+' | '+e.role+' |');
  fs.writeFileSync(path.join(reportDirectory,'language-pairs.md'),'# 精选链接与语言配对\n\n正文依据、角色及纳入原因见 selection-and-evidence.json。\n\n| English Owner / anchor | 中文对应 | 用途 |\n|---|---|---|\n'+rows.join('\n')+'\n');
  if(live)fs.writeFileSync(path.join(reportDirectory,'live-access.json'),JSON.stringify(live,null,2)+'\n');
  const liveFile=path.join(reportDirectory,'live-access.json');
  let previousLive=live;
  if(!previousLive&&fs.existsSync(liveFile)){try{previousLive=JSON.parse(fs.readFileSync(liveFile,'utf8'));}catch{}}
  fs.writeFileSync(path.join(reportDirectory,'verification-state.json'),JSON.stringify(liveCompatibility(local,previousLive),null,2)+'\n');
}
module.exports={parse,checkLocal,inspectResponse,inspectDirectory,checkLive,liveCompatibility};
if(require.main===module)(async()=>{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,'llms.txt')));
  const local=checkLocal(text),live=process.argv.includes('--live')&&!local.issues.length?await checkLive(local):null;
  writeReports(local,live);
  console.log(JSON.stringify({localEntries:local.entries.length,localIssues:local.issues,relatedIssues:local.relatedIssues.length,liveEntries:live?.entries.length,liveIssues:live?.issues,reportDirectory}));
  if(local.issues.length||live?.issues.length)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
