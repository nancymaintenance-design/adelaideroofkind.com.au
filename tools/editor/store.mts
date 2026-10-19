import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pageIds} from './manifest.mts';

export interface Draft {pageId:string;revision:number;baseHash:string;changes:Record<string,string>;updatedAt:string;state:'needs-translation'}
export type DraftRevision=Draft;
export interface SaveDraftInput {pageId:string;expectedRevision:number;baseHash:string;changes:Record<string,string>}
export class EditorError extends Error {
 status:number;
 constructor(status:number,message:string){super(message);this.status=status;}
}
export function errorCode(error:unknown):string|undefined {
 return typeof error==='object'&&error!==null&&'code' in error&&typeof error.code==='string'?error.code:undefined;
}
export function assertPageId(pageId:string):void {
 if(!pageIds.includes(pageId))throw new EditorError(400,'页面未登记');
}
function validChanges(value:unknown):value is Record<string,string> {
 return typeof value==='object'&&value!==null&&!Array.isArray(value)&&Object.values(value).every(v=>typeof v==='string'&&v.length<=20000);
}
function parseDraft(raw:string,pageId:string):Draft {
 const value:unknown=JSON.parse(raw);
 if(typeof value!=='object'||value===null||!('pageId' in value)||value.pageId!==pageId||!('revision' in value)||typeof value.revision!=='number'||!Number.isSafeInteger(value.revision)||value.revision<1||!('baseHash' in value)||typeof value.baseHash!=='string'||!('changes' in value)||!validChanges(value.changes)||!('updatedAt' in value)||typeof value.updatedAt!=='string')throw new EditorError(400,'已保存草稿格式无效');
 return {pageId,revision:value.revision,baseHash:value.baseHash,changes:value.changes,updatedAt:value.updatedAt,state:'needs-translation'};
}
const queues=new Map<string,Promise<Draft>>();
export async function readDraft(root:string,pageId:string):Promise<Draft|null> {
 assertPageId(pageId);
 try{return parseDraft(await readFile(join(root,pageId+'.json'),'utf8'),pageId);}
 catch(error){if(errorCode(error)==='ENOENT')return null;throw error;}
}
export async function listHistory(root:string,pageId:string):Promise<{revision:number;updatedAt:string}[]> {
 assertPageId(pageId);let entries:string[];
 try{entries=await readdir(join(root,'history',pageId));}catch(error){if(errorCode(error)==='ENOENT')return [];throw error;}
 return Promise.all(entries.filter(n=>/^\d+\.json$/.test(n)).sort((a,b)=>parseInt(b)-parseInt(a)).slice(0,20).map(async name=>{
  const draft=parseDraft(await readFile(join(root,'history',pageId,name),'utf8'),pageId);
  return {revision:draft.revision,updatedAt:draft.updatedAt};
 }));
}
export async function restoreRevision(root:string,pageId:string,historyRevision:number,expectedRevision:number,baseHash:string):Promise<Draft> {
 assertPageId(pageId);
 if(!Number.isSafeInteger(historyRevision)||historyRevision<1)throw new EditorError(400,'历史修订无效');
 let old:Draft;
 try{old=parseDraft(await readFile(join(root,'history',pageId,historyRevision+'.json'),'utf8'),pageId);}
 catch(error){if(errorCode(error)==='ENOENT')throw new EditorError(404,'历史修订不存在');throw error;}
 if(old.baseHash!==baseHash)throw new EditorError(409,'历史页面基线已变化，需要人工核对');
 return saveDraft(root,{pageId,expectedRevision,baseHash,changes:old.changes});
}
export async function saveDraft(root:string,input:SaveDraftInput):Promise<Draft> {
 assertPageId(input.pageId);
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.baseHash!=='string'||!validChanges(input.changes))throw new EditorError(400,'草稿格式无效');
 const key=resolve(root,input.pageId),prior=queues.get(key)??Promise.resolve();
 const operation=prior.catch(()=>{}).then(async()=>{
  const old=await readDraft(root,input.pageId);
  if((old?.revision??0)!==input.expectedRevision)throw new EditorError(409,'草稿已在其他窗口更新，请保留当前文字后重新载入');
  const history=join(root,'history',input.pageId);await mkdir(history,{recursive:true});
  const recorded=(await readdir(history)).filter(n=>/^\d+\.json$/.test(n)).map(n=>parseInt(n));
  const draft:Draft={pageId:input.pageId,revision:Math.max(input.expectedRevision,...recorded)+1,baseHash:input.baseHash,changes:input.changes,updatedAt:new Date().toISOString(),state:'needs-translation'};
  const temporary=join(root,`.${randomUUID()}.tmp`),serialized=JSON.stringify(draft,null,2);
  try{
   await writeFile(temporary,serialized,{flag:'wx'});
   await writeFile(join(history,draft.revision+'.json'),serialized,{flag:'wx'});
   await rename(temporary,join(root,input.pageId+'.json'));
  }finally{await unlink(temporary).catch(error=>{if(errorCode(error)!=='ENOENT')throw error;});}
  const entries=(await readdir(history)).filter(n=>/^\d+\.json$/.test(n)).sort((a,b)=>parseInt(b)-parseInt(a));
  await Promise.all(entries.slice(20).map(n=>unlink(join(history,n))));return draft;
 });
 queues.set(key,operation);try{return await operation;}finally{if(queues.get(key)===operation)queues.delete(key);}
}
