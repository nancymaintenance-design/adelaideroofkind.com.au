const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const {records,filename,origin,validateMap}=require('./navigation.cjs');
const root=path.resolve(__dirname,'..'),directory=path.resolve(root,'../reports/breadcrumb-service-paths-2026-10-20');
function inspect(output){
  const docs=new Map(records.map(r=>[r.url,cheerio.load(fs.readFileSync(path.join(output,filename(r)),'utf8'))]));
  const edges=new Map(),categories={navigation:new Map(),breadcrumb:new Map(),body:new Map()},issues=[...validateMap(records)];
  const canonicalByPath=new Map(records.map(r=>[new URL(r.url).pathname,r.url]));
  for(const [url,doc]of docs){
    edges.set(url,new Set());
    for(const a of doc('a[href]').toArray()){
      let target;try{target=new URL(doc(a).attr('href'),url);}catch{continue;}
      if(target.origin!==origin)continue;
      if(target.pathname==='/index.html')target.pathname='/';if(target.pathname==='/zh/index.html')target.pathname='/zh/';
      const to=canonicalByPath.get(target.pathname);if(!to)continue;
      // Language-switch links are not additional same-language service support.
      if(new URL(to).pathname.startsWith('/zh/')!==new URL(url).pathname.startsWith('/zh/'))continue;
      edges.get(url).add(to);
      const kind=doc(a).closest('[data-breadcrumb]').length?'breadcrumb':doc(a).closest('header,footer,nav').length?'navigation':doc(a).closest('main').length?'body':null;
      if(kind){if(!categories[kind].has(to))categories[kind].set(to,new Set());if(to!==url)categories[kind].get(to).add(url);}
    }
  }
  const distance=home=>{const found=new Map([[home,0]]),queue=[home];for(let i=0;i<queue.length;i++)for(const to of edges.get(queue[i])||[]){if(!found.has(to)){found.set(to,found.get(queue[i])+1);queue.push(to);}}return found;};
  const en=distance(origin+'/'),zh=distance(origin+'/zh/');
  const owners=records.filter(r=>['service','homepage'].includes(r.page_type)).map(r=>({url:r.url,locale:r.locale,query_group:r.query_group,click_distance:(r.locale==='zh-Hans'?zh:en).get(r.url)??null,
    sources:Object.fromEntries(Object.entries(categories).map(([kind,index])=>[kind,[...(index.get(r.url)||[])].sort()])),
    unique_source_pages:[...new Set(Object.values(categories).flatMap(index=>[...(index.get(r.url)||[])]))].sort(),gsc_impressions:null,gsc_clicks:null,gsc_position:null,received_valid_enquiries:null}));
  const pages=records.map(r=>{
    const doc=docs.get(r.url);const schema=doc('script[type="application/ld+json"]').toArray().flatMap(e=>{const data=JSON.parse(doc(e).html());return data['@graph']||[data];});
    const list=schema.filter(n=>n['@type']==='BreadcrumbList'),nav=doc('main [data-breadcrumb]');
    const row={...r,canonical:doc('link[rel="canonical"]').attr('href'),robots:doc('meta[name="robots"]').attr('content')||'no explicit restriction',lang:doc('html').attr('lang'),title:doc('title').text(),h1:doc('main h1').text(),hreflang:doc('link[hreflang]').map((i,e)=>({lang:doc(e).attr('hreflang'),url:doc(e).attr('href')})).get(),visible_path:nav.find('li').map((i,e)=>plain(doc(e).text())).get(),schema_path:list[0]?.itemListElement||[],has_tel:doc('main a[href="tel:+61434276883"],main a[href="tel:0434276883"]').length>0,has_contact:doc('main a[href]').toArray().some(a=>{const u=new URL(doc(a).attr('href'),r.url);return /\/(?:zh\/)?contact\.html$/.test(u.pathname);})||doc('main form').length>0};
    if(r.page_type!=='homepage'){
      if(nav.length!==1||list.length!==1)issues.push(r.url+': missing or duplicate breadcrumb');
      const expected=row.schema_path.map(i=>({name:i.name,url:i.item}));
      const visible=nav.find('li').map((i,e)=>({name:plain(doc(e).text()),url:doc(e).find('a').attr('href')||r.url})).get();
      if(JSON.stringify(expected)!==JSON.stringify(visible))issues.push(r.url+': visible/schema mismatch');
      for(const ancestor of row.schema_path.slice(0,-1))if(!docs.has(ancestor.item))issues.push(r.url+': invalid ancestor');
    }
    if(!row.has_tel||!row.has_contact)issues.push(r.url+': missing enquiry path');
    if(row.canonical!==r.url||/noindex|\bnone\b/i.test(row.robots))issues.push(r.url+': indexing/canonical problem');
    return row;
  });
  const excluded=[];
  function inventory(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){
    const target=path.join(folder,item.name);if(item.isDirectory()){inventory(target);continue;}if(!item.name.endsWith('.html'))continue;
    const route='/'+path.relative(output,target).replaceAll(path.sep,'/');if(records.some(r=>filename(r)===route.slice(1)))continue;
    const doc=cheerio.load(fs.readFileSync(target,'utf8'));const canonical=doc('link[rel="canonical"]').attr('href')||null;
    const robots=doc('meta[name="robots"]').attr('content')||null;
    excluded.push({path:route,canonical,robots,reason:item.name==='404.html'?'Error page, not a service hierarchy':/privacy/.test(item.name)?'Existing privacy/consent utility, outside commercial navigation':canonical&&canonical!==origin+route?'Non-owner alias; retain existing canonical/redirect decision':'Utility or existing redirect outside commercial map'});
  }}inventory(output);
  return {checkedAt:new Date().toISOString(),scope:'74 existing canonical bilingual pages; home has no breadcrumb',issues,pages,owners,excludedPages:excluded,dataLimitations:['No current GSC/GA4 account or export available; null is unavailable, not zero.','Phone/email clicks do not prove valid received enquiries.'],exclusions:['Homepages: no one-node BreadcrumbList.','Alias/locality redirect spellings, 404 and privacy utility pages: retain existing policies.','No standalone case routes or subservice routes exist; project anchors stay within their real service pages.']};
}
const plain=s=>String(s).replace(/\s+/g,' ').trim();
if(require.main===module){
  fs.mkdirSync(directory,{recursive:true});const baseline=process.argv.includes('--baseline');const file=path.join(directory,baseline?'before.json':'after.json');
  if(baseline&&fs.existsSync(file))throw Error('Baseline already exists; do not replace it with modified output.');
  const result=inspect(path.join(root,'dist'));fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
  if(!baseline)fs.writeFileSync(path.join(directory,'page-map.json'),JSON.stringify(result.pages,null,2)+'\n');
  console.log(JSON.stringify({file,pages:result.pages.length,issues:result.issues,owners:result.owners.map(o=>({url:o.url,depth:o.click_distance,sourcePages:o.unique_source_pages.length}))}));
  if(!baseline&&result.issues.length)process.exitCode=1;
}
module.exports={inspect};
