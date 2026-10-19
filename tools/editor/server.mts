import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,join,extname,relative,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {sourceRoot,publicRoot,pages} from './manifest.mts';
import {editorContent,checkedChanges,normalizeDraftChanges,renderPreview,hash} from './content.mts';
import {sameOrigin,authorized} from './security.mts';
import {readDraft,saveDraft,listHistory,restoreRevision,EditorError,errorCode} from './store.mts';

interface EditorOptions {host?:string;port?:number;draftRoot?:string}
const {compileClient}=createRequire(import.meta.url)('./compile-ui.cjs') as {compileClient:(root:string)=>void};
interface EditorServer {url:string;close():Promise<void>}
function record(value:unknown):Record<string,unknown> {
 if(typeof value!=='object'||value===null||Array.isArray(value))throw new EditorError(400,'草稿格式无效');
 return value as Record<string,unknown>;
}
function integer(value:unknown):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new EditorError(400,'修订格式无效');return value;
}
async function containedFile(root:string,file:string):Promise<string> {
 const base=await realpath(root),target=await realpath(resolve(root,file));
 const part=relative(base,target);
 if(!part||part.startsWith('..')||isAbsolute(part))throw new EditorError(404,'资源不存在');return target;
}
export async function startEditor({host='127.0.0.1',port=4214,draftRoot=join(sourceRoot,'.local-editor','drafts')}:EditorOptions={}):Promise<EditorServer> {
 if(host!=='127.0.0.1')throw new Error('Loopback only');
 compileClient(sourceRoot);
 const token=randomBytes(32).toString('hex');let origin='';
 function json(response:ServerResponse,status:number,value:unknown):void {
  response.writeHead(status,{'content-type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));
 }
 async function body(request:IncomingMessage):Promise<Record<string,unknown>> {
  if(request.headers['content-type']?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new EditorError(415,'请使用 JSON 格式');
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of request){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string);size+=bytes.length;if(size>1048576)throw new EditorError(413,'草稿过大');chunks.push(bytes);}
  let parsed:unknown;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new EditorError(400,'草稿格式无效');}
  return record(parsed);
 }
 const server=createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Robots-Tag','noindex, nofollow');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-src 'self'; connect-src 'self'; form-action 'none'; object-src 'none'; frame-ancestors 'self'");
  try{
   if(!sameOrigin(request,origin))throw new EditorError(403,'仅允许本地同源访问');
   const url=new URL(request.url??'/',origin),pathname=url.pathname;
   if(pathname.startsWith('/api/'))throw new EditorError(403,'本地后台不发送咨询或邮件');
   if(pathname==='/__editor/api/session'&&request.method==='GET')return json(response,200,{token});
   if(pathname.startsWith('/__editor/api/')){
    if(!authorized(request,origin,token,request.method!=='GET'))throw new EditorError(403,'会话失效，请刷新后台');
    if(pathname==='/__editor/api/pages'&&request.method==='GET')return json(response,200,pages.map(page=>({pageId:page.pageId,title:editorContent(page.pageId).fields.find(field=>field.kind==='seoTitle')?.publishedValue??page.pageId,kind:'page'})));
    const match=pathname.match(/^\/__editor\/api\/(draft|preview|history|restore|workflow)\/([^/]+)$/);
    if(!match)throw new EditorError(404,'页面不存在');
    const action=match[1],pageId=decodeURIComponent(match[2]!),model=editorContent(pageId),draft=await readDraft(draftRoot,pageId);
    if(action==='draft'&&request.method==='PUT'){
     const input=await body(request);if(input.baseHash!==model.baseHash)throw new EditorError(409,'页面基线已更新，请重新载入');
     const changes=normalizeDraftChanges(model,input.changes);
     if(draft&&draft.baseHash!==model.baseHash&&Object.keys(changes).length)throw new EditorError(409,'旧草稿需由助手核对同步，不能直接套到新页面');
     return json(response,200,await saveDraft(draftRoot,{pageId,baseHash:model.baseHash,expectedRevision:integer(input.expectedRevision),changes}));
    }
    const changes=checkedChanges(model,draft);
    if(action==='draft'&&request.method==='GET')return json(response,200,{pageId,baseHash:model.baseHash,fields:model.fields,draft,legacyDraft:false,legacyReview:[]});
    if(action==='history'&&request.method==='GET')return json(response,200,await listHistory(draftRoot,pageId));
    if(action==='workflow'&&request.method==='GET')return json(response,200,{state:Object.keys(changes).length?'needs-translation':'published',draft,proposalHash:null,chineseHash:hash(JSON.stringify(changes)),changes:model.fields.filter(field=>changes[field.id]!==undefined).map(field=>({fieldId:field.id,sourcePath:field.sourcePath,chineseBefore:field.publishedValue,chineseAfter:changes[field.id],englishBefore:field.value,englishAfter:null}))});
    if(action==='preview'&&request.method==='GET'){response.setHeader('content-type','text/html; charset=utf-8');return response.end(renderPreview(model,draft,url.searchParams.get('locale')!=='en-AU',origin));}
    if(action==='restore'&&request.method==='POST'){
     const input=await body(request);return json(response,200,await restoreRevision(draftRoot,pageId,integer(input.historyRevision),integer(input.expectedRevision),model.baseHash));
    }
    throw new EditorError(405,'方法不支持');
   }
   if(!['GET','HEAD'].includes(request.method??''))throw new EditorError(403,'本地预览禁止提交');
   const ui:Record<string,string>={'/__editor/':'editor/ui/index.html','/__editor/editor.css':'editor/ui/editor.css','/__editor/field-design.css':'editor/ui/field-design.css','/__editor/client.js':'.local-editor/ui/client.js'};
   let file:string;
   if(ui[pathname])file=await containedFile(sourceRoot,ui[pathname]!);
   else if(pathname.startsWith('/assets/')||pathname.startsWith('/data/')||['/favicon.png','/favicon.ico'].includes(pathname)){
    const decoded=decodeURIComponent(pathname).slice(1);
    if(decoded.includes('\\')||decoded.split('/').some(part=>part==='..'||part==='.')||decoded.includes('\0'))throw new EditorError(404,'资源不存在');
    file=await containedFile(publicRoot,decoded);
   }else throw new EditorError(404,'页面不存在');
   const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
   response.setHeader('content-type',mime[extname(file)]??'application/octet-stream');
   if(request.method==='HEAD')return response.end();response.end(await readFile(file));
  }catch(error){json(response,error instanceof EditorError?error.status:errorCode(error)==='ENOENT'?404:400,{error:error instanceof EditorError?error.message:'无法读取或保存，请保留输入后重试'});}
 });
 for(let attempt=0;;attempt++){
  try{await new Promise<void>((done,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);done();});});break;}
  catch(error){if(errorCode(error)!=='EADDRINUSE'||attempt>=20)throw error;port++;}
 }
 const address=server.address();if(!address||typeof address==='string')throw new Error('No address');origin=`http://127.0.0.1:${address.port}`;
 return {url:origin+'/__editor/',close:()=>new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const server=await startEditor();console.log('Adelaide Roof Kind 本地后台 '+server.url);}
