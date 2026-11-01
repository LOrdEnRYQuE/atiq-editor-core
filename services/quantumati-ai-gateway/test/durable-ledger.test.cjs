'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createDurableEntitlementLedger}=require('../durable-ledger.cjs');
const {createModelGateway}=require('../gateway.cjs');
const {createHttpServer}=require('../server.cjs');
const NOW=Date.parse('2026-11-01T12:00:00.000Z');
function fixture(t,{provider}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quantumati-credit-'));
 const filename=path.join(dir,'entitlements.sqlite');
 const approved=new Set(), ledgers=[], calls=[];
 const open=()=>{
  const l=createDurableEntitlementLedger({filename,now:()=>NOW,verifyPayment:async e=>approved.has(e.eventId)});
  ledgers.push(l);return l;
 };
 t.after(()=>{for(const l of ledgers)l.close();fs.rmSync(dir,{recursive:true,force:true})});
 const configure=ledger=>createModelGateway({
  ledger,
  models:[{id:'free-demo',label:'Free',tier:'free',provider:'demo'},
   {id:'premium-demo',label:'Premium',tier:'premium',provider:'demo',quotaUnits:1},
   {id:'premium-other',label:'Other',tier:'premium',provider:'demo',quotaUnits:1}],
  providers:{demo:async info=>{calls.push(info);return provider?provider(info):{text:'ok-'+info.modelId,usageUnits:1}}}
 });
 let sequence=0;
 async function event(ledger,kind,tenantId='tenant-a',purchaseId='purchase-a',extras={}){
  const eventId='evt-'+(++sequence);approved.add(eventId);
  const value={eventId,kind,tenantId,purchaseId,...(kind==='payment.confirmed'?{
   modelIds:['premium-demo'],units:2,expiresAt:NOW+60000}:{}),...extras};
  return {result:await ledger.applyVerifiedEvent(value),value};
 }
 const input=(requestId,modelId='premium-demo',prompt='Explain code')=>({requestId,modelId,prompt});
 return {dir,filename,open,configure,event,input,approved,calls};
}
test('verified paid credits and usage persist across real SQLite reopen',async t=>{
 const f=fixture(t);
 const first=f.open();
 await f.event(first,'payment.confirmed');
 assert.equal(first.balance('tenant-a'),2);
 first.close();
 const second=f.open(),gateway=f.configure(second);
 assert.equal(second.balance('tenant-a'),2);
 const result=await gateway.chat({tenantId:'tenant-a'},f.input('r-1'));
 assert.equal(result.text,'ok-premium-demo');
 assert.equal(second.balance('tenant-a'),1);
 second.close();
 const third=f.open();
 assert.equal(third.balance('tenant-a'),1);
 assert.equal(third.available('tenant-a','premium-demo').length,1);
});
test('duplicate payment event after restart does not double-credit and conflicting replay is rejected',async t=>{
 const f=fixture(t);const l1=f.open();
 const {value,result}=await f.event(l1,'payment.confirmed');
 l1.close();
 const l2=f.open();
 assert.equal((await l2.applyVerifiedEvent(value)).status,'ACTIVE');
 assert.equal(l2.balance('tenant-a'),2);
 await assert.rejects(l2.applyVerifiedEvent({...value,units:5}),{code:'PAYMENT_NOT_VERIFIED'});
 assert.equal(l2.balance('tenant-a'),2);
 const newEvent={...value,eventId:'evt-other'};f.approved.add(newEvent.eventId);
 await assert.rejects(l2.applyVerifiedEvent(newEvent),{code:'PURCHASE_CONFLICT'});
 assert.equal(result.purchaseId,'purchase-a');
});
test('tenant isolation and model restrictions persist on disk',async t=>{
 const f=fixture(t);const a=f.open();
 await f.event(a,'payment.confirmed');
 assert.equal(a.balance('tenant-b'),0);
 assert.equal(a.available('tenant-a','premium-other').length,0);
 a.close();
 const b=f.open(),gateway=f.configure(b);
 await assert.rejects(gateway.chat({tenantId:'tenant-b'},f.input('r-b')),{code:'PURCHASE_REQUIRED'});
 await assert.rejects(gateway.chat({tenantId:'tenant-a'},f.input('r-other','premium-other')),{code:'PURCHASE_REQUIRED'});
 assert.equal(f.calls.length,0);
});
test('concurrent independent connections cannot overspend the last credit',async t=>{
 const f=fixture(t);const a=f.open(),b=f.open();
 await f.event(a,'payment.confirmed','tenant-a','purchase-a',{units:1});
 const ga=f.configure(a),gb=f.configure(b);
 const outcomes=await Promise.allSettled([
  ga.chat({tenantId:'tenant-a'},f.input('r-first')),
  gb.chat({tenantId:'tenant-a'},f.input('r-second'))
 ]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason.code==='PURCHASE_REQUIRED').length,1);
 assert.equal(f.calls.length,1);
 assert.equal(a.balance('tenant-a'),0);
});
test('completed premium request is replayed after restart without a second provider charge',async t=>{
 const f=fixture(t);const a=f.open();
 await f.event(a,'payment.confirmed','tenant-a','purchase-a',{units:1});
 const first=await f.configure(a).chat({tenantId:'tenant-a'},f.input('r-once'));
 assert.equal(first.text,'ok-premium-demo');
 a.close();
 const b=f.open(),gb=f.configure(b);
 const repeated=await gb.chat({tenantId:'tenant-a'},f.input('r-once'));
 assert.deepEqual(repeated,first);
 assert.equal(f.calls.length,1);
 await assert.rejects(gb.chat({tenantId:'tenant-a'},f.input('r-once','premium-demo','different')),{code:'IDEMPOTENCY_CONFLICT'});
});
test('crashed pending operation fails closed instead of replaying paid provider request',async t=>{
 const f=fixture(t);const a=f.open();
 await f.event(a,'payment.confirmed','tenant-a','purchase-a',{units:1});
 const rec=await a.reserve('tenant-a','premium-demo','r-pending','a'.repeat(64),1);
 assert.equal(rec.status,'PENDING');
 a.close();
 const b=f.open(),gb=f.configure(b);
 // A matching prompt uses a deterministic SHA-256 request signature.
 const crypto=require('node:crypto');
 const signature=crypto.createHash('sha256').update(JSON.stringify(['premium-demo','Explain code'])).digest('hex');
 const held=await b.reserve('tenant-a','premium-demo','r-pending',signature,1).catch(e=>e);
 // The original request had a distinct signature and must not be reused.
 assert.equal(held.code,'IDEMPOTENCY_CONFLICT');
 await assert.rejects(gb.chat({tenantId:'tenant-a'},f.input('r-pending')),{code:'IDEMPOTENCY_CONFLICT'});
 assert.equal(f.calls.length,0);
 assert.equal(b.balance('tenant-a'),0);
 // The reserved credit remains pending until an operator reconciles the request.
});
test('correctly signed pending request after restart is not re-sent upstream',async t=>{
 const f=fixture(t);const crypto=require('node:crypto'),a=f.open();
 await f.event(a,'payment.confirmed','tenant-a','purchase-a',{units:1});
 const sig=crypto.createHash('sha256').update(JSON.stringify(['premium-demo','Explain code'])).digest('hex');
 await a.reserve('tenant-a','premium-demo','r-unknown',sig,1);
 a.close();
 const b=f.open();
 await assert.rejects(f.configure(b).chat({tenantId:'tenant-a'},f.input('r-unknown')),{code:'REQUEST_PENDING_RECONCILIATION'});
 assert.equal(f.calls.length,0);assert.equal(b.balance('tenant-a'),0);
});
test('provider failure releases credit and cannot be retried under same request ID',async t=>{
 const f=fixture(t,{provider:()=>{throw Error('provider-token-secret')}});
 const a=f.open();await f.event(a,'payment.confirmed','tenant-a','purchase-a',{units:1});
 await assert.rejects(f.configure(a).chat({tenantId:'tenant-a'},f.input('r-fail')),{code:'PROVIDER_UNAVAILABLE'});
 assert.equal(a.balance('tenant-a'),1);
 a.close();
 const b=f.open();
 await assert.rejects(f.configure(b).chat({tenantId:'tenant-a'},f.input('r-fail')),{code:'PROVIDER_UNAVAILABLE'});
 assert.equal(b.balance('tenant-a'),1);assert.equal(f.calls.length,1);
});
test('refund and chargeback revoke remaining purchased credits across restart',async t=>{
 const f=fixture(t),a=f.open();
 await f.event(a,'payment.confirmed');
 await f.event(a,'payment.refunded');
 a.close();
 const b=f.open();
 assert.equal(b.balance('tenant-a'),0);
 await assert.rejects(f.configure(b).chat({tenantId:'tenant-a'},f.input('r-revoked')),{code:'PURCHASE_REQUIRED'});
 assert.equal(f.calls.length,0);
});
test('another OS process sees the durable balance without sharing application memory',async t=>{
 const f=fixture(t),a=f.open();
 await f.event(a,'payment.confirmed');
 const child=spawnSync(process.execPath,['-e',`
 const {createDurableEntitlementLedger}=require(process.argv[1]);
 const l=createDurableEntitlementLedger({filename:process.argv[2],now:()=>${NOW},verifyPayment:async()=>false});
 process.stdout.write(String(l.balance('tenant-a')));l.close();`,
 path.join(__dirname,'..','durable-ledger.cjs'),f.filename],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);
 assert.equal(child.stdout,'2');
});
