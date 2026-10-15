import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
let server;
let base;
before(async () => {
  server = createServer(async (req, res) => {
    if (!['GET','HEAD'].includes(req.method)) return res.writeHead(405).end();
    try {
      const relative = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1) || 'index.html';
      const target = resolve(root,relative);
      if (!target.startsWith(root+sep) || relative.split(/[\\/]/).some(p=>p.startsWith('.') || p==='api')) return res.writeHead(404).end();
      const body = await readFile(target);
      res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'}).end(req.method==='HEAD'?undefined:body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server) await new Promise(ok=>server.close(ok));});

const samples = [
  ['index.html','.evidence-photos img'],
  ['metal-roof-repairs-adelaide.html','.service-project-gallery img'],
  ['roof-painting-adelaide.html','.service-project-gallery img'],
];
function webpWidth(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const kind=bytes.toString('ascii',12,16);
  if(kind==='VP8 ') return bytes.readUInt16LE(26)&0x3fff;
  if(kind==='VP8L') return 1+(((bytes[22]&0x3f)<<8)|bytes[21]);
  if(kind==='VP8X') return 1+bytes.readUIntLE(24,3);
  throw new Error(`unsupported WebP chunk ${kind}`);
}
test('mobile galleries request real smaller derivatives and decode at both DPRs', async()=>{
  const browser=await chromium.launch();
  try {
    for(const dpr of [1,2]) for(const [path,selector] of samples) {
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dpr});
      const page=await context.newPage();
      await page.goto(`${base}/${path}`,{waitUntil:'networkidle'});
      const images=page.locator(selector);
      assert.ok(await images.count()>=4,path);
      for(const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        const data=await image.evaluate(async el=>{
          await el.decode();
          return {src:el.getAttribute('src'),current:el.currentSrc,width:el.naturalWidth,display:el.getBoundingClientRect().width,alt:el.alt,srcset:el.parentElement.tagName==='PICTURE'?el.parentElement.querySelector('source').srcset:el.srcset};
        });
        assert.ok(data.current.endsWith('.webp'),`${path}: ${data.current}`);
        assert.notEqual(new URL(data.current).pathname,`/${data.src}`,`${path} DPR${dpr}: original fetched`);
        const candidate=data.srcset.split(',').map(s=>s.trim().split(/\s+/)).find(([url])=>data.current.endsWith(url));
        assert.ok(candidate,`${path}: selected candidate missing from srcset`);
        const pixels=Number(candidate[1].slice(0,-1));
        assert.ok(pixels<=720,`${path} DPR${dpr}: ${pixels}px fetched for ${data.display}px card`);
        assert.ok(pixels>=data.display*dpr*.9,`${path} DPR${dpr}: ${JSON.stringify(data)} under-resolution`);
        assert.ok(data.alt.length>10);
        if(path!=='index.html') assert.equal(await image.locator('xpath=..').locator('xpath=..').getAttribute('href').catch(()=>null),data.src,`${path}: full-size link retained`);
      }
      await context.close();
    }
  } finally {await browser.close();}
});

test('visual heroes remain eager, visible, and high priority where previously designated',async()=>{
  const browser=await chromium.launch();
  try {
    for(const width of [390,1440]) for(const path of ['metal-roof-repairs-adelaide.html','roof-painting-adelaide.html','contact.html']) {
      const page=await browser.newPage({viewport:{width,height:844}});
      await page.goto(`${base}/${path}`,{waitUntil:'networkidle'});
      const data=await page.locator('.page-hero__visual img').evaluate(async img=>{
        await img.decode();
        const bounds=img.getBoundingClientRect();
        return {src:img.currentSrc,width:bounds.width,height:bounds.height,heroHeight:img.closest('.page-hero').getBoundingClientRect().height,loading:img.loading,priority:img.fetchPriority,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.ok(data.src.endsWith('.webp') && data.width>0 && data.heroHeight>0 && Math.abs(data.height-data.heroHeight)<1,`${path}: photograph fills the natural-height hero ${JSON.stringify(data)}`);
      assert.equal(data.loading,'eager');
      assert.equal(data.priority,'high');
      assert.equal(data.overflow,false);
      await page.close();
    }
  } finally {await browser.close();}
});

test('responsive candidate metadata matches files and originals remain', async()=>{
  for(const [page] of samples) {
    const html=await readFile(resolve(root,page),'utf8');
    const tags=[...html.matchAll(/<img\s[^>]+>/g)].map(x=>x[0]).filter(x=>/assets\/images\/projects\//.test(x));
    for(const tag of tags) {
      const src=tag.match(/\bsrc="([^"]+)"/)?.[1];
      const position=html.indexOf(tag);
      const picturePrefix=html.slice(Math.max(0,position-500),position);
      const srcset=tag.match(/\bsrcset="([^"]+)"/)?.[1] || picturePrefix.match(/<picture[^>]*><source[^>]*srcset="([^"]+)"[^>]*>$/)?.[1];
      assert.ok(srcset,`${page}: missing srcset ${src}`);
      assert.ok(/\bsizes="/.test(tag) || /\bsizes="/.test(picturePrefix.slice(picturePrefix.lastIndexOf('<picture'))),`${page}: missing sizes ${src}`);
      assert.ok(/\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag));
      await stat(resolve(root,src));
      for(const [,candidate,width] of srcset.matchAll(/([^,\s]+)\s+(\d+)w/g)) {
        assert.ok(Number(width)>0);
        await stat(resolve(root,candidate));
        assert.equal(webpWidth(await readFile(resolve(root,candidate))),Number(width),`${candidate}: declared width`);
      }
    }
  }
});

test('homepage uses a small tab icon and keeps the separate Apple icon',async()=>{
  const html=await readFile(resolve(root,'index.html'),'utf8');
  assert.match(html,/rel="icon"[^>]+sizes="32x32"[^>]+href="\/favicon-32\.png"/);
  assert.match(html,/rel="apple-touch-icon"[^>]+href="\/apple-touch-icon\.png"/);
  assert.ok((await stat(resolve(root,'favicon-32.png'))).size<10_000);
  assert.ok((await stat(resolve(root,'favicon-ellis-services.png'))).size>100_000);
});
