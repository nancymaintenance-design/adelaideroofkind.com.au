// Only JSON-LD and feed artifacts are written; visible markup is never serialized.
const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const root=path.resolve(__dirname,'..');
const origin='https://www.adelaideroofkind.com.au';
const companyId=origin+'/#organization',siteId=origin+'/#website';
const serviceFiles=['roof-leak-repairs-adelaide.html','roof-repairs-adelaide.html','gutter-downpipe-repairs-adelaide.html','gutter-cleaning-adelaide.html','roof-restoration-adelaide.html','metal-roof-repairs-adelaide.html','roof-painting-adelaide.html','roof-cleaning-adelaide.html','roof-inspection-adelaide.html'];
const scripts=/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const clean=value=>String(value).replace(/\s+/g,' ').trim();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const ref=id=>({'@id':id});
function pageRecord(html){
  const $=cheerio.load(html);
  // Navigation is visible UI, not the article/service summary or topic list.
  $('[data-breadcrumb],.service-resources,.guide-service-entry').remove();
  const headingNode=$('main h1').first().clone();
  headingNode.children().after(' ');
  const heading=clean(headingNode.text());
  const topics=[...new Set([heading,...$('main h2').map((i,e)=>clean($(e).text())).get()].filter(Boolean))].slice(0,6);
  // Summary distribution uses the actual visible introductory paragraph.
  const summary=$('main p').map((i,e)=>clean($(e).text())).get().find(t=>t.length>=70)||clean($('meta[name="description"]').attr('content')||'');
  return {heading,topics,summary,description:clean($('meta[name="description"]').attr('content')||''),url:$('link[rel="canonical"]').attr('href')};
}
function serviceRecord(file){
  const record=pageRecord(read(file));
  return {'@type':'Service','@id':record.url+'#service',name:record.heading,description:record.description,url:record.url,provider:ref(companyId),mainEntityOfPage:ref(record.url+'#webpage')};
}
function enrichHtml(html,file){
  const record=pageRecord(html),expected=origin+(file==='index.html'?'/':'/'+file);
  if(record.url!==expected||!html.match(scripts))return html;
  const intro=pageRecord(read('about.html')).summary;
  return html.replace(scripts,(whole,json)=>{
    const data=JSON.parse(json),graph=data['@graph'];
    if(!graph)return whole;
    const company=graph.find(n=>n['@id']===companyId);
    if(!company)return whole;
    company.description=intro;
    company.legalName='ELLIS SERVICES GROUP PTY LTD';
    company.identifier={'@type':'PropertyValue',propertyID:'ABN',value:'96 645 821 745'};
    company.subjectOf=ref(origin+'/about.html#webpage');
    let site=graph.find(n=>n['@id']===siteId);
    if(!site){site={'@type':'WebSite','@id':siteId,url:origin+'/',name:'Ellis Services Group',publisher:ref(companyId)};graph.push(site);}
    site.inLanguage=['en-AU','zh-Hans'];
    site.subjectOf=['feed.json','local-services-feed.json','services-feed.json'].map(name=>({'@type':'DataFeed','@id':origin+'/'+name+'#feed',url:origin+'/'+name,encodingFormat:'application/feed+json'}));
    let page=graph.find(n=>['WebPage','AboutPage','ContactPage','CollectionPage'].includes(n['@type']));
    if(!page){page={'@type':'WebPage','@id':record.url+'#webpage',url:record.url,name:record.heading};graph.push(page);}
    if(file==='services.html'||file==='service-areas.html')page['@type']='CollectionPage';
    if(['about.html','contact.html','services.html','service-areas.html','industry-answers.html'].includes(file))page.name=record.heading;
    page.description=record.description;
    page.isPartOf=ref(siteId);
    page.inLanguage='en-AU';
    page.keywords=record.topics;
    const entity=graph.find(n=>n['@type']==='Service'||n['@type']==='Article');
    if(entity){
      entity['@id']||=record.url+(entity['@type']==='Article'?'#article':'#service');
      entity.url=record.url;
      entity.mainEntityOfPage=ref(page['@id']);
      page.mainEntity=ref(entity['@id']);
      if(entity['@type']==='Article'){
        entity.headline=record.heading;entity.description=record.description;
        entity.inLanguage='en-AU';entity.keywords=record.topics;
      }else{
        entity.name=record.heading;entity.description=record.description;
        entity.provider=ref(companyId);entity.category=record.topics;
      }
    }
    if(file==='about.html')page.mainEntity=ref(companyId);
    if(file==='index.html'||file==='services.html'){
      const services=serviceFiles.map(serviceRecord),id=origin+'/services.html#service-list';
      company.knowsAbout=services.map(s=>ref(s['@id']));
      let list=graph.find(n=>n['@id']===id);
      if(!list){list={'@type':'ItemList','@id':id};graph.push(list);}
      list.numberOfItems=services.length;
      list.itemListElement=services.map((item,i)=>({'@type':'ListItem',position:i+1,item}));
      if(file==='services.html')page.mainEntity=ref(id);
    }
    const list=graph.find(n=>n['@type']==='ItemList'&&n['@id']!==origin+'/services.html#service-list');
    if(list){
      list['@id']||=record.url+'#list';
      list.itemListElement?.forEach(item=>{
        if(item.url?.startsWith(origin+'/')){
          const target=new URL(item.url).pathname.slice(1)||'index.html';
          if(fs.existsSync(path.join(root,target)))item.name=pageRecord(read(target)).heading;
        }
      });
      if(file==='industry-answers.html')page.mainEntity=ref(list['@id']);
    }
    return whole.replace(json,JSON.stringify(data).replace(/</g,'\\u003c'));
  });
}
function enrichFeed(feed,readPage){
  return {...feed,items:feed.items.map(item=>{
    const record=pageRecord(readPage(new URL(item.url).pathname.slice(1)||'index.html'));
    return {...item,title:record.heading,summary:record.summary,content_text:record.summary,tags:record.topics};
  })};
}
function companyFeed(){
  return {version:'https://jsonfeed.org/version/1.1',title:'Ellis Services Group Roofing Services',home_page_url:origin+'/services.html',feed_url:origin+'/services-feed.json',description:'Company information and roofing service summaries from the linked public pages.',language:'en-AU',items:['about.html',...serviceFiles].map(file=>({id:origin+'/'+file,url:origin+'/'+file}))};
}
function refreshRss(xml,feed,selfUrl){
  const $=cheerio.load(xml,{xmlMode:true});
  // Omit optional channel timestamp instead of pretending each build is a new publication.
  $('channel > lastBuildDate').remove();
  if(selfUrl){
    $('rss').attr('xmlns:atom','http://www.w3.org/2005/Atom');
    $('channel > atom\\:link[rel="self"]').remove();
    $('channel').prepend($('<atom:link/>').attr({rel:'self',type:'application/rss+xml',href:selfUrl}));
  }
  $('item').each((i,e)=>{
    const item=feed.items.find(n=>n.url===$(e).find('link').text());
    if(!item)throw Error('RSS entry has no JSON Feed counterpart');
    $(e).find('title').text(item.title);$(e).find('description').text(item.summary);
    $(e).find('category').remove();
    for(const tag of item.tags)$(e).append($('<category/>').text(tag));
  });
  return $.xml();
}
function synchronize(write=false){
  const stale=[];
  const emit=(file,value)=>{
    if(fs.existsSync(path.join(root,file))&&read(file)===value)return;
    stale.push(file);if(write)fs.writeFileSync(path.join(root,file),value);
  };
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')))emit(file,enrichHtml(read(file),file));
  for(const [json,rss] of [['feed.json','rss.xml'],['local-services-feed.json','local-services-rss.xml']]){
    const feed=enrichFeed(JSON.parse(read(json)),read);
    emit(json,JSON.stringify(feed,null,2)+'\n');emit(rss,refreshRss(read(rss),feed,rss==='rss.xml'?origin+'/rss.xml':undefined));
  }
  emit('services-feed.json',JSON.stringify(enrichFeed(companyFeed(),read),null,2)+'\n');
  if(stale.length&&!write)throw Error('Structured index is stale: '+stale.join(', ')+'. Run npm run schema:sync, then verify both languages.');
  return stale;
}
function exportReport(){
  const directory=path.resolve(root,'../reports/structured-index-2026-10-19');
  const pages=[];
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
    const html=read(file),record=pageRecord(html);
    if(record.url!==origin+(file==='index.html'?'/':'/'+file))continue;
    const graph=[...html.matchAll(scripts)].flatMap(m=>JSON.parse(m[1])['@graph']||[]);
    if(!graph.some(n=>n['@type']==='WebSite'))continue;
    pages.push({file,url:record.url,zh_url:origin+'/zh/'+(file==='index.html'?'':file),topics:record.topics,schema:{'@context':'https://schema.org','@graph':graph}});
  }
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'generated-schema.json'),JSON.stringify(pages,null,2)+'\n');
  fs.writeFileSync(path.join(directory,'page-map.md'),'# 逐页结构化数据映射\n\n以下 '+pages.length+' 个英文 canonical 页面各有中文对应版本。完整标记见 generated-schema.json。别名、404 与隐私页保留原策略。\n\n| 英文页面 | 中文页面 | 图谱类型 |\n|---|---|---|\n'+pages.map(p=>'| '+p.file+' | /zh/'+(p.file==='index.html'?'':p.file)+' | '+[...new Set(p.schema['@graph'].map(n=>n['@type']))].join(', ')+' |').join('\n')+'\n');
  return {directory,pages:pages.length};
}
module.exports={pageRecord,enrichHtml,enrichFeed,synchronize,serviceFiles,refreshRss};
if(require.main===module){try{console.log(JSON.stringify({status:'pass',changed:synchronize(process.argv.includes('--write')),...(process.argv.includes('--report')?exportReport():{})}));}catch(error){console.error(error.message);process.exitCode=1;}}
