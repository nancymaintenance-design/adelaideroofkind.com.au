import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {load,type CheerioAPI} from 'cheerio';
import type {AnyNode,Text} from 'domhandler';
import {publicRoot,pages} from './manifest.mts';
import {EditorError,type DraftRevision} from './store.mts';

export const hash=(value:string):string=>createHash('sha256').update(value).digest('hex');
export type FieldKind='text'|'alt'|'seoTitle'|'seoDescription';
interface Slot {node:AnyNode;attr?:string;kind:FieldKind;value:string}
export interface EditorField {id:string;value:string;publishedValue:string;kind:FieldKind;sourcePath:string;locked:boolean}
export interface EditorModel {pageId:string;route:string;baseHash:string;fields:EditorField[];english:string;chinese:string}
function slots($:CheerioAPI):Slot[]{
 const out:Slot[]=[];
 function walk(node:AnyNode):void{
  if(node.type==='text'){
   if(/[\p{L}]/u.test(node.data))out.push({node,kind:'text',value:node.data.trim()});
   return;
  }
  if('name' in node&&['script','style','svg','noscript'].includes(node.name))return;
  if('attribs' in node&&node.attribs.translate==='no')return;
  if('attribs' in node&&node.name==='img'&&node.attribs.alt)out.push({node,attr:'alt',kind:'alt',value:node.attribs.alt});
  if('children' in node)node.children.forEach(walk);
 }
 const main=$('main')[0];if(main)walk(main);
 const title=$('title')[0];if(title&&'children' in title&&title.children[0])out.push({node:title.children[0],kind:'seoTitle',value:$(title).text()});
 $('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').each((_,node)=>{out.push({node,attr:'content',kind:'seoDescription',value:$(node).attr('content')||''});});
 return out;
}
export function editorContent(pageId:string):EditorModel{
 const page=pages.find(page=>page.pageId===pageId);if(!page)throw new EditorError(404,'页面未登记');
 const english=readFileSync(join(publicRoot,page.file),'utf8');
 const chinese=readFileSync(join(publicRoot,'zh',page.file),'utf8');
 const en=slots(load(english)),zh=slots(load(chinese));
 if(en.length!==zh.length||en.some((slot,index)=>slot.kind!==zh[index].kind))throw new EditorError(409,`中英文结构不一致，请通知助手核对：${pageId}`);
 const fields=en.map((slot,index):EditorField=>({
  id:'field-'+index,value:slot.value,publishedValue:zh[index].value,kind:slot.kind,sourcePath:page.file+'#field-'+index,
  locked:/@|\bABN\b|\bACN\b|0434|61434276883|63 Pirie|\$\s*\d|\bAUD\b/i.test(slot.value),
 }));
 return {pageId,route:page.route,baseHash:hash(english+chinese),fields,english,chinese};
}
export function normalizeDraftChanges(model:EditorModel,input:unknown):Record<string,string>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new EditorError(400,'草稿格式无效');
 const out:Record<string,string>={};
 for(const [id,value] of Object.entries(input)){
  const field=model.fields.find(field=>field.id===id);
  if(!field||field.locked)throw new EditorError(400,'字段不可编辑，请重新载入');
  if(typeof value!=='string'||!value.trim()||value.length>20000)throw new EditorError(400,'中文内容不能为空或超过20000字');
  if(value!==field.publishedValue)out[id]=value;
 }
 return out;
}
export function checkedChanges(model:EditorModel,draft:DraftRevision|null):Record<string,string>{
 if(!draft)return {};
 if(model.baseHash!==draft.baseHash)throw new EditorError(409,'页面基线已更新，请让助手合并旧草稿，勿覆盖');
 return normalizeDraftChanges(model,draft.changes);
}
export function renderPreview(model:EditorModel,draft:DraftRevision|null,chinese:boolean,origin:string):string{
 const $=load(chinese?model.chinese:model.english),fields=slots($),changes=chinese?checkedChanges(model,draft):{};
 for(let index=0;index<fields.length;index++){
  const slot=fields[index],field=model.fields[index];
  if(changes[field.id]!==undefined){
   if(slot.attr&&'attribs' in slot.node)slot.node.attribs[slot.attr]=changes[field.id];
   else if(slot.node.type==='text'){
    const before=slot.node.data;
    slot.node.data=(before.match(/^\s*/)?.[0]||'')+changes[field.id]+(before.match(/\s*$/)?.[0]||'');
   }
  }
  if(chinese&&!field.locked&&slot.kind==='text')$(slot.node).replaceWith($('<span>').attr({'data-editor-field':field.id,tabindex:'0',role:'button','aria-label':'编辑中文',style:'display:inline;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit'}).text((slot.node as Text).data));
 }
 // The preview cannot send enquiries, execute site tracking or contact map hosts.
 $('script,iframe').remove();
 $('link[rel="canonical"],link[rel="alternate"],meta[property="og:url"]').remove();
 $('head').prepend($('<base>').attr('href',origin+'/')).append('<meta name="robots" content="noindex,nofollow"><style>[data-editor-field]:hover,[data-editor-field]:focus-visible{outline:2px solid #075873;outline-offset:2px;cursor:text}</style>');
 const bridge=`document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation()},true);document.addEventListener('click',e=>{const n=e.target.closest('[data-editor-field]');if(n){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'editor-field',id:n.dataset.editorField},new URL(document.baseURI).origin);return}if(e.target.closest('a,button,input,select,textarea')){e.preventDefault();e.stopImmediatePropagation()}},true);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-editor-field]')){e.preventDefault();parent.postMessage({type:'editor-field',id:e.target.dataset.editorField},new URL(document.baseURI).origin)}});`;
 $('body').append($('<script>').text(bridge));
 return $.html();
}
