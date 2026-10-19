import {timingSafeEqual} from 'node:crypto';
import type {IncomingMessage} from 'node:http';

export function sameOrigin(request:IncomingMessage,origin:string):boolean {
 return request.headers.host===new URL(origin).host
  &&(!request.headers.origin||request.headers.origin===origin)
  &&!['cross-site','same-site'].includes(String(request.headers['sec-fetch-site']??''));
}
export function authorized(request:IncomingMessage,origin:string,token:string,mutation=false):boolean {
 const supplied=request.headers['x-editor-token'];
 if(!sameOrigin(request,origin)||(mutation&&request.headers.origin!==origin)||typeof supplied!=='string')return false;
 const a=Buffer.from(supplied),b=Buffer.from(token);
 return a.length===b.length&&timingSafeEqual(a,b);
}
