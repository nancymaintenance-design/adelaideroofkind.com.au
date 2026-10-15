import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { createContactHandler } = createRequire(import.meta.url)('../api/contact.js');
const valid = { name:'Test person',email:'test@example.invalid',phone:'0400 000 000',suburb:'Adelaide',service:'Roof leak',message:'Roof assessment enquiry <test>.' };
const configured = { RESEND_API_KEY:'mock-key',RESEND_FROM_EMAIL:'test@example.invalid' };
async function call({ method='POST',body=valid,headers={},env={},request=()=>{throw new Error('Unexpected provider request');} }={}) {
  const response = { headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;} };
  await createContactHandler({env,request})({method,body,headers},response);
  assert.equal(response.headers['Cache-Control'],'no-store');
  assert.equal(response.headers['X-Content-Type-Options'],'nosniff');
  return response;
}
// Catches validation or honeypot regressions causing provider calls for rejected input.
test('contact API rejects GET, oversized and invalid requests before contacting a provider', async () => {
  assert.equal((await call({method:'GET'})).code,405);
  assert.equal((await call({headers:{'content-length':'25001'}})).code,413);
  for (const body of [null,{}, {...valid,email:'invalid'},...Object.keys(valid).map(key=>({...valid,[key]:''}))]) assert.equal((await call({body})).code,400);
  assert.equal((await call()).code,503);
});
test('honeypot returns success without sending; absent or empty optional honeypot allows valid enquiries', async () => {
  assert.equal((await call({body:{website:'bot'}})).code,200);
  for (const website of [undefined,'','  ']) assert.equal((await call({body:{...valid,website},env:configured,request:async()=>({ok:true})})).code,201);
});
// Catches service rewriting, missing reply address, or unescaped user input in provider payload.
test('every visible service passes through the injected provider with escaped HTML and reply address', async () => {
  const html=readFileSync(new URL('../contact.html',import.meta.url),'utf8');
  const services=[...html.matchAll(/<option value="([^"]+)"/g)].map(([,value])=>value);
  assert.ok(services.length>=9);
  for(const service of services){
    let sent;
    const response=await call({env:{...configured,CONTACT_TO_EMAIL:'ignored@example.invalid',RESEND_TO_EMAIL:'ignored@example.invalid'},body:{...valid,service},request:async(url,options)=>{
      assert.equal(url,'https://api.resend.com/emails');
      assert.equal(options.method,'POST');
      sent=JSON.parse(options.body); return {ok:true};
    }});
    assert.equal(response.code,201);
    assert.equal(response.body.ok,true);
    assert.equal(sent.reply_to,'test@example.invalid');
    assert.deepEqual(sent.to,['ellisservicesgroup9@outlook.com']);
    assert.ok(sent.subject.includes(service));
    assert.ok(sent.text.includes(`Service: ${service}`));
    assert.ok(sent.html.includes('&lt;test&gt;'));
    assert.doesNotMatch(sent.html, /<test>/);
  }
});
test('provider rejection and transport failure return recoverable errors without claiming receipt', async () => {
  for(const request of [async()=>({ok:false}),async()=>{throw new Error('simulated offline');}]){
    const response=await call({env:configured,request});
    assert.equal(response.code,502); assert.ok(response.body.error); assert.equal(response.body.ok,undefined);
  }
});
