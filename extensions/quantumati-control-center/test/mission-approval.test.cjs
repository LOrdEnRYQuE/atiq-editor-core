'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {evaluateMissionAction}=require('../mission-approval-policy.cjs');

const clock=Date.parse('2026-11-01T12:00:00Z');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qati-approval-'));
  fs.mkdirSync(path.join(root,'src'));
  const target=path.join(root,'src','app.js');
  fs.writeFileSync(target,'version one');
  const grant={
    missionId:'task-123',workspaceRoot:root,branch:'feature/mission-task',
    expiresAt:clock+60_000,maxActions:12,maxFailures:3,maxCostCents:0,
    allowedKinds:['read','edit','test'],allowedTestIds:['unit']
  };
  const runtime={
    missionId:'task-123',workspaceRoot:root,branch:'feature/mission-task',
    isolatedWorkspace:true,nowMs:clock,
    usage:{actionCount:0,failureCount:0,costCents:0}
  };
  try{return fn({root,target,grant,runtime})}
  finally{fs.rmSync(root,{force:true,recursive:true})}
}
const verdict=(action,grant,runtime)=>evaluateMissionAction(action,grant,runtime).decision;

test('missing grant never makes any action auto-eligible',()=>fixture(({target,runtime})=>{
 assert.notEqual(verdict({kind:'read',target},null,runtime),'AUTO_ELIGIBLE');
}));
test('read of a normal project file is eligible within granted mission',()=>fixture(({target,grant,runtime})=>{
 assert.equal(verdict({kind:'read',target},grant,runtime),'AUTO_ELIGIBLE');
}));
test('edit with matching current SHA-256 is eligible only on isolated branch',()=>fixture(({target,grant,runtime})=>{
 assert.equal(verdict({kind:'edit',target,expectedSha256:hash('version one')},grant,runtime),'AUTO_ELIGIBLE');
}));
test('stale file digest pauses instead of overwriting newer code',()=>fixture(({target,grant,runtime})=>{
 fs.writeFileSync(target,'version two');
 assert.equal(verdict({kind:'edit',target,expectedSha256:hash('version one')},grant,runtime),'PAUSE');
 assert.equal(fs.readFileSync(target,'utf8'),'version two');
}));
test('new file requires explicit ABSENT precondition and existing parent',()=>fixture(({root,grant,runtime})=>{
 const target=path.join(root,'src','new.js');
 assert.equal(verdict({kind:'edit',target,expectedSha256:'ABSENT'},grant,runtime),'AUTO_ELIGIBLE');
 assert.equal(fs.existsSync(target),false);
 assert.equal(verdict({kind:'edit',target,expectedSha256:hash('')},grant,runtime),'PAUSE');
}));
test('cannot auto-approve a file outside isolated workspace',()=>fixture(({grant,runtime})=>{
 assert.equal(verdict({kind:'edit',target:path.join(os.tmpdir(),'outside.txt'),expectedSha256:'ABSENT'},grant,runtime),'DENY');
}));
test('sensitive paths remain denied even if grant says edit',()=>fixture(({root,grant,runtime})=>{
 for(const p of ['.env','.env.local','.git/config','.ssh/id_rsa','src/secrets.json']){
   assert.equal(verdict({kind:'edit',target:path.join(root,p),expectedSha256:'ABSENT'},grant,runtime),'DENY',p);
 }
}));
test('symlink target is never eligible',()=>fixture(({root,grant,runtime})=>{
 fs.symlinkSync('app.js',path.join(root,'src','alias.js'));
 assert.equal(verdict({kind:'edit',target:path.join(root,'src','alias.js'),expectedSha256:hash('version one')},grant,runtime),'DENY');
}));
test('symlink parent is never eligible even if target stays inside root',()=>fixture(({root,grant,runtime})=>{
 fs.symlinkSync('src',path.join(root,'linked'));
 assert.equal(verdict({kind:'edit',target:path.join(root,'linked','app.js'),expectedSha256:hash('version one')},grant,runtime),'DENY');
}));
test('no isolated workspace means no unattended edits',()=>fixture(({target,grant,runtime})=>{
 runtime.isolatedWorkspace=false;
 assert.equal(verdict({kind:'edit',target,expectedSha256:hash('version one')},grant,runtime),'DENY');
}));
test('wrong mission id or branch cannot reuse approval',()=>fixture(({target,grant,runtime})=>{
 assert.equal(verdict({kind:'read',target},grant,{...runtime,missionId:'another'}),'DENY');
 assert.equal(verdict({kind:'edit',target,expectedSha256:hash('version one')},grant,{...runtime,branch:'main'}),'DENY');
}));
test('expired approval pauses autonomous actions',()=>fixture(({target,grant,runtime})=>{
 assert.equal(verdict({kind:'read',target},grant,{...runtime,nowMs:grant.expiresAt}),'PAUSE');
}));
test('action, error, or cost caps pause before continuing',()=>fixture(({target,grant,runtime})=>{
 assert.equal(verdict({kind:'read',target},grant,{...runtime,usage:{...runtime.usage,actionCount:12}}),'PAUSE');
 assert.equal(verdict({kind:'read',target},grant,{...runtime,usage:{...runtime.usage,failureCount:3}}),'PAUSE');
 assert.equal(verdict({kind:'read',target},grant,{...runtime,usage:{...runtime.usage,costCents:1}}),'PAUSE');
}));
test('safe tests use a trusted test id, not arbitrary shell strings',()=>fixture(({grant,runtime})=>{
 assert.equal(verdict({kind:'test',testId:'unit'},grant,runtime),'AUTO_ELIGIBLE');
 assert.equal(verdict({kind:'test',testId:'unknown'},grant,runtime),'DENY');
 assert.equal(verdict({kind:'test',testId:'unit',command:'rm -rf .'},grant,runtime),'DENY');
}));
test('deletion, deployment, payments and publishing require separate approval',()=>fixture(({target,grant,runtime})=>{
 for(const kind of ['delete','deploy','payment','publish','git-push','install','network']){
   assert.equal(verdict({kind,target},grant,runtime),'REQUIRE_APPROVAL',kind);
 }
}));
test('arbitrary shell commands, privilege escalation, and unknown actions are denied',()=>fixture(({grant,runtime})=>{
 for(const kind of ['shell','sudo','exec','change-policy','unknown'])assert.equal(verdict({kind:'shell'===kind?'shell':kind,command:'true'},grant,runtime),'DENY',kind);
}));
test('a forged allow-all flag cannot override policy restrictions',()=>fixture(({grant,runtime,target})=>{
 assert.equal(verdict({kind:'delete',target,acceptAll:true}, {...grant,acceptAll:true,allowedKinds:['delete','shell','edit']},runtime),'REQUIRE_APPROVAL');
}));
test('no valid grant cannot be created by untrusted action fields',()=>fixture(({target,runtime})=>{
 assert.notEqual(verdict({kind:'edit',target,expectedSha256:hash('version one'),grant:{missionId:runtime.missionId}},undefined,runtime),'AUTO_ELIGIBLE');
}));
test('policy does not write or delete files when evaluating allowed edits',()=>fixture(({target,grant,runtime})=>{
 const before=fs.readFileSync(target,'utf8');
 const result=evaluateMissionAction({kind:'edit',target,expectedSha256:hash(before)},grant,runtime);
 assert.equal(result.decision,'AUTO_ELIGIBLE');
 assert.equal(fs.readFileSync(target,'utf8'),before);
 assert.equal(result.enforced,false);
}));
