'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectProductTwin,fingerprintSources}=require('../product-twin.cjs');
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'quantumati-twin-'));fs.mkdirSync(path.join(root,'.quantumati'));fs.mkdirSync(path.join(root,'src'));try{return run(root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function writeModel(root,capabilities=[{id:'login',title:'Login feature',sources:['src/login.js']}]){fs.writeFileSync(path.join(root,'.quantumati','product.json'),JSON.stringify({version:1,capabilities}))}
function writeProof(root,proof){fs.writeFileSync(path.join(root,'.quantumati','evidence.json'),JSON.stringify({version:1,proofs:[proof]}))}
function checkedProof(id,fingerprint,exitCode=0){return {capabilityId:id,fingerprint,runId:'run-123',recordedAt:'2026-10-31T20:00:00Z',exitCode}}
test('without product model state is NO_MODEL and no features are invented',()=>fixture(root=>{
 const snapshot=inspectProductTwin(root);assert.equal(snapshot.status,'NO_MODEL');assert.deepEqual(snapshot.capabilities,[]);
}));
test('existing implementation without evidence is not VERIFIED',()=>fixture(root=>{
 writeModel(root);fs.writeFileSync(path.join(root,'src','login.js'),'exports.login=()=>true');
 const s=inspectProductTwin(root);assert.equal(s.status,'INSPECTED');assert.equal(s.capabilities[0].status,'IMPLEMENTATION_FOUND');assert.equal(s.capabilities[0].verification,'NOT_VERIFIED');
}));
test('missing implementation is flagged and never marked completed',()=>fixture(root=>{
 writeModel(root);assert.equal(inspectProductTwin(root).capabilities[0].status,'MISSING_SOURCE');
}));
test('a recorded passing run remains unverified until a trusted runner exists',()=>fixture(root=>{
 writeModel(root);fs.writeFileSync(path.join(root,'src','login.js'),'ok');
 const fingerprint=fingerprintSources(root,['src/login.js']).fingerprint;writeProof(root,checkedProof('login',fingerprint));
 const s=inspectProductTwin(root).capabilities[0];
 assert.equal(s.status,'PASS_RECORDED');assert.equal(s.verification,'NOT_VERIFIED');assert.equal(s.provenance,'UNTRUSTED_WORKSPACE_FILE');
}));
test('changing source after a passing record makes evidence STALE',()=>fixture(root=>{
 writeModel(root);const p=path.join(root,'src','login.js');fs.writeFileSync(p,'ok');
 writeProof(root,checkedProof('login',fingerprintSources(root,['src/login.js']).fingerprint));
 fs.writeFileSync(p,'changed');assert.equal(inspectProductTwin(root).capabilities[0].status,'STALE');
}));
test('deleting source after recorded proof makes evidence STALE',()=>fixture(root=>{
 writeModel(root);const p=path.join(root,'src','login.js');fs.writeFileSync(p,'ok');
 writeProof(root,checkedProof('login',fingerprintSources(root,['src/login.js']).fingerprint));
 fs.unlinkSync(p);assert.equal(inspectProductTwin(root).capabilities[0].status,'STALE');
}));
test('a recorded failing run is FAILED_RECORDED, not VERIFIED',()=>fixture(root=>{
 writeModel(root);fs.writeFileSync(path.join(root,'src','login.js'),'ok');
 writeProof(root,checkedProof('login',fingerprintSources(root,['src/login.js']).fingerprint,1));
 const s=inspectProductTwin(root).capabilities[0];assert.equal(s.status,'FAILED_RECORDED');assert.equal(s.verification,'NOT_VERIFIED');
}));
test('model rejects path traversal, absolute paths and sensitive paths',()=>fixture(root=>{
 for(const source of ['../elsewhere.js','/etc/passwd','src/../../.env','src/.env','src/.git/config','src/.ENV.local']) {
  writeModel(root,[{id:'test',title:'test',sources:[source]}]);assert.equal(inspectProductTwin(root).status,'PARTIAL',source);
 }
}));
test('model refuses symlinked source even if target is inside workspace',()=>fixture(root=>{
 fs.writeFileSync(path.join(root,'src','real.js'),'ok');fs.symlinkSync('real.js',path.join(root,'src','login.js'));
 writeModel(root);assert.equal(inspectProductTwin(root).capabilities[0].status,'BLOCKED');
}));
test('model refuses symlinked .quantumati directory',()=>fixture(root=>{
 const folder=path.join(root,'.quantumati');fs.renameSync(folder,path.join(root,'real-config'));fs.symlinkSync('real-config',folder);
 assert.equal(inspectProductTwin(root).status,'PARTIAL');
}));
test('duplicate ids, invalid schemas, oversize manifest fail closed',()=>fixture(root=>{
 writeModel(root,[{id:'x',title:'First',sources:['src/a.js']},{id:'x',title:'Second',sources:['src/b.js']}]);
 assert.equal(inspectProductTwin(root).status,'PARTIAL');
 fs.writeFileSync(path.join(root,'.quantumati','product.json'),'{broken');assert.equal(inspectProductTwin(root).status,'PARTIAL');
 fs.writeFileSync(path.join(root,'.quantumati','product.json'),' '.repeat(130000));assert.equal(inspectProductTwin(root).status,'PARTIAL');
}));
test('untrusted evidence does not grant verified status even if it lies',()=>fixture(root=>{
 writeModel(root);fs.writeFileSync(path.join(root,'src','login.js'),'ok');
 const proof={...checkedProof('login',fingerprintSources(root,['src/login.js']).fingerprint),trusted:true,verified:true,issuer:'QuantumATi'};
 writeProof(root,proof);assert.equal(inspectProductTwin(root).capabilities[0].verification,'NOT_VERIFIED');
}));
test('invalid evidence file does not prevent observation of implementation',()=>fixture(root=>{
 writeModel(root);fs.writeFileSync(path.join(root,'src','login.js'),'ok');
 fs.writeFileSync(path.join(root,'.quantumati','evidence.json'),'{bad');
 const s=inspectProductTwin(root);assert.equal(s.capabilities[0].status,'IMPLEMENTATION_FOUND');assert.equal(s.status,'PARTIAL');
}));
