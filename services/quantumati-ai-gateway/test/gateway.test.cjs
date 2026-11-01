'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEntitlementLedger,createModelGateway}=require('../gateway.cjs');
const {createHttpServer}=require('../server.cjs');

const NOW=Date.parse('2026-11-01T12:00:00Z');
function fixture(overrides={}){
 const approved=new Set();
 const calls=[];
 const ledger=createEntitlementLedger({
   now:()=>NOW,
   verifyPayment:async event=>approved.has(event.eventId)
 });
 const providers={demo:async input=>{
   calls.push(input);
   if(overrides.provider) return overrides.provider(input);
   return {text:'Echo: '+input.prompt,usageUnits:1};
 }};
 const gateway=createModelGateway({
   ledger,
   models:[
     {id:'free-demo',label:'Demo Free',provider:'demo',tier:'free'},
     {id:'premium-demo',label:'Demo Premium',provider:'demo',tier:'premium',quotaUnits:1}
   ],
   providers
 });
 let counter=0;
 async function confirm(tenantId='tenant-a',units=2){
   const eventId='evt-'+(++counter);
   approved.add(eventId);
   return ledger.applyVerifiedEvent({eventId,kind:'payment.confirmed',tenantId,purchaseId:'purchase-'+counter,
     units,modelIds:['premium-demo'],expiresAt:NOW+86400000});
 }
 async function revoke(purchaseId,tenantId='tenant-a',kind='payment.refunded'){
   const eventId='evt-'+(++counter);
   approved.add(eventId);
   return ledger.applyVerifiedEvent({eventId,kind,tenantId,purchaseId});
 }
 async function serve(t){
   const server=createHttpServer({gateway,authenticate:async req=>{
      const token=req.headers.authorization;
      return token==='Bearer demo-a'?{tenantId:'tenant-a',userId:'user-a'}:
        token==='Bearer demo-b'?{tenantId:'tenant-b',userId:'user-b'}:null;
   }});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   t.after(()=>new Promise(resolve=>server.close(resolve)));
   return 'http://127.0.0.1:'+server.address().port;
 }
 async function send(base,body,token='demo-a'){
   const r=await fetch(base+'/v1/chat',{method:'POST',
     headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
   return {status:r.status,body:await r.json()};
 }
 return {ledger,gateway,calls,approved,confirm,revoke,serve,send};
}
const request=(requestId,modelId='premium-demo',prompt='Help build QuantumATi')=>({requestId,modelId,prompt});

test('a backend payment verifier is mandatory and a forged event cannot grant credits',async()=>{
 assert.throws(()=>createEntitlementLedger(),/verifyPayment/);
 const f=fixture();
 await assert.rejects(f.ledger.applyVerifiedEvent({
   eventId:'evt-fake',kind:'payment.confirmed',tenantId:'tenant-a',purchaseId:'p-fake',
   modelIds:['premium-demo'],units:20,expiresAt:NOW+1000
 }),{code:'PAYMENT_NOT_VERIFIED'});
 assert.equal(f.ledger.balance('tenant-a'),0);
});

test('models require authentication, distinguish free/premium and never invent prices',async t=>{
 const f=fixture();const base=await f.serve(t);
 const denied=await fetch(base+'/v1/models');
 assert.equal(denied.status,401);
 const r=await fetch(base+'/v1/models',{headers:{authorization:'Bearer demo-a'}});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.deepEqual(body.models.map(m=>m.tier),['free','premium']);
 assert.equal(body.models[1].access,'PURCHASE_REQUIRED');
 assert.equal(body.models[1].pricingStatus,'NOT_CONFIGURED');
});

test('premium usage is denied before purchase; free model still works',async t=>{
 const f=fixture();const base=await f.serve(t);
 const denied=await f.send(base,request('req-001'));
 assert.equal(denied.status,402);
 assert.equal(denied.body.error,'PURCHASE_REQUIRED');
 assert.equal(f.calls.length,0);
 const free=await f.send(base,request('req-002','free-demo','hello'));
 assert.equal(free.status,200);
 assert.equal(free.body.text,'Echo: hello');
 assert.equal(f.calls.length,1);
});

test('verified customer purchase enables premium with no upstream customer API key',async t=>{
 const f=fixture();const base=await f.serve(t);
 const payment=await f.confirm();
 assert.equal(payment.status,'ACTIVE');
 const r=await f.send(base,request('req-101'));
 assert.equal(r.status,200);
 assert.equal(r.body.modelId,'premium-demo');
 assert.equal(r.body.text,'Echo: Help build QuantumATi');
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].tenantId,'tenant-a');
 assert.equal(f.ledger.balance('tenant-a'),1);
 const acc=await fetch(base+'/v1/account',{headers:{authorization:'Bearer demo-a'}});
 assert.equal((await acc.json()).remainingUnits,1);
});

test('tenants cannot use each other premium entitlements',async t=>{
 const f=fixture();const base=await f.serve(t);
 await f.confirm('tenant-a',3);
 const other=await f.send(base,request('req-201'),'demo-b');
 assert.equal(other.status,402);
 assert.equal(f.calls.length,0);
 assert.equal(f.ledger.balance('tenant-a'),3);
});

test('duplicate concurrent requests are charged once; conflicting idempotency key rejected',async t=>{
 let release;
 const wait=new Promise(resolve=>release=resolve);
 const f=fixture({provider:async input=>{await wait;return{text:input.prompt,usageUnits:1};}});
 const base=await f.serve(t);
 await f.confirm('tenant-a',1);
 const one=f.send(base,request('req-301'));
 const two=f.send(base,request('req-301'));
 await new Promise(resolve=>setTimeout(resolve,30));
 release();
 const both=await Promise.all([one,two]);
 assert.equal(both[0].status,200);assert.equal(both[1].status,200);
 assert.equal(f.calls.length,1);assert.equal(f.ledger.balance('tenant-a'),0);
 const conflict=await f.send(base,request('req-301','premium-demo','DIFFERENT'));
 assert.equal(conflict.status,409);
});

test('exhausted credits cannot invoke a premium model or silently switch tiers',async t=>{
 const f=fixture();const base=await f.serve(t);
 await f.confirm('tenant-a',1);
 assert.equal((await f.send(base,request('req-401'))).status,200);
 const denied=await f.send(base,request('req-402'));
 assert.equal(denied.status,402);
 assert.equal(denied.body.error,'PURCHASE_REQUIRED');
 assert.deepEqual(f.calls.map(c=>c.modelId),['premium-demo']);
});

test('payment event replay is idempotent; refund/chargeback revokes premium access',async t=>{
 const f=fixture();const base=await f.serve(t);
 const paid=await f.confirm('tenant-a',2);
 assert.equal(f.ledger.balance('tenant-a'),2);
 const replay=await f.ledger.applyVerifiedEvent({...paid.sourceEvent});
 assert.equal(replay.status,'ACTIVE');
 assert.equal(f.ledger.balance('tenant-a'),2);
 await f.revoke(paid.purchaseId);
 assert.equal(f.ledger.balance('tenant-a'),0);
 const rejected=await f.send(base,request('req-501'));
 assert.equal(rejected.status,402);
});

test('provider errors fail closed, do not expose details and release unconsumed units',async t=>{
 const f=fixture({provider:async()=>{throw new Error('INTERNAL_PROVIDER_TOKEN_secret-do-not-leak');}});
 const base=await f.serve(t);await f.confirm('tenant-a',1);
 const resp=await f.send(base,request('req-601'));
 assert.equal(resp.status,502);
 assert.equal(resp.body.error,'PROVIDER_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(resp.body),/INTERNAL_PROVIDER_TOKEN/);
 assert.equal(f.ledger.balance('tenant-a'),1);
 const duplicate=await f.send(base,request('req-601'));
 assert.equal(duplicate.status,502);
 assert.equal(f.calls.length,1);
});

test('http refuses oversized requests, unknown routes, and user-provided payment grants',async t=>{
 const f=fixture();const base=await f.serve(t);
 const huge=await fetch(base+'/v1/chat',{method:'POST',headers:{
  authorization:'Bearer demo-a','content-type':'application/json'
 },body:JSON.stringify(request('req-701','free-demo','x'.repeat(20000)))});
 assert.equal(huge.status,413);
 const unknown=await fetch(base+'/v1/payment/grant',{method:'POST',headers:{authorization:'Bearer demo-a'}});
 assert.equal(unknown.status,404);
 assert.equal(f.ledger.balance('tenant-a'),0);
});
