const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const map=require('../content/navigation-map.json');
const root=path.resolve(__dirname,'..');
const origin=map.origin;
const plain=s=>String(s).replace(/\s+/g,' ').trim();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=data=>JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const localPath=(target,zh)=>{
  const [route,fragment]=target.split('#');const entry=map.pages.find(p=>p.path===route);
  if(!entry)throw Error('Unknown navigation destination: '+target);
  return (zh?entry.zhPath:entry.path)+(fragment?'#'+fragment:'');
};
const records=map.pages.flatMap(page=>[false,true].map(zh=>({
  page_id:(zh?'zh:':'en:')+page.path,url:origin+(zh?page.zhPath:page.path),locale:zh?'zh-Hans':'en-AU',page_type:page.type,service_group:page.group,
  commercial_owner_url:page.owner?origin+localPath(page.owner,zh):null,
  primary_parent_url:page.parent?origin+localPath(page.parent,zh):null,
  breadcrumb_label:zh?page.zh:page.en,alternate_url:origin+(zh?page.path:page.zhPath),selection_basis:page.basis,
  query_group:page.queries||[],related_owner_urls:(page.relatedOwners||[]).map(p=>origin+localPath(p,zh)),
  resources:(page.resources||[]).map(resource=>{
    const target=map.pages.find(p=>p.path===resource.path.split('#')[0]);
    return {url:origin+localPath(resource.path,zh),label:zh?(resource.zh||target.zh):(resource.en||target.en)};
  })
})));
function validateMap(entries){
  const issues=[],lookup=new Map(entries.map(r=>[r.url,r]));
  if(lookup.size!==entries.length)issues.push('Duplicate page URL');
  for(const entry of entries){
    for(const value of [entry.url,entry.primary_parent_url,entry.commercial_owner_url,entry.alternate_url,...entry.related_owner_urls].filter(Boolean)){
      let u;try{u=new URL(value);}catch{issues.push('Invalid URL: '+value);continue;}
      if(u.origin!==origin||u.search||u.hash)issues.push('Unsafe page destination: '+value);
      if(!lookup.has(value))issues.push('Missing mapped page: '+value);
    }
    const parent=lookup.get(entry.primary_parent_url),owner=lookup.get(entry.commercial_owner_url),alternate=lookup.get(entry.alternate_url);
    if(parent&&parent.locale!==entry.locale)issues.push('Parent language mismatch: '+entry.url);
    if(owner&&(owner.locale!==entry.locale||!['service','homepage'].includes(owner.page_type)))issues.push('Invalid commercial owner: '+entry.url);
    for(const value of entry.related_owner_urls){
      const related=lookup.get(value);
      if(!related||related.locale!==entry.locale||!['service','homepage'].includes(related.page_type))issues.push('Invalid related owner: '+value);
    }
    for(const resource of entry.resources){
      let target;try{target=new URL(resource.url);}catch{issues.push('Invalid resource URL');continue;}
      const related=lookup.get(target.origin+target.pathname);
      if(!resource.label||target.origin!==origin||target.search||!related||related.locale!==entry.locale)issues.push('Invalid resource: '+resource.url);
    }
    if(alternate&&(alternate.alternate_url!==entry.url||alternate.locale===entry.locale))issues.push('Invalid language pair: '+entry.url);
    const seen=new Set([entry.url]);let next=entry.primary_parent_url;
    while(next){if(seen.has(next)){issues.push('Parent cycle: '+entry.url);break;}seen.add(next);next=lookup.get(next)?.primary_parent_url;}
    if(entry.page_type!=='homepage'&&!parent)issues.push('Missing parent: '+entry.url);
    if(!entry.breadcrumb_label||!entry.selection_basis)issues.push('Missing label or evidence: '+entry.url);
  }
  return issues;
}
function trail(record,entries=records){
  const lookup=new Map(entries.map(r=>[r.url,r])),result=[record],seen=new Set([record.url]);
  let parent=record.primary_parent_url;
  while(parent){if(seen.has(parent)||!lookup.has(parent))throw Error('Invalid navigation hierarchy');const item=lookup.get(parent);result.unshift(item);seen.add(parent);parent=item.primary_parent_url;}
  return result;
}
function breadcrumbs(record,entries){
  const list=trail(record,entries),zh=record.locale==='zh-Hans';
  if(list.length<2)return '';
  return `<nav class="breadcrumbs" data-breadcrumb data-owner-id="${escape(record.service_group)}" aria-label="${zh?'面包屑导航':'Breadcrumb'}"><ol>${list.map((item,i)=>`<li>${i<list.length-1?`<a href="${escape(item.url)}" data-breadcrumb-position="${i+1}">${escape(item.breadcrumb_label)}</a>`:`<span aria-current="page">${escape(item.breadcrumb_label)}</span>`}</li>`).join('')}</ol></nav>`;
}
function insert(html,selector,markup,mode='before'){
  const doc=cheerio.load(html,{sourceCodeLocationInfo:true});const node=doc(selector).first()[0];
  if(!node?.sourceCodeLocation)throw Error('Navigation insertion target missing: '+selector);
  const location=node.sourceCodeLocation;
  const at=mode==='after'?location.endOffset:location.startOffset;
  return html.slice(0,at)+markup+html.slice(at);
}
const generated=(name,markup)=>`<!-- service-navigation:${name}:start -->${markup}<!-- service-navigation:${name}:end -->`;
function guideActions(record,entries){
  const zh=record.locale==='zh-Hans';const owners=record.related_owner_urls.length?record.related_owner_urls:[record.commercial_owner_url];
  const links=owners.filter(Boolean).map(url=>{const owner=entries.find(r=>r.url===url);return `<a class="button" href="${escape(url)}">${escape(owner.page_type==='homepage'?(zh?'我们的屋顶维修服务':'Our roof repair services'):owner.breadcrumb_label)}</a>`;});
  links.push(`<a class="button button--ghost" href="${origin}${zh?'/zh/contact.html':'/contact.html'}#quote-form">${zh?'咨询与报价':'Request a quote'}</a>`);
  links.push(`<a class="button button--ghost" href="tel:+61434276883">${zh?'致电':'Call'} 0434 276 883</a>`);
  return `<div class="guide-service-entry"><p>${zh?'我们现场检查屋顶问题，说明维修或维护范围，再提供书面报价。':'We assess your roof on site, explain the repair or maintenance scope and provide a written quote.'}</p><div class="service-hero-actions hero-actions">${links.join('')}</div></div>`;
}
function resources(record,entries){
  const zh=record.locale==='zh-Hans';const children=entries.filter(r=>r.primary_parent_url===record.url&&r.page_type==='guide');
  const links=new Map(record.resources.map(r=>[r.url,r.label]));for(const child of children)links.set(child.url,child.breadcrumb_label);
  if(!links.size)return '';
  return `<section class="service-resources shell" aria-labelledby="service-resources-title"><h2 id="service-resources-title">${escape(record.breadcrumb_label)} · ${zh?'指南与照片':'guides and photos'}</h2><div class="service-resources__links">${[...links].map(([url,label])=>`<a href="${escape(url)}">${escape(label)}<span aria-hidden="true"> ↗</span></a>`).join('')}</div><p>${zh?'我们根据现场状况确认工作范围。':'We confirm the work from your roof’s condition on site.'} <a href="${origin}${zh?'/zh/contact.html':'/contact.html'}#quote-form">${zh?'咨询我们的屋顶服务':'Discuss your roof with us'}</a></p></section>`;
}
function renderPage(input,record,entries=records){
  let html=input.replace(/<!-- service-navigation:([\w-]+):start -->[\s\S]*?<!-- service-navigation:\1:end -->/g,'');
  // Replace, rather than stack, the old breadcrumb nodes; all other entities survive.
  html=html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,(script,source)=>{
    const data=JSON.parse(source),graph=data['@graph']||[data];
    const filtered=graph.filter(n=>n['@type']!=='BreadcrumbList');
    for(const item of filtered)if(item.breadcrumb)delete item.breadcrumb;
    if(filtered.length===0)return '';
    return script.replace(source,json(data['@graph']?{...data,'@graph':filtered}:filtered[0]));
  });
  if(record.page_type==='homepage')return html;
  // Retire only the old decorative route text next to H1, not article bylines.
  const doc=cheerio.load(html,{sourceCodeLocationInfo:true}),h1=doc('main h1').first();
  const old=h1.parent().children('p.crumb,p.eyebrow').first()[0];
  if(old?.sourceCodeLocation){const loc=old.sourceCodeLocation;html=html.slice(0,loc.startOffset)+html.slice(loc.endOffset);}
  const items=trail(record,entries).map((r,i)=>({'@type':'ListItem',position:i+1,name:r.breadcrumb_label,item:r.url}));
  const breadcrumb={'@type':'BreadcrumbList','@id':record.url+'#breadcrumb',itemListElement:items};
  let attached=false;
  html=html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,(script,source)=>{
    const data=JSON.parse(source);if(attached||!data['@graph'])return script;
    const page=data['@graph'].find(n=>n.url===record.url&&['WebPage','AboutPage','ContactPage','CollectionPage'].includes(n['@type']));
    if(!page)return script;
    page.breadcrumb={'@id':record.url+'#breadcrumb'};data['@graph'].push(breadcrumb);attached=true;return script.replace(source,json(data));
  });
  if(!attached)throw Error('Existing WebPage graph missing for '+record.url);
  html=insert(html,'main h1',generated('breadcrumb',breadcrumbs(record,entries)));
  if(record.page_type==='guide')html=insert(html,'main h1',generated('guide-actions',guideActions(record,entries)),'after');
  if(['directory','faq'].includes(record.page_type)){
    const zh=record.locale==='zh-Hans';
    const actions=`<div class="service-hero-actions hero-actions"><a class="button" href="${origin}${zh?'/zh/contact.html':'/contact.html'}#quote-form">${zh?'咨询与报价':'Request a quote'}</a><a class="button button--ghost" href="tel:+61434276883">${zh?'致电':'Call'} 0434 276 883</a></div>`;
    html=insert(html,'main h1',generated('directory-actions',actions),'after');
  }
  if(record.page_type==='service'){
    const block=generated('resources',resources(record,entries));
    const gallery=cheerio.load(html)('main > section.case-study').length;
    html=insert(html,gallery?'main > section.case-study':'main > section',block,'after');
  }
  if(record.page_type==='location'){
    html=html.replace(/(<div class="locality-service-grid">[\s\S]*?<\/section>)/,(section)=>section.replace(/<a href=/g,'<a class="button locality-service-link" href='));
  }
  return html;
}
function filename(record){const route=new URL(record.url).pathname;return route.endsWith('/')?route.slice(1)+'index.html':route.slice(1);}
function applyNavigation(output){
  const issues=validateMap(records);if(issues.length)throw Error(issues.join('\n'));
  const mapped=new Set(records.map(r=>r.url));
  // A new real page requires an explicit relationship; never silently omit it.
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
    const doc=cheerio.load(fs.readFileSync(path.join(root,file),'utf8'));
    const expected=origin+(file==='index.html'?'/':'/'+file);
    if(doc('link[rel="canonical"]').attr('href')===expected&&!/noindex|\bnone\b/i.test(doc('meta[name="robots"]').attr('content')||'')&&file!=='404.html'&&!mapped.has(expected))throw Error('Public page needs explicit navigation mapping: '+file);
  }
  for(const record of records){const target=path.join(output,filename(record));const html=fs.readFileSync(target,'utf8');
    const doc=cheerio.load(html);if(doc('link[rel="canonical"]').attr('href')!==record.url)throw Error('Non-canonical mapped page: '+record.url);
    fs.writeFileSync(target,renderPage(html,record),'utf8');
  }
  for(const record of records)for(const resource of record.resources){
    const url=new URL(resource.url),target=records.find(r=>r.url===url.origin+url.pathname);
    const doc=cheerio.load(fs.readFileSync(path.join(output,filename(target)),'utf8'));
    if(url.hash&&!doc('[id]').toArray().some(e=>doc(e).attr('id')===decodeURIComponent(url.hash.slice(1))))throw Error('Missing resource anchor: '+resource.url);
  }
}
module.exports={records,validateMap,trail,renderPage,applyNavigation,filename,origin};
