'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createMission, inspectMission, runMission } = require('../mission-recovery.cjs');
const NOW = Date.parse('2026-11-01T12:00:00Z');
const sha = data => createHash('sha256').update(data).digest('hex');
const temp = fn => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quantumati-recovery-'));
  const work = path.join(root, 'work');
  const storeDir = path.join(root, 'vault');
  fs.mkdirSync(work);
  const a = path.join(work, 'a.txt');
  const b = path.join(work, 'b.txt');
  fs.writeFileSync(a, 'first version');
  fs.writeFileSync(b, 'second version');
  try {
    const manifest = {
      missionId: 'demo-mission', workspaceRoot: work, branch: 'feature/demo',
      expiresAt: NOW + 1_000_000, maxActions: 5, maxFailures: 2,
      tasks: [{ id: 'a', target: a, expectedSha256: sha('first version') },
              { id: 'b', target: b, expectedSha256: sha('second version') }]
    };
    return fn({ root, work, storeDir, manifest, a, b });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
};
const start = ({ storeDir, manifest }) => createMission({ storeDir, manifest, nowMs: NOW });

test('creating a bounded mission persists task definitions and does not modify source', () => temp(ctx => {
  const before = fs.readFileSync(ctx.a);
  start(ctx);
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.grant.allowedKinds.join(','), 'read');
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[0].status, 'QUEUED');
  assert.equal(state.usage.actionCount, 0);
  assert.deepEqual(fs.readFileSync(ctx.a), before);
}));

test('one mission authorization executes multiple read-only tasks without repeated prompts', () => temp(ctx => {
  start(ctx);
  const report = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW });
  assert.equal(report.completed, 2);
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.tasks[0].receipt.sha256, sha('first version'));
  assert.equal(state.tasks[1].receipt.sha256, sha('second version'));
  assert.equal(state.tasks[0].receipt.byteCount, Buffer.byteLength('first version'));
  assert.equal(state.usage.actionCount, 2);
  assert.equal(state.approvalPrompts, 0);
}));

test('restart continues remaining task without rerunning completed task', () => temp(ctx => {
  start(ctx);
  const partial = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW, limit: 1 });
  assert.equal(partial.completed, 1);
  fs.writeFileSync(ctx.a, 'changed after completion');
  const resumed = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW + 100 });
  assert.equal(resumed.completed, 1);
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.usage.actionCount, 2);
  assert.equal(state.tasks[0].receipt.sha256, sha('first version'));
}));

test('a simulated crash after persisted claim resumes idempotent read after lease expiry', () => temp(ctx => {
  start(ctx);
  assert.throws(() => runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW,
    limit: 1, afterClaim: () => { throw new Error('simulated process crash'); } }), /simulated process crash/);
  let state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.tasks[0].status, 'RUNNING');
  const waiting = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW + 10, limit: 1 });
  assert.equal(waiting.completed, 1);
  const resumed = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW + 61_000 });
  assert.equal(resumed.completed, 1);
  state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.tasks[0].attempts, 2);
  assert.equal(state.usage.actionCount, 3);
}));

test('expiry pauses work; no stale mission grant silently renews', () => temp(ctx => {
  start(ctx);
  const r = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: ctx.manifest.expiresAt });
  assert.equal(r.completed, 0);
  assert.equal(r.status, 'PAUSED');
  assert.equal(r.reason, 'EXPIRED');
  assert.equal(inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' }).usage.actionCount, 0);
}));

test('action cap stops further unattended work', () => temp(ctx => {
  ctx.manifest.maxActions = 1;
  start(ctx);
  const r = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW });
  assert.equal(r.completed, 1);
  assert.equal(r.status, 'PAUSED');
  assert.equal(r.reason, 'ACTION_BUDGET');
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.usage.actionCount, 1);
  assert.equal(state.tasks[1].status, 'QUEUED');
}));

test('changed source is blocked, never misreported as successful', () => temp(ctx => {
  start(ctx);
  fs.writeFileSync(ctx.a, 'changed by another actor');
  const r = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW });
  assert.equal(r.completed, 1);
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.tasks[0].status, 'BLOCKED');
  assert.equal(state.tasks[0].reason, 'STALE_SOURCE');
  assert.equal(state.tasks[1].status, 'COMPLETED');
  assert.equal(state.status, 'NEEDS_ATTENTION');
}));

test('new mission cannot overwrite a prior mission with same id', () => temp(ctx => {
  start(ctx);
  assert.throws(() => start(ctx), /already exists/i);
  assert.equal(inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' }).tasks.length, 2);
}));

test('corrupted history fails closed without performing tasks', () => temp(ctx => {
  start(ctx);
  const missionDir = path.join(ctx.storeDir, 'demo-mission');
  const first = path.join(missionDir, '000001.event');
  fs.writeFileSync(first, fs.readFileSync(first, 'utf8').replace('demo-mission', 'other-mission'));
  assert.throws(() => inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' }), /integrity|corrupt/i);
  assert.throws(() => runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW }), /integrity|corrupt/i);
}));

test('sensitive file task cannot be granted', () => temp(ctx => {
  const secret = path.join(ctx.work, '.env');
  fs.writeFileSync(secret, 'fake_secret');
  ctx.manifest.tasks = [{ id: 'secret', target: secret, expectedSha256: sha('fake_secret') }];
  assert.throws(() => start(ctx), /denied|sensitive/i);
}));

test('agent-proposed arbitrary shell or payment action cannot appear in read-only mission', () => temp(ctx => {
  ctx.manifest.tasks[0] = { id: 'a', target: ctx.a, kind: 'shell', command: 'rm -rf .', expectedSha256: sha('first version') };
  assert.throws(() => start(ctx), /invalid|unsupported|read-only/i);
}));

test('crash after claim with max one action cannot retry above budget', () => temp(ctx => {
  ctx.manifest.maxActions = 1;
  start(ctx);
  assert.throws(() => runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW,
    limit: 1, afterClaim: () => { throw new Error('abort'); } }), /abort/);
  const r = runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW + 70_000 });
  assert.equal(r.completed, 0);
  assert.equal(r.status, 'PAUSED');
  assert.equal(r.reason, 'ACTION_BUDGET');
}));

test('a different Node process resumes after first worker exits', () => temp(ctx => {
  const { execFileSync } = require('node:child_process');
  start(ctx);
  runMission({ storeDir: ctx.storeDir, missionId: 'demo-mission', nowMs: NOW, limit: 1 });
  const modulePath = path.resolve(__dirname, '..', 'mission-recovery.cjs');
  const script = 'const m=require(' + JSON.stringify(modulePath) + '); const result=m.runMission({storeDir:process.argv[1],missionId:"demo-mission",nowMs:' + String(NOW + 100) + '}); process.stdout.write(JSON.stringify(result));';
  const output = execFileSync(process.execPath, ['-e', script, ctx.storeDir], { encoding:'utf8' });
  assert.equal(JSON.parse(output).completed, 1);
  const state = inspectMission({ storeDir: ctx.storeDir, missionId: 'demo-mission' });
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.usage.actionCount, 2);
}));

test('two concurrent workers claim tasks without duplicating completed read receipts', async () => {
  const { spawn } = require('node:child_process');
  const root=fs.mkdtempSync(path.join(os.tmpdir(), 'quantumati-parallel-'));
  const work=path.join(root,'work'),storeDir=path.join(root,'state');
  try {
    fs.mkdirSync(work);
    const tasks=Array.from({length:14},(_,i)=>{
      const target=path.join(work,'file'+i+'.txt');
      const contents='source-'+i;
      fs.writeFileSync(target,contents);
      return {id:'t'+i,target,expectedSha256:sha(contents)};
    });
    createMission({storeDir,nowMs:NOW,manifest:{missionId:'parallel',workspaceRoot:work,branch:'feature/concurrent',expiresAt:NOW+500000,maxActions:16,maxFailures:2,tasks}});
    const modulePath=path.resolve(__dirname,'..','mission-recovery.cjs');
    const script='const m=require('+JSON.stringify(modulePath)+');m.runMission({storeDir:process.argv[1],missionId:"parallel",nowMs:'+String(NOW)+'})';
    const child=()=>new Promise((resolve,reject)=>{
      const cp=spawn(process.execPath,['-e',script,storeDir],{stdio:['ignore','pipe','pipe']});
      let stderr='';cp.stderr.on('data',d=>{stderr+=d});
      cp.on('error',reject);
      cp.on('close',code=>code===0?resolve():reject(new Error(stderr||('Exit '+code))));
    });
    await Promise.all([child(),child()]);
    const state=inspectMission({storeDir,missionId:'parallel'});
    assert.equal(state.status,'COMPLETED');
    assert.equal(state.tasks.filter(x=>x.status==='COMPLETED').length,14);
    assert.equal(state.usage.actionCount,14);
    assert.equal(new Set(state.tasks.map(x=>x.receipt.sha256)).size,14);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('a symlink substituted after authorization is blocked, not read',()=>temp(ctx=>{
  start(ctx);
  fs.unlinkSync(ctx.a);
  fs.symlinkSync(ctx.b,ctx.a);
  runMission({storeDir:ctx.storeDir,missionId:'demo-mission',nowMs:NOW});
  const state=inspectMission({storeDir:ctx.storeDir,missionId:'demo-mission'});
  assert.equal(state.tasks[0].status,'BLOCKED');
  assert.equal(state.tasks[1].status,'COMPLETED');
}));

test('mission store refuses shared permissions',()=>temp(ctx=>{
  fs.mkdirSync(ctx.storeDir,{mode:0o777});
  if(process.platform==='win32')return;
  fs.chmodSync(ctx.storeDir,0o777);
  assert.throws(()=>start(ctx),/private/);
}));


test('private vault permissions are checked again on every resume',()=>temp(ctx=>{
  if(process.platform==='win32')return;
  start(ctx);
  fs.chmodSync(ctx.storeDir,0o755);
  assert.throws(()=>inspectMission({storeDir:ctx.storeDir,missionId:'demo-mission'}),/private/i);
  assert.throws(()=>runMission({storeDir:ctx.storeDir,missionId:'demo-mission',nowMs:NOW}),/private/i);
}));

test('event files with broadened access stop mission replay',()=>temp(ctx=>{
  if(process.platform==='win32')return;
  start(ctx);
  fs.chmodSync(path.join(ctx.storeDir,'demo-mission','000001.event'),0o644);
  assert.throws(()=>inspectMission({storeDir:ctx.storeDir,missionId:'demo-mission'}),/private|permission/i);
}));
