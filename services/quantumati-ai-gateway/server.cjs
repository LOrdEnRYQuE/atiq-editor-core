'use strict';
const http=require('node:http');
function createHttpServer({gateway,authenticate}={}){
 if(!gateway||typeof authenticate!=='function')throw new Error('gateway and authenticate required');
 return http.createServer(async(req,res)=>{
  const send=(status,body)=>{if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
  try{
   const identity=await authenticate(req);
   if(!identity||typeof identity.tenantId!=='string'||!identity.tenantId)return send(401,{error:'UNAUTHORIZED'});
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&url.pathname==='/v1/models')return send(200,{models:gateway.listModels(identity.tenantId)});
   if(req.method==='GET'&&url.pathname==='/v1/account')return send(200,gateway.account(identity.tenantId));
   if(req.method!=='POST'||url.pathname!=='/v1/chat')return send(404,{error:'NOT_FOUND'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'UNSUPPORTED_MEDIA_TYPE'});
   const chunks=[];let size=0;let tooLarge=false;
   for await(const c of req){size+=c.length;if(size>12000){tooLarge=true;break}chunks.push(c)}
   if(tooLarge)return send(413,{error:'PAYLOAD_TOO_LARGE'});
   let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(400,{error:'INVALID_JSON'})}
   const result=await gateway.chat(identity,input);return send(200,result);
  }catch(e){const map={INVALID_REQUEST:400,MODEL_UNAVAILABLE:404,IDEMPOTENCY_CONFLICT:409,PURCHASE_REQUIRED:402,PROVIDER_UNAVAILABLE:502};
   return send(map[e.code]||500,{error:map[e.code]?e.code:'INTERNAL_ERROR'});
  }
 });
}
module.exports={createHttpServer};
