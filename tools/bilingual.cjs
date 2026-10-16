const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://www.adelaideroofkind.com.au';
const localizedResources = ['feed.json','rss.xml','local-services-feed.json','local-services-rss.xml','site.webmanifest','llms.txt'];
const dictionaryDirectory = path.join(root, 'content', 'zh-Hans');
function dictionary() {
  const result={};
  if(!fs.existsSync(dictionaryDirectory))return result;
  for(const file of fs.readdirSync(dictionaryDirectory).filter(f=>f.endsWith('.json')).sort()) {
    const entries=JSON.parse(fs.readFileSync(path.join(dictionaryDirectory,file),'utf8'));
    for(const [key,value] of Object.entries(entries)) {
      const normalized=key.toLowerCase();
      if(result[normalized]&&result[normalized]!==value)throw new Error(`Conflicting Chinese translation: ${key}`);
      result[normalized]=value;
    }
  }
  return result;
}
const normalize = value => decode(value).replace(/\s+/g, ' ').trim();
function decode(value) {
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x[\da-f]+|#\d+);/gi, (whole, entity) => {
    const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ', '#39':"'"};
    return named[entity] ?? (entity.startsWith('#x') ? String.fromCodePoint(parseInt(entity.slice(2),16)) : entity.startsWith('#') ? String.fromCodePoint(Number(entity.slice(1))) : whole);
  });
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokens = html => html.match(/<!--[\s\S]*?-->|<script\b(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?<\/script\s*>|<style\b(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?<\/style\s*>|<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+/gi) || [];
const preserved = new Set(['ELLIS','Ellis','SERVICES GROUP','ELLIS SERVICES GROUP','Ellis Services Group','Ellis Services Group Pty Ltd','ELLIS SERVICES GROUP PTY LTD','Colorbond','COLORBOND','Microsoft Clarity','Instagram','Facebook','SA','AU','AUD','Australia','Adelaide','Adelaide CBD','North Adelaide','Norwood','Unley','Prospect','Kensington','Burnside','Glen Osmond','Goodwood','Glenelg','Henley Beach','Port Adelaide','Salisbury','Modbury','Campbelltown','Magill','Foothills','Inner East / Magill','Inner East','63 Pirie St','63 Pirie St, Adelaide SA 5000','63 Pirie St, Adelaide SA 5000, Australia','Roof repairs · Adelaide']);
function needsTranslation(value) {
  const text = normalize(value);
  return /[a-zA-Z]/.test(text) && !preserved.has(text) && !preserved.has(text.replace(/\s*↗$/,'')) && !/^[A-Z][A-Za-z .'-]+(?:Road|Street|St|Avenue|Ave|Crescent|Terrace|Drive|Parade|Lane|Court|Place|Way|Highway|Boulevard|Circuit|Walk|Esplanade)(?:\s*↗)?$/.test(text) && !/^(?:https?:|mailto:|tel:|www\.|[\w.+-]+@)/i.test(text) && !/^(?:AUD\s*)?[\d\s$,+–—.%-]+(?:\s*AUD)?$/.test(text);
}
const areas=['Adelaide CBD','North Adelaide','Port Adelaide','Glen Osmond','Henley Beach','Campbelltown','Kensington','Salisbury','Norwood','Prospect','Burnside','Goodwood','Glenelg','Modbury','Unley','Magill','Foothills','Adelaide'];
function template(value) {
  const variables=[];
  const key=normalize(value).replace(new RegExp('\\b('+areas.join('|')+')\\b','gi'),area=>{let i=variables.indexOf(area);if(i<0){i=variables.length;variables.push(area);}return `{area${i}}`;});
  return {key,variables};
}
const textKeys = new Set(['name','description','headline','text','caption','articleBody','serviceType']);
function schemaStrings(value, collect) {
  if (Array.isArray(value)) return value.forEach(v => schemaStrings(v, collect));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (textKeys.has(key) && typeof child === 'string') collect(child);
    else if (typeof child === 'object') schemaStrings(child, collect);
  }
}
function strings(html, collect) {
  for (const token of tokens(html)) {
    if (/^<script\b/i.test(token)) {
      if (/type=["']application\/ld\+json["']/i.test(token)) schemaStrings(JSON.parse(token.replace(/^<script\b[^>]*>/i,'').replace(/<\/script\s*>$/i,'')),collect);
    } else if (/^<(?:style\b|!--)/i.test(token)) continue;
    else if (!token.startsWith('<')) collect(token);
    else {
      for (const match of token.matchAll(/\b(alt|title|placeholder|aria-label)\s*=\s*(["'])([\s\S]*?)\2/gi)) collect(match[3]);
      if (/^<meta\b/i.test(token) && /(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["']/i.test(token)) {
        const content = token.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i); if(content) collect(content[2]);
      }
    }
  }
}
function documents() {
  const entries = fs.readdirSync(root).filter(name => name.endsWith('.html')).sort().map(name => ({name, html:fs.readFileSync(path.join(root,name),'utf8')}));
  const privacy = path.join(root,'content','clarity-privacy.en.html');
  if (fs.existsSync(privacy)) entries.push({name:'clarity-privacy.html',html:fs.readFileSync(privacy,'utf8')});
  return entries;
}
// Conservative manual-review gate: both language branches and API contracts are
// fingerprinted together. Even non-copy edits require an explicit review, rather
// than guessing which JavaScript expressions can eventually render user text.
const dynamicReviewFile=path.join(root,'content','dynamic-i18n-review.json');
function dynamicFingerprints() {
  const result={};
  const hash=value=>createHash('sha256').update(value.replace(/\r\n/g,'\n')).digest('hex');
  function scan(directory) {
    for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const relative=directory+'/'+entry.name;
      if(entry.isDirectory())scan(relative);
      else if(/\.[cm]?js$/.test(entry.name))result[relative]=hash(fs.readFileSync(path.join(root,relative),'utf8'));
    }
  }
  for(const directory of ['assets/js','api','clarity-assets'])scan(directory);
  for(const doc of documents()) {
    const scripts=tokens(doc.html).filter(token=>/^<script\b/i.test(token)&&!/type=["']application\/(?:ld\+)?json["']/i.test(token)).map(token=>token.replace(/^<script\b[^>]*>/i,'').replace(/<\/script\s*>$/i,'').trim()).filter(Boolean);
    if(scripts.length)result['inline:'+doc.name]=hash(scripts.join('\n'));
  }
  return result;
}
function validateDynamicReview() {
  const current=dynamicFingerprints();
  const reviewed=fs.existsSync(dynamicReviewFile)?JSON.parse(fs.readFileSync(dynamicReviewFile,'utf8')).fingerprints:{};
  const changed=[...new Set([...Object.keys(current),...Object.keys(reviewed||{})])].filter(key=>current[key]!==reviewed?.[key]);
  if(changed.length)throw new Error(`Dynamic bilingual review required: ${changed.join(', ')}. Review English/Chinese UI and API message mappings, then run node tools/bilingual.cjs review-dynamic --confirm-reviewed.`);
  return Object.keys(current).length;
}
function canonical(html, name) {
  const found = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
  return found ? new URL(found).pathname : name === 'index.html' ? '/' : '/'+name;
}
const zhPath = route => route === '/' ? '/zh/' : '/zh'+route;
function alternates(route) {
  return `<link rel="alternate" hreflang="en-AU" href="${origin}${route}">\n<link rel="alternate" hreflang="zh-Hans" href="${origin}${zhPath(route)}">\n<link rel="alternate" hreflang="x-default" href="${origin}${route}">`;
}
function english(html,name) {
  const route=canonical(html,name);
  html=html.replace(/\s*<!-- bilingual:start -->[\s\S]*?<!-- bilingual:end -->\s*/g,'\n');
  html=html.replace(/<a\b[^>]*\bdata-language-switch\b[^>]*>[\s\S]*?<\/a>\s*/g,'');
  html=html.replace(/(<nav\b[\s\S]*?<a\b[^>]*href=["']\/?contact\.html["'][^>]*>Contact<\/a>)/i,`$1\n<a class="language-switch" data-language-switch lang="zh-Hans" hreflang="zh-Hans" href="${zhPath(route)}">中文服务</a>`);
  const self=(name==='index.html'?'/':'/'+name)===route;
  const tags=(self&&name!=='404.html'?alternates(route)+'\n':'')+'<link rel="stylesheet" href="/assets/css/bilingual.css">';
  return html.replace(/<\/head>/i,`<!-- bilingual:start -->\n${tags}\n<!-- bilingual:end -->\n</head>`);
}
function catalog() {
  const values=new Map();
  for(const doc of documents().filter(d=>d.name==='404.html'||canonical(d.html,d.name)===(d.name==='index.html'?'/':'/'+d.name)))strings(doc.html,value=>{
    const text=normalize(value);if(!needsTranslation(text))return;
    const {key}=template(text);
    if(!values.has(key.toLowerCase()))values.set(key.toLowerCase(),{en:key,example:text,pages:[]});
    const entry=values.get(key.toLowerCase());if(!entry.pages.includes(doc.name))entry.pages.push(doc.name);
  });
  return [...values.values()];
}
function translate(value,dictionary,missing) {
  const text=normalize(value);if(!needsTranslation(text))return decode(value);
  const {key,variables}=template(value);
  const translated=dictionary[key.toLowerCase()];
  if(typeof translated!=='string'||!translated.trim()){missing.add(key);return decode(value);}
  const expected=[...key.matchAll(/\{area\d+\}/g)].map(m=>m[0]).sort();
  const actual=[...translated.matchAll(/\{area\d+\}/g)].map(m=>m[0]).sort();
  if(expected.join()!==actual.join())throw new Error(`Translation lost a locality placeholder: ${key}`);
  return translated.replace(/\{area(\d+)\}/g,(_,i)=>variables[Number(i)]?.toLowerCase()==='adelaide'?'阿德莱德':variables[Number(i)]||'');
}
function localUrl(value,known) {
  const url=new URL(decode(value),origin+'/');
  if(url.origin!==origin)return decode(value);
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(localizedResources.includes(name))return '/zh/'+name+url.search+url.hash;
  if(known.has(name))return zhPath(url.pathname==='/'||url.pathname==='/index.html'?'/':url.pathname)+url.search+url.hash;
  if(url.pathname.startsWith('/assets/')||/^\/(?:favicon|apple-touch|site\.webmanifest|feed|rss)/.test(url.pathname))return url.pathname+url.search+url.hash;
  return decode(value);
}
function localizeSchema(value,dictionary,missing,known,parentType) {
  if(Array.isArray(value))return value.map(v=>localizeSchema(v,dictionary,missing,known,parentType));
  if(!value||typeof value!=='object')return value;
  const type=value['@type']||parentType;
  const result={};
  for(const [key,child] of Object.entries(value)) {
    if(textKeys.has(key)&&typeof child==='string')result[key]=translate(child,dictionary,missing);
    else if((key==='url'||key==='@id'||key==='mainEntityOfPage'||(key==='item'&&type==='ListItem'))&&typeof child==='string'&&child.startsWith(origin)&&!/#(?:organization|website)$/.test(child)&&!['ProfessionalService','Organization','WebSite'].includes(type)) {
      const local=localUrl(child,known);result[key]=local.startsWith('/')?origin+local:local;
    }else if(key==='inLanguage')result[key]='zh-Hans';
    else result[key]=typeof child==='object'?localizeSchema(child,dictionary,missing,known,type):child;
  }
  if(['WebPage','ContactPage','AboutPage','FAQPage','Article'].includes(type))result.inLanguage='zh-Hans';
  return result;
}
function chinese(html,name,dictionary,known,missing) {
  const route=canonical(html,name);
  html=english(html,name).replace(/<html\b[^>]*\blang=["'][^"']*["']/i,'<html lang="zh-Hans"');
  html=html.replace(/<a\b[^>]*data-language-switch[^>]*>[\s\S]*?<\/a>/g,`<a class="language-switch" data-language-switch lang="en-AU" hreflang="en-AU" href="${route}">English</a>`);
  let output=tokens(html).map(token=>{
    if(/^<script\b/i.test(token)) {
      if(/type=["']application\/ld\+json["']/i.test(token))return token.replace(/(>)[\s\S]*(<\/script\s*>)$/i,(_,open,close)=>open+JSON.stringify(localizeSchema(JSON.parse(token.replace(/^<script\b[^>]*>/i,'').replace(/<\/script\s*>$/i,'')),dictionary,missing,known)).replace(/</g,'\\u003c')+close);
      return token.replace(/^<script\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/i,opening=>opening.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/gi,(_,q,value)=>`src=${q}${escape(localUrl(value,known))}${q}`));
    }
    if(/^<style\b/i.test(token))return token.replace(/url\((["']?)([^)'"\s]+)\1\)/g,(_,q,url)=>`url(${q}${localUrl(url,known)}${q})`);
    if(/^<!--/i.test(token))return token;
    if(!token.startsWith('<')) {
      if(normalize(token)==='English')return token;
      const translated=translate(token,dictionary,missing);
      return token.replace(/\S[\s\S]*\S|\S/,escape(translated.trim()));
    }
    token=token.replace(/\b(alt|title|placeholder|aria-label)\s*=\s*(["'])([\s\S]*?)\2/gi,(_,key,quote,value)=>`${key}=${quote}${escape(translate(value,dictionary,missing))}${quote}`);
    if(/^<meta\b/i.test(token)&&/(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["']/i.test(token))token=token.replace(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i,(_,q,v)=>`content=${q}${escape(translate(v,dictionary,missing))}${q}`);
    if(/^<meta\b/i.test(token)&&/property=["']og:locale["']/i.test(token))token=token.replace(/content=["'][^"']*["']/i,'content="zh_CN"');
    if(/^<link\b/i.test(token)&&/rel=["']canonical["']/i.test(token))token=token.replace(/href=["'][^"']*["']/i,`href="${origin}${zhPath(route)}"`);
    if(/^<meta\b/i.test(token)&&/property=["']og:url["']/i.test(token))token=token.replace(/content=["'][^"']*["']/i,`content="${origin}${zhPath(route)}"`);
    if(!/data-language-switch|hreflang=|rel=["']canonical["']/i.test(token))token=token.replace(/\b(href|src|action)\s*=\s*(["'])([^"']*)\2/gi,(_,key,q,value)=>value.startsWith('#')?`${key}=${q}${value}${q}`:`${key}=${q}${escape(localUrl(value,known))}${q}`);
    token=token.replace(/\bsrcset\s*=\s*(["'])([^"']*)\1/gi,(_,q,value)=>`srcset=${q}${value.split(',').map(item=>{const parts=item.trim().split(/\s+/);parts[0]=localUrl(parts[0],known);return parts.join(' ');}).join(', ')}${q}`);
    token=token.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi,(_,q,value)=>`style=${q}${value.replace(/url\((["']?)([^)'"\s]+)\1\)/g,(_,uq,url)=>`url(${uq}${localUrl(url,known)}${uq})`)}${q}`);
    return token;
  }).join('');
  return output;
}
function buildBilingual(output) {
  validateDynamicReview();
  const translations=dictionary();
  const docs=documents();const known=new Set(docs.map(d=>d.name));const missing=new Set();const generated=[];
  const pending=[];
  for(const doc of docs) {
    const route=canonical(doc.html,doc.name);const self=(doc.name==='index.html'?'/':'/'+doc.name)===route;
    let html;
    if(!self&&doc.name!=='404.html')html=`<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=${zhPath(route)}"><title>页面已迁移 | Ellis Services Group</title></head><body><p><a href="${zhPath(route)}">查看此地区的屋顶维修服务</a></p></body></html>`;
    else html=chinese(doc.html,doc.name,translations,known,missing);
    pending.push({file:path.join(output,'zh',doc.name),html});generated.push('zh/'+doc.name);
    if(doc.name==='clarity-privacy.html')pending.push({file:path.join(output,doc.name),html:english(doc.html,doc.name)});
  }
  if(missing.size)throw new Error(`Bilingual build blocked: ${missing.size} missing/stale Chinese translations. Run npm run i18n:catalog. First: ${[...missing].slice(0,3).join(' | ')}`);
  for(const entry of pending){fs.mkdirSync(path.dirname(entry.file),{recursive:true});fs.writeFileSync(entry.file,entry.html);}
  for(const feedName of ['feed.json','local-services-feed.json']) {
    const source=JSON.parse(fs.readFileSync(path.join(root,feedName),'utf8'));
    const advice=feedName==='feed.json';
    const localized={...source,title:advice?'Ellis Services Group 屋顶维护指南':'Ellis Services Group 本地屋顶服务',description:advice?'Ellis Services Group 屋顶维修与维护指南。':'Ellis Services Group 各地区屋顶维修服务。',language:'zh-Hans',home_page_url:origin+localUrl(source.home_page_url,known),feed_url:origin+'/zh/'+feedName};
    localized.items=source.items.map(item=>{
      const route=localUrl(item.url,known);const filename=new URL(item.url).pathname.slice(1)||'index.html';
      const document=pending.find(p=>p.file===path.join(output,'zh',filename))?.html;
      if(!document)throw new Error(`Feed has no Chinese page: ${item.url}`);
      const title=decode(document.match(/<title>([^<]+)<\/title>/)?.[1]||'');
      const summary=decode(document.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/)?.[1]||'');
      return {...item,id:origin+route,url:origin+route,title,summary};
    });
    fs.writeFileSync(path.join(output,'zh',feedName),JSON.stringify(localized,null,2)+'\n');
    const rssName=advice?'rss.xml':'local-services-rss.xml';
    const rss=`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escape(localized.title)}</title><link>${escape(localized.home_page_url)}</link><description>${escape(localized.description)}</description><language>zh-Hans</language>${localized.items.map(item=>`<item><title>${escape(item.title)}</title><link>${escape(item.url)}</link><guid isPermaLink="true">${escape(item.id)}</guid>${item.date_published?`<pubDate>${new Date(item.date_published).toUTCString()}</pubDate>`:''}<description>${escape(item.summary)}</description></item>`).join('')}</channel></rss>\n`;
    fs.writeFileSync(path.join(output,'zh',rssName),rss);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));
  fs.writeFileSync(path.join(output,'zh','site.webmanifest'),JSON.stringify({...manifest,name:'Ellis Services Group 屋顶服务',short_name:'Ellis 屋顶服务',lang:'zh-Hans',start_url:'/zh/'},null,2)+'\n');
  const links=docs.filter(doc=>doc.name!=='404.html'&&canonical(doc.html,doc.name)===(doc.name==='index.html'?'/':'/'+doc.name)).map(doc=>{
    const rendered=pending.find(p=>p.file===path.join(output,'zh',doc.name)).html;
    return `- [${decode(rendered.match(/<title>([^<]+)<\/title>/)?.[1]||'')} ](${origin}${zhPath(canonical(doc.html,doc.name))})`;
  });
  fs.writeFileSync(path.join(output,'zh','llms.txt'),'# Ellis Services Group\n\n> 阿德莱德屋顶维修与维护服务。\n\n'+links.join('\n')+'\n');
  const oldPrivacy=path.join(output,'clarity-privacy-zh.html');
  fs.writeFileSync(oldPrivacy,'<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/zh/clarity-privacy.html"><title>Microsoft Clarity 隐私偏好</title></head><body><a href="/zh/clarity-privacy.html">Microsoft Clarity 隐私偏好</a></body></html>');
  const sitemapFile=path.join(output,'sitemap.xml');const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  const entries=[...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)].map(m=>m[0]);
  const translated=entries.map(entry=>entry.replace(/<loc>([^<]+)<\/loc>/,(_,url)=>`<loc>${origin}${zhPath(new URL(url).pathname)}</loc>`));
  const privacyEntries=['/clarity-privacy.html','/zh/clarity-privacy.html'].map(route=>`<url><loc>${origin}${route}</loc></url>`);
  fs.writeFileSync(sitemapFile,sitemap.replace(/<\/urlset>/,translated.join('\n')+'\n'+privacyEntries.join('\n')+'\n</urlset>'));
  return {generated:[...generated,...localizedResources.map(name=>'zh/'+name),'clarity-privacy.html','clarity-privacy-zh.html'], pages:docs.length, translations:Object.keys(translations).length};
}
function validateTranslations() {
  const reviewedDynamicSources=validateDynamicReview();
  const existing=dictionary();const missing=new Set();
  for(const entry of catalog())translate(entry.example,existing,missing);
  if(missing.size)throw new Error(`Bilingual check failed: ${missing.size} missing/stale Chinese translations. Run npm run i18n:catalog.`);
  return {status:'pass',sourceStrings:catalog().length,translatedStrings:Object.keys(existing).length,reviewedDynamicSources};
}
module.exports={catalog,documents,strings,normalize,needsTranslation,english,chinese,buildBilingual,validateTranslations,zhPath,canonical};
if(require.main===module) {
  const mode=process.argv[2];
  if(mode==='review-dynamic'){
    if(process.argv[3]!=='--confirm-reviewed')throw Error('Review both languages and API mappings before passing --confirm-reviewed.');
    fs.writeFileSync(dynamicReviewFile,JSON.stringify({review:'English/Chinese dynamic UI, API status mappings and privacy interaction reviewed together.',fingerprints:dynamicFingerprints()},null,2)+'\n');
    console.log('Dynamic bilingual review fingerprints recorded.');
  }else if(mode==='catalog'){
    const existing=dictionary();
    const entries=catalog();const missing=entries.filter(entry=>!existing[entry.en.toLowerCase()]);
    const destination=path.resolve(process.argv[3]||path.join(root,'..','reports','bilingual-2026-10-16','translation-catalog-current.json'));
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(missing,null,2)+'\n');
    console.log(JSON.stringify({total:entries.length,missing:missing.length,words:missing.reduce((n,e)=>n+e.en.split(/\s+/).length,0),destination}));
  }else if(mode==='check'){
    console.log(JSON.stringify(validateTranslations()));
  }else if(mode==='sync-en'){
    for(const doc of documents())if(doc.name!=='clarity-privacy.html'){const file=path.join(root,doc.name);const result=english(doc.html,doc.name);if(result!==doc.html)fs.writeFileSync(file,result);}
    console.log('English navigation and alternate-language links synchronized.');
  }else if(mode==='build')console.log(JSON.stringify(buildBilingual(path.join(root,'dist'))));
  else throw new Error('Use catalog, sync-en or build');
}
