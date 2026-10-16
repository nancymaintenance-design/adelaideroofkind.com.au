const fs=require('node:fs/promises');
const path=require('node:path');
const {createServer}=require('node:http');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.ico':'image/x-icon'};
function previewHtml(html,chinese) {
  html=html.replace(/<!-- mel-one-clarity:start -->[\s\S]*?<!-- mel-one-clarity:end -->/g,'');
  html=html.replace(/<script\b[^>]*src=["']https:\/\/www\.googletagmanager\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,'').replace(/<script\b[^>]*>\s*(?:window\.dataLayer[\s\S]*?|function gtag[\s\S]*?)<\/script>/gi,'');
  const label=chinese?'本地预览 · 表单提交已禁用':'LOCAL PREVIEW · Enquiry submission disabled';
  const message=chinese?'本地预览不会发送咨询，请审核页面内容及交互。':'This local preview does not send enquiries. Review the page content and interactions.';
  const block=`<div data-local-preview style="position:fixed;bottom:8px;left:8px;z-index:10000;padding:6px 10px;border-radius:6px;background:#162b21;color:#fff;font:12px/1.5 sans-serif;pointer-events:none">${label}</div><script>document.addEventListener('submit',function(event){event.preventDefault();event.stopImmediatePropagation();const form=event.target;if(form instanceof HTMLFormElement){let status=form.querySelector('[data-contact-status],.form-status');if(status)status.textContent=${JSON.stringify(message)};}},true);</script>`;
  return html.replace(/<\/body>/i,block+'</body>');
}
function createPreviewServer() {
  return createServer(async(request,response)=>{
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD','Cache-Control':'no-store'}).end();return;}
    let pathname;
    try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400).end();return;}
    let relative=pathname.endsWith('/')?pathname.slice(1)+'index.html':pathname.slice(1);
    let target=path.resolve(root,relative);
    if(!target.startsWith(root+path.sep)||relative.split(/[\\/]/).some(part=>part.startsWith('.')||part==='api'))target='';
    let body,status=200;
    try{if(!target)throw Error('Not public');body=await fs.readFile(target);}catch{
      status=404;relative=pathname.startsWith('/zh/')?'zh/404.html':'404.html';
      try{body=await fs.readFile(path.join(root,relative));}catch{response.writeHead(503).end('Run npm run build first.');return;}
    }
    if(path.extname(relative)==='.html')body=Buffer.from(previewHtml(body.toString('utf8'),pathname.startsWith('/zh/')));
    response.writeHead(status,{'Content-Type':types[path.extname(relative)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:body);
  });
}
module.exports={createPreviewServer,previewHtml};
if(require.main===module){const index=process.argv.indexOf('--port');const port=Number(index<0?4174:process.argv[index+1]);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid loopback port');const server=createPreviewServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`Local bilingual preview: http://127.0.0.1:${port}/ and http://127.0.0.1:${port}/zh/ (submissions disabled)`));}
