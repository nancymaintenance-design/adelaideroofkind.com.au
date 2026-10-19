// Desktop bootstrap only; editor application code remains TypeScript.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
function sourceFingerprint(sourceRoot){
 const hash=createHash('sha256');
 const entries=[...fs.readdirSync(sourceRoot).filter(name=>name.endsWith('.html')),'assets','content','tools/bilingual.cjs','tools/build-static.cjs','tests/verify-gutter-page.cjs','clarity-site.json','clarity-install.mjs','clarity-assets','robots.txt','sitemap.xml','site.webmanifest','package.json'];
 const visit=file=>{
  if(!fs.existsSync(file))return;
  if(fs.statSync(file).isDirectory()){for(const name of fs.readdirSync(file).sort())visit(path.join(file,name));return;}
  hash.update(path.relative(sourceRoot,file));hash.update(fs.readFileSync(file));
 };
 for(const entry of entries)visit(path.join(sourceRoot,entry));
 return hash.digest('hex');
}
async function ensurePublicBuild(sourceRoot,stateRoot){
 const stamp=path.join(stateRoot,'source-stamp.json'),fingerprint=sourceFingerprint(sourceRoot);
 try{if(fs.existsSync(path.join(sourceRoot,'dist/index.html'))&&JSON.parse(fs.readFileSync(stamp,'utf8')).fingerprint===fingerprint)return false;}catch{}
 execFileSync(process.execPath,[path.join(sourceRoot,'tests/verify-gutter-page.cjs')],{cwd:sourceRoot,stdio:'inherit'});
 execFileSync(process.execPath,[path.join(sourceRoot,'tools/build-static.cjs')],{cwd:sourceRoot,stdio:'inherit'});
 execFileSync(process.execPath,[path.join(sourceRoot,'clarity-install.mjs'),'dist','clarity-site.json','clarity-assets'],{cwd:sourceRoot,stdio:'inherit'});
 fs.mkdirSync(stateRoot,{recursive:true});fs.writeFileSync(stamp,JSON.stringify({fingerprint:sourceFingerprint(sourceRoot),builtAt:new Date().toISOString()},null,2));
 return true;
}
const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}};
async function findManaged(sourceRoot,stateRoot){
 try{
  const state=JSON.parse(fs.readFileSync(path.join(stateRoot,'state.json'),'utf8')),url=new URL(state.url);
  if(state.sourceRoot!==sourceRoot||!alive(state.pid)||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/__editor/'||url.username||url.password||url.search||url.hash)return null;
  const response=await fetch(url,{signal:AbortSignal.timeout(2000)});
  return response.ok&&(await response.text()).includes('<title>Adelaide Roof Kind 本地后台</title>')?state.url:null;
 }catch{return null;}
}
async function launchManaged({sourceRoot,stateRoot=path.join(sourceRoot,'.local-editor','launcher'),port=4214,draftRoot}={}){
 sourceRoot=fs.realpathSync(sourceRoot);
 if(JSON.parse(fs.readFileSync(path.join(sourceRoot,'package.json'),'utf8')).name!=='adelaide-roof-kind-static-tests')throw Error('网站目录不匹配，未启动。');
 fs.mkdirSync(stateRoot,{recursive:true});
 const lock=path.join(stateRoot,'startup.lock');let locked=false;
 for(let attempt=0;attempt<120;attempt++){
  try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});locked=true;break;}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   let owner;try{owner=Number(fs.readFileSync(lock,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
   if(Number.isSafeInteger(owner)&&owner>0&&!alive(owner)){try{fs.unlinkSync(lock);}catch(error){if(error.code!=='ENOENT')throw error;}}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
 }
 if(!locked)throw Error('后台正在启动，请稍后再次双击。');
 try{
  await ensurePublicBuild(sourceRoot,stateRoot);
  const running=await findManaged(sourceRoot,stateRoot);if(running)return {url:running,reused:true};
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project','tsconfig.editor.json'],{cwd:sourceRoot,stdio:'inherit'});
  const {startEditor}=await import(pathToFileURL(path.join(sourceRoot,'tools/editor/server.mts')).href);
  const server=await startEditor({host:'127.0.0.1',port,...(draftRoot?{draftRoot}:{})});
  const temporary=path.join(stateRoot,'state.json.tmp');fs.writeFileSync(temporary,JSON.stringify({pid:process.pid,sourceRoot,url:server.url},null,2));fs.renameSync(temporary,path.join(stateRoot,'state.json'));
  return {url:server.url,reused:false,server};
 }finally{fs.unlinkSync(lock);}
}
module.exports={findManaged,launchManaged,ensurePublicBuild};
if(require.main===module){
 const sourceRoot=path.resolve(__dirname,'../..'),stateRoot=path.join(sourceRoot,'.local-editor','launcher');
 launchManaged({sourceRoot,stateRoot}).then(({url,reused})=>{
  fs.appendFileSync(path.join(stateRoot,'launcher.log'),`${new Date().toISOString()} ${reused?'Reused':'Started'} ${url}\n`);
  console.log(url);
  if(!process.argv.includes('--no-open')){
   const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'});browser.on('error',error=>fs.appendFileSync(path.join(stateRoot,'launcher.log'),`Browser: ${error.message}\n`));browser.unref();
  }
 }).catch(error=>{
  fs.mkdirSync(stateRoot,{recursive:true});fs.appendFileSync(path.join(stateRoot,'launcher.log'),`${new Date().toISOString()} ${error.stack}\n`);
  console.error(error.message);process.exitCode=1;
  if(!process.argv.includes('--no-open')){
   const log=path.join(stateRoot,'launcher.log').replaceAll("'","''");
   spawn('powershell.exe',['-NoProfile','-WindowStyle','Hidden','-Command',`Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('本地后台未能启动。请将以下日志发给助手：${log}','Adelaide Roof Kind 本地后台')`],{windowsHide:true,stdio:'ignore'});
  }
 });
}
