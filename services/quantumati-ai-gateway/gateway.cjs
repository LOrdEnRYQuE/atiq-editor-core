'use strict';
const crypto=require('node:crypto');
const err=(code,message)=>Object.assign(new Error(message||code),{code});
const str=x=>typeof x==='string'&&x.length>0&&x.length<=160;
function createEntitlementLedger({verifyPayment,now=Date.now}={}){
 if(typeof verifyPayment!=='function')throw new Error('verifyPayment is required');
 const purchases=new Map(),events=new Map(),requests=new Map();
 const lock=new Map();
 async function exclusive(key,fn){
  const before=lock.get(key)||Promise.resolve();let finish;
  const next=new Promise(r=>finish=r);lock.set(key,next);
  await before;try{return await fn()}finally{finish();if(lock.get(key)===next)lock.delete(key)}
 }
 const balance=tenant=>[...purchases.values()].filter(p=>p.tenantId===tenant&&p.status==='ACTIVE'&&p.expiresAt>now()).reduce((n,p)=>n+p.remaining-p.reserved,0);
 async function applyVerifiedEvent(event){
  if(!event||!str(event.eventId)||!str(event.tenantId)||!str(event.purchaseId)||!['payment.confirmed','payment.refunded','payment.chargeback'].includes(event.kind))throw err('INVALID_EVENT');
  if(!await verifyPayment(event))throw err('PAYMENT_NOT_VERIFIED');
  return exclusive('event:'+event.purchaseId,()=>{
   const prev=events.get(event.eventId);
   if(prev){if(prev.fingerprint!==JSON.stringify(event))throw err('EVENT_CONFLICT');return prev.result;}
   let result;
   if(event.kind==='payment.confirmed'){
    if(!Number.isSafeInteger(event.units)||event.units<=0||event.units>1000000||!Array.isArray(event.modelIds)||event.modelIds.length===0||!event.modelIds.every(str)||!Number.isSafeInteger(event.expiresAt)||event.expiresAt<=now())throw err('INVALID_EVENT');
    const old=purchases.get(event.purchaseId);
    if(old)throw err('PURCHASE_CONFLICT');
    const p={purchaseId:event.purchaseId,tenantId:event.tenantId,remaining:event.units,reserved:0,modelIds:[...new Set(event.modelIds)],expiresAt:event.expiresAt,status:'ACTIVE'};
    purchases.set(p.purchaseId,p);result={purchaseId:p.purchaseId,status:p.status,sourceEvent:{...event}};
   }else{
    const p=purchases.get(event.purchaseId);
    if(!p||p.tenantId!==event.tenantId)throw err('PURCHASE_NOT_FOUND');
    p.status='REVOKED';result={purchaseId:p.purchaseId,status:p.status,sourceEvent:{...event}};
   }
   events.set(event.eventId,{fingerprint:JSON.stringify(event),result});return result;
  });
 }
 function available(tenant,model){return [...purchases.values()].filter(p=>p.tenantId===tenant&&p.status==='ACTIVE'&&p.expiresAt>now()&&p.modelIds.includes(model)&&p.remaining-p.reserved>0).sort((a,b)=>a.expiresAt-b.expiresAt)}
 async function reserve(tenant,model,requestId,signature,units){
  return exclusive('tenant:'+tenant,()=>{
   const key=tenant+':'+requestId;
   const existing=requests.get(key);
   if(existing){if(existing.signature!==signature)throw err('IDEMPOTENCY_CONFLICT');return existing;}
   const p=available(tenant,model).find(x=>x.remaining-x.reserved>=units);
   if(!p)throw err('PURCHASE_REQUIRED');
   p.reserved+=units;
   const rec={key,signature,purchase:p,units,status:'PENDING',promise:null,result:null};requests.set(key,rec);return rec;
  });
 }
 async function settle(rec,outcome,result){
  return exclusive('tenant:'+rec.purchase.tenantId,()=>{
   if(rec.status!=='PENDING')return;
   rec.purchase.reserved-=rec.units;
   if(outcome==='SUCCESS'){
    rec.purchase.remaining-=rec.units;
    rec.status='DONE';rec.result=result;
   }else{rec.status='FAILED';rec.result=result;}
  });
 }
 return {applyVerifiedEvent,balance,available,reserve,settle};
}
function createModelGateway({ledger,models,providers}={}){
 if(!ledger||!Array.isArray(models)||!providers)throw new Error('ledger, models and providers required');
 const catalog=new Map(models.map(m=>[m.id,Object.freeze({...m})]));
 const freeRequests=new Map();
 function listModels(tenantId){
  return [...catalog.values()].map(m=>({
   id:m.id,label:m.label,tier:m.tier,pricingStatus:'NOT_CONFIGURED',
   access:m.tier==='free'?'AVAILABLE':ledger.available(tenantId,m.id).length?'AVAILABLE':'PURCHASE_REQUIRED'
  }));
 }
 async function chat(identity,input){
  const tenantId=identity?.tenantId;
  if(!str(tenantId)||!str(input?.requestId)||!str(input?.modelId)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>8192)throw err('INVALID_REQUEST');
  const m=catalog.get(input.modelId);
  if(!m||!['free','premium'].includes(m.tier)||!str(m.provider)||!Number.isSafeInteger(m.quotaUnits||1)|| (m.quotaUnits||1)<=0)throw err('MODEL_UNAVAILABLE');
  const provider=providers[m.provider];if(typeof provider!=='function')throw err('MODEL_UNAVAILABLE');
  const signature=crypto.createHash('sha256').update(JSON.stringify([m.id,input.prompt])).digest('hex');
  const key=tenantId+':'+input.requestId;
  let rec;
  if(m.tier==='premium'){rec=await ledger.reserve(tenantId,m.id,input.requestId,signature,m.quotaUnits||1);}
  else{
   const prev=freeRequests.get(key);
   if(prev&&prev.signature!==signature)throw err('IDEMPOTENCY_CONFLICT');
   if(prev)return prev.promise;
  }
  if(rec?.status==='RECOVERY_PENDING')throw err('REQUEST_PENDING_RECONCILIATION');
  if(rec?.status==='DONE')return rec.result;
  if(rec?.status==='FAILED')throw err(rec.result?.error||'PROVIDER_UNAVAILABLE');
  if(rec?.promise)return rec.promise;
  const run=async()=>{
   try{
    if(rec&&rec.purchase.status!=='ACTIVE')throw err('PURCHASE_REQUIRED');
    const raw=await provider({tenantId,modelId:m.id,prompt:input.prompt});
    if(typeof raw?.text!=='string'||raw.text.length>200000)throw err('PROVIDER_UNAVAILABLE');
    const result={modelId:m.id,text:raw.text,usageUnits:m.tier==='premium'?(m.quotaUnits||1):0};
    if(rec)await ledger.settle(rec,'SUCCESS',result);
    return result;
   }catch(e){
    if(rec)await ledger.settle(rec,'FAILED',{error:'PROVIDER_UNAVAILABLE'});
    if(e.code==='PURCHASE_REQUIRED')throw e;
    throw err('PROVIDER_UNAVAILABLE');
   }
  };
  const promise=run();
  if(rec)rec.promise=promise;
  else freeRequests.set(key,{signature,promise});
  return promise;
 }
 return {chat,listModels,account:tenantId=>({remainingUnits:ledger.balance(tenantId)})};
}
module.exports={createEntitlementLedger,createModelGateway};
