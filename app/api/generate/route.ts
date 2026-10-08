import {getTool} from '@/lib/catalog';
import {runWorkflow,UserError} from '@/lib/core.mjs';
import {runtimeEnv} from '@/lib/server-env';
const requests=new Map<string,{count:number;until:number}>();
export async function POST(request:Request){
 let user='';
 try {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)throw new UserError('请求来源不受支持。',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new UserError('请使用 JSON 格式提交资料。',415);
  if(Number(request.headers.get('content-length')||0)>160000)throw new UserError('提交资料过长，请分批处理。',413);
  const reader=request.body?.getReader(); if(!reader)throw new UserError('请填写工作资料。');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>160000){await reader.cancel();throw new UserError('提交资料过长，请分批处理。',413);}chunks.push(value);}
  const bodyBytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bodyBytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bodyBytes));}catch{throw new UserError('提交资料格式无效。');}
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.toolId!=='string')throw new UserError('请选择有效的工具。');
  const tool=getTool(body.toolId);if(!tool)throw new UserError('找不到这个工具。',404);
  const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)workroom_user=([a-f0-9-]{36})(?:;|$)/i)?.[1];
  user=cookie||crypto.randomUUID();
  // This local limiter is a convenience guard per Worker isolate, not a durable quota system.
  const now=Date.now();for(const [id,entry]of requests)if(entry.until<now)requests.delete(id);
  const bucket=requests.get(user)||{count:0,until:now+60000};if(bucket.count>=10)throw new UserError('请求过于频繁，请一分钟后重试。',429);bucket.count++;requests.set(user,bucket);
  const result=await runWorkflow(tool,body.inputs,runtimeEnv(),`workroom_${user}`);
  return Response.json(result,{headers:{'Cache-Control':'no-store','Set-Cookie':`workroom_user=${user}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
 }catch(e){
  const known=e instanceof UserError;
  return Response.json({error:known?e.message:'暂时无法处理请求，请稍后重试。',code:known?e.code:'INTERNAL_ERROR'}, {status:known?e.status:500,headers:{'Cache-Control':'no-store'}});
 }
}
