import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
export const sourceRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
export const publicRoot=join(sourceRoot,'dist');
const routes=[...readFileSync(join(sourceRoot,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>new URL(match[1]!).pathname);
export const pages=[...routes,'/clarity-privacy.html','/404.html'].map(route=>{
 const file=route==='/'?'index.html':route.slice(1);
 return {file,route,pageId:file};
});
export const pageIds=pages.map(page=>page.pageId);
