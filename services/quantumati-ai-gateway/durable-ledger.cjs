'use strict';
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const crypto=require('node:crypto');
const E=code=>Object.assign(new Error(code),{code});
function createDurableEntitlementLedger({filename,now=Date.now,verifyPayment}={}){
 if(typeof verifyPayment!=='function'||typeof filename!=='string'||!filename||filename===':memory:')throw Error('Durable filename and verifyPayment required');
 if(fs.existsSync(filename)&&fs.lstatSync(filename).isSymbolicLink())throw Error('Symlink database refused');
 const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
 db.exec(`CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,models TEXT NOT NULL,remaining INTEGER NOT NULL,reserved INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(key TEXT PRIMARY KEY,signature TEXT NOT NULL,purchase TEXT NOT NULL,units INTEGER NOT NULL,status TEXT NOT NULL,result TEXT);`);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const x=fn();db.exec('COMMIT');return x}catch(e){db.exec('ROLLBACK');throw e}};
 const valid=x=>typeof x==='string'&&x.length>0&&x.length<=160;
 const active=(tenant,model)=>db.prepare("SELECT * FROM purchases WHERE tenant=? AND status='ACTIVE' AND expires>? AND remaining-reserved>0 ORDER BY expires,id").all(tenant,now()).filter(p=>JSON.parse(p.models).includes(model));
 function balance(tenant){return db.prepare("SELECT COALESCE(SUM(remaining-reserved),0) AS value FROM purchases WHERE tenant=? AND status='ACTIVE' AND expires>?").get(tenant,now()).value}
 function available(tenant,model){return active(tenant,model)}
 async function applyVerifiedEvent(ev){
  if(!ev||!valid(ev.eventId)||!valid(ev.tenantId)||!valid(ev.purchaseId)||!['payment.confirmed','payment.refunded','payment.chargeback'].includes(ev.kind))throw E('INVALID_EVENT');
  if(!await verifyPayment(ev))throw E('PAYMENT_NOT_VERIFIED');
  return transaction(()=>{
   const fingerprint=JSON.stringify(ev),old=db.prepare('SELECT * FROM events WHERE id=?').get(ev.eventId);
   if(old){if(old.fingerprint!==fingerprint)throw E('EVENT_CONFLICT');return JSON.parse(old.result)}
   let result;
   if(ev.kind==='payment.confirmed'){
    if(!Number.isSafeInteger(ev.units)||ev.units<1||ev.units>1000000||!Number.isSafeInteger(ev.expiresAt)||ev.expiresAt<=now()||!Array.isArray(ev.modelIds)||!ev.modelIds.length||!ev.modelIds.every(valid))throw E('INVALID_EVENT');
    if(db.prepare('SELECT id FROM purchases WHERE id=?').get(ev.purchaseId))throw E('PURCHASE_CONFLICT');
    db.prepare('INSERT INTO purchases(id,tenant,models,remaining,reserved,expires,status) VALUES(?,?,?,?,?,?,?)').run(ev.purchaseId,ev.tenantId,JSON.stringify([...new Set(ev.modelIds)]),ev.units,0,ev.expiresAt,'ACTIVE');
    result={purchaseId:ev.purchaseId,status:'ACTIVE',sourceEvent:{...ev}};
   }else{
    const p=db.prepare('SELECT * FROM purchases WHERE id=? AND tenant=?').get(ev.purchaseId,ev.tenantId);
    if(!p)throw E('PURCHASE_NOT_FOUND');
    db.prepare("UPDATE purchases SET status='REVOKED' WHERE id=?").run(ev.purchaseId);
    result={purchaseId:ev.purchaseId,status:'REVOKED',sourceEvent:{...ev}};
   }
   db.prepare('INSERT INTO events(id,fingerprint,result) VALUES(?,?,?)').run(ev.eventId,fingerprint,JSON.stringify(result));
   return result;
  });
 }
 async function reserve(tenant,model,requestId,signature,units){
  return transaction(()=>{
   const key=tenant+':'+requestId,old=db.prepare('SELECT * FROM requests WHERE key=?').get(key);
   if(old){
    if(old.signature!==signature)throw E('IDEMPOTENCY_CONFLICT');
    if(old.status==='PENDING')return {key,signature,status:'RECOVERY_PENDING'};
    if(old.status==='DONE')return {key,signature,status:'DONE',result:JSON.parse(old.result)};
    return {key,signature,status:'FAILED',result:JSON.parse(old.result)};
   }
   const p=active(tenant,model).find(x=>x.remaining-x.reserved>=units);
   if(!p)throw E('PURCHASE_REQUIRED');
   db.prepare('UPDATE purchases SET reserved=reserved+? WHERE id=?').run(units,p.id);
   db.prepare('INSERT INTO requests(key,signature,purchase,units,status) VALUES(?,?,?,?,?)').run(key,signature,p.id,units,'PENDING');
   return {key,signature,purchase:{purchaseId:p.id,tenantId:tenant,status:p.status},units,status:'PENDING'};
  });
 }
 async function settle(rec,outcome,result){
  transaction(()=>{
   const r=db.prepare('SELECT * FROM requests WHERE key=?').get(rec.key);
   if(!r||r.status!=='PENDING')return;
   db.prepare('UPDATE purchases SET reserved=reserved-?, remaining=remaining-? WHERE id=?').run(r.units,outcome==='SUCCESS'?r.units:0,r.purchase);
   db.prepare('UPDATE requests SET status=?,result=? WHERE key=?').run(outcome==='SUCCESS'?'DONE':'FAILED',JSON.stringify(result),rec.key);
  });
 }
 let closed=false;
 return {applyVerifiedEvent,balance,available,reserve,settle,close(){if(!closed){db.close();closed=true}}};
}
module.exports={createDurableEntitlementLedger};
