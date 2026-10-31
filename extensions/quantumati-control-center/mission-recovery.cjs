'use strict';
/**
 * Local, read-only mission recovery prototype.
 * No agent-executable edits, arbitrary commands, network requests, payments or deployments.
 * Persisted grants are NOT cryptographically authenticated, and this module is NOT an OS sandbox.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { evaluateMissionAction, validateFileTarget } = require('./mission-approval-policy.cjs');

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const SHA = /^[a-f0-9]{64}$/;
const EVENT_FILE = /^\d{6}\.event$/;
const MAX_EVENTS = 512;
const MAX_EVENT_BYTES = 32 * 1024;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const LEASE_MS = 60_000;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (valid, message) => { if (!valid) throw new Error(message); };
const finiteInt = v => Number.isSafeInteger(v) && v >= 0;
const eventName = seq => String(seq).padStart(6, '0') + '.event';
const existingDir = p => {
  const st = fs.lstatSync(p);
  check(st.isDirectory() && !st.isSymbolicLink(), 'Invalid or linked mission store');
};
function ensureStore(storeDir) {
  check(typeof storeDir === 'string' && path.isAbsolute(storeDir), 'Mission store requires absolute path');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  existingDir(storeDir);
  if (process.platform !== 'win32') {
    check((fs.statSync(storeDir).mode & 0o077) === 0, 'Mission store must be private to the user');
  }
}
function missionFolder(storeDir, missionId) {
  check(typeof missionId === 'string' && ID.test(missionId), 'Invalid mission identifier');
  check(typeof storeDir === 'string' && path.isAbsolute(storeDir), 'Mission store requires absolute path');
  const folder = path.join(storeDir, missionId);
  existingDir(storeDir);
  existingDir(folder);
  return folder;
}
function syncDirectory(folder) {
  // File content is fsynced separately. Directory fsync is supported on tested Linux.
  const fd = fs.openSync(folder, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function safeReadEventFile(folder, name) {
  const file = path.join(folder, name);
  const st = fs.lstatSync(file);
  check(st.isFile() && !st.isSymbolicLink() && st.size > 0 && st.size <= MAX_EVENT_BYTES, 'Mission history integrity error: invalid event file');
  const contents = fs.readFileSync(file, 'utf8');
  let event;
  try { event = JSON.parse(contents); } catch { throw new Error('Mission history integrity error: invalid JSON'); }
  return event;
}
function readHistory(folder) {
  const names = fs.readdirSync(folder).filter(n => EVENT_FILE.test(n)).sort();
  check(names.length > 0 && names.length <= MAX_EVENTS, 'Mission history integrity error: missing or oversized history');
  const events = [];
  let prevHash = 'GENESIS';
  for (let i = 0; i < names.length; i++) {
    const seq = i + 1;
    check(names[i] === eventName(seq), 'Mission history integrity error: event sequence gap');
    const entry = safeReadEventFile(folder, names[i]);
    check(entry && entry.schemaVersion === 1 && entry.seq === seq && entry.prevHash === prevHash,
      'Mission history integrity error: sequence or predecessor mismatch');
    const { hash, ...withoutHash } = entry;
    check(typeof hash === 'string' && digest(JSON.stringify(withoutHash)) === hash,
      'Mission history integrity error: event hash mismatch');
    events.push(entry);
    prevHash = entry.hash;
  }
  return events;
}
function appendCAS(folder, events, proposal) {
  const seq = events.length + 1;
  check(seq <= MAX_EVENTS, 'Mission history is full');
  const record = {
    schemaVersion: 1,
    seq,
    prevHash: seq === 1 ? 'GENESIS' : events[events.length - 1].hash,
    type: proposal.type,
    atMs: proposal.atMs,
    payload: proposal.payload
  };
  const event = { ...record, hash: digest(JSON.stringify(record)) };
  const raw = JSON.stringify(event);
  check(Buffer.byteLength(raw) <= MAX_EVENT_BYTES, 'Mission event exceeds size limit');
  const tempPath = path.join(folder, '.' + randomUUID() + '.pending');
  const destination = path.join(folder, eventName(seq));
  let linked = false;
  const fd = fs.openSync(tempPath, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, raw);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  try {
    try {
      // Hard-link creates final numbered event atomically without overwriting a rival writer.
      fs.linkSync(tempPath, destination);
      linked = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (linked) syncDirectory(folder);
  } finally {
    fs.unlinkSync(tempPath);
  }
  return linked;
}
function reconstruct(events, missionId) {
  const initial = events[0];
  check(initial.type === 'CREATE' && initial.payload?.grant?.missionId === missionId,
    'Mission history integrity error: missing genesis or mission mismatch');
  const grant = initial.payload.grant;
  check(grant.allowedKinds?.length === 1 && grant.allowedKinds[0] === 'read' && grant.maxCostCents === 0,
    'Mission history integrity error: unsupported grant type');
  const tasks = initial.payload.tasks.map(t => ({...t,status:'QUEUED',attempts:0,receipt:null,reason:null,claimId:null,leaseUntil:null}));
  const byId = new Map(tasks.map(t => [t.id, t]));
  check(byId.size === tasks.length, 'Mission history integrity error: duplicate tasks');
  const usage = { actionCount: 0, failureCount: 0, costCents: 0 };
  for (const event of events.slice(1)) {
    const p = event.payload;
    const task = byId.get(p?.taskId);
    check(task, 'Mission history integrity error: unknown task');
    if (event.type === 'CLAIM') {
      check(task.status === 'QUEUED' || (task.status === 'RUNNING' && task.leaseUntil <= event.atMs),
        'Mission history integrity error: overlapping claim');
      check(typeof p.claimId === 'string' && p.leaseUntil === event.atMs + LEASE_MS,
        'Mission history integrity error: invalid claim');
      task.status = 'RUNNING';
      task.claimId = p.claimId;
      task.leaseUntil = p.leaseUntil;
      task.attempts += 1;
      usage.actionCount += 1;
    } else if (event.type === 'COMPLETE' || event.type === 'BLOCK') {
      check(task.status === 'RUNNING' && task.claimId === p.claimId,
        'Mission history integrity error: stale claim completed or blocked');
      task.status = event.type === 'COMPLETE' ? 'COMPLETED' : 'BLOCKED';
      if (event.type === 'COMPLETE') {
        check(typeof p.receipt?.sha256 === 'string' && SHA.test(p.receipt.sha256) && finiteInt(p.receipt.byteCount),
          'Mission history integrity error: invalid receipt');
        task.receipt = p.receipt;
      } else {
        check(typeof p.reason === 'string' && /^([A-Z_]){1,40}$/.test(p.reason),
          'Mission history integrity error: invalid pause reason');
        task.reason = p.reason;
        usage.failureCount += 1;
      }
      task.claimId = null;
      task.leaseUntil = null;
    } else {
      throw new Error('Mission history integrity error: unexpected event type');
    }
    check(usage.actionCount <= grant.maxActions && usage.failureCount <= grant.maxFailures,
      'Mission history integrity error: budget exceeded');
  }
  const allDone = tasks.every(t => t.status === 'COMPLETED');
  const blocked = tasks.some(t => t.status === 'BLOCKED');
  const running = tasks.some(t => t.status === 'RUNNING');
  return {
    missionId, grant, tasks, usage, sequence: events.length, lastHash: events[events.length - 1].hash,
    status: allDone ? 'COMPLETED' : blocked ? 'NEEDS_ATTENTION' : running ? 'RUNNING' : 'READY',
    approvalPrompts: 0, // local worker never presents approvals; not a measured desktop UI value
    releaseReady: false
  };
}
function load(storeDir, missionId) {
  const folder = missionFolder(storeDir, missionId);
  const events = readHistory(folder);
  return { folder, events, state: reconstruct(events, missionId) };
}
function transact(storeDir, missionId, decide) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const loaded = load(storeDir, missionId);
    const choice = decide(loaded.state);
    if (!choice.event) return choice.output;
    if (appendCAS(loaded.folder, loaded.events, choice.event)) return choice.output;
  }
  throw new Error('Concurrent mission update: retry later');
}
function createMission({ storeDir, manifest, nowMs = Date.now() }) {
  check(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Invalid mission manifest');
  const allowed = ['missionId','workspaceRoot','branch','expiresAt','maxActions','maxFailures','tasks'];
  check(Object.keys(manifest).every(k => allowed.includes(k)), 'Invalid mission manifest fields');
  const {missionId, workspaceRoot, branch, expiresAt, maxActions, maxFailures, tasks} = manifest;
  check(typeof missionId === 'string' && ID.test(missionId), 'Invalid mission id');
  check(typeof branch === 'string' && branch.startsWith('feature/') && !branch.includes('..'), 'Invalid isolated mission branch');
  check(typeof workspaceRoot === 'string' && path.isAbsolute(workspaceRoot), 'Invalid workspace root');
  check(finiteInt(nowMs) && finiteInt(expiresAt) && expiresAt > nowMs, 'Invalid or expired mission deadline');
  check(finiteInt(maxActions) && maxActions > 0 && maxActions <= 128, 'Invalid action budget');
  check(finiteInt(maxFailures) && maxFailures > 0 && maxFailures <= 32, 'Invalid failure budget');
  check(Array.isArray(tasks) && tasks.length > 0 && tasks.length <= 64, 'Invalid task count');
  const grant = {
    missionId, workspaceRoot, branch, expiresAt, maxActions, maxFailures,
    maxCostCents: 0, allowedKinds: ['read'], allowedTestIds: []
  };
  const runtime = {
    missionId, workspaceRoot, branch, isolatedWorkspace: true, nowMs,
    usage: { actionCount: 0, failureCount: 0, costCents: 0 }
  };
  const seen = new Set();
  const validatedTasks = tasks.map(task => {
    check(task && typeof task === 'object' && !Array.isArray(task) &&
      Object.keys(task).every(k => ['id','kind','target','expectedSha256'].includes(k)),
      'Invalid or unsupported read-only task');
    check(typeof task.id === 'string' && ID.test(task.id) && !seen.has(task.id), 'Invalid or repeated task id');
    seen.add(task.id);
    check(task.kind === undefined || task.kind === 'read', 'Unsupported action, read-only tasks only');
    check(typeof task.expectedSha256 === 'string' && SHA.test(task.expectedSha256), 'Invalid task source fingerprint');
    const verdict = evaluateMissionAction({kind:'read',target:task.target},grant,runtime);
    check(verdict.decision === 'AUTO_ELIGIBLE', 'Read task denied: ' + verdict.reason);
    const source = validateFileTarget(task.target, workspaceRoot);
    check(source.state === 'FILE' && source.hash === task.expectedSha256, 'Invalid or stale task source');
    return {id:task.id,kind:'read',target:task.target,expectedSha256:task.expectedSha256};
  });
  ensureStore(storeDir);
  const dir = path.join(storeDir, missionId);
  try { fs.mkdirSync(dir, {mode:0o700}); }
  catch (err) { if (err.code === 'EEXIST') throw new Error('Mission already exists'); else throw err; }
  try {
    check(appendCAS(dir, [], {type:'CREATE',atMs:nowMs,payload:{grant,tasks:validatedTasks}}), 'Mission creation conflict');
  } catch (error) {
    // The mission directory remains for inspection; never replace existing approval history.
    throw error;
  }
  return inspectMission({storeDir,missionId});
}
function inspectMission({storeDir,missionId}) {
  return load(storeDir,missionId).state;
}
function secureReadSnapshot(task, workspaceRoot) {
  const probe = validateFileTarget(task.target,workspaceRoot);
  if(probe.state !== 'FILE')return {ok:false,reason:'INVALID_TARGET'};
  if(probe.hash !== task.expectedSha256)return {ok:false,reason:'STALE_SOURCE'};
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    fd = fs.openSync(task.target, flags);
    const st1 = fs.fstatSync(fd);
    if(!st1.isFile()||st1.size > MAX_SOURCE_BYTES)return {ok:false,reason:'INVALID_TARGET'};
    // Revalidate the resolved file identity; no string source contents enter the ledger.
    const realRoot=fs.realpathSync(workspaceRoot), realTarget=fs.realpathSync(task.target);
    const rel=path.relative(realRoot,realTarget);
    if(!rel || rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))return {ok:false,reason:'INVALID_TARGET'};
    const buffer=fs.readFileSync(fd);
    const st2=fs.fstatSync(fd);
    if(st1.ino!==st2.ino||st1.dev!==st2.dev||st1.size!==st2.size)return {ok:false,reason:'STALE_SOURCE'};
    const current=digest(buffer);
    if(current!==task.expectedSha256)return {ok:false,reason:'STALE_SOURCE'};
    return {ok:true,receipt:{sha256:current,byteCount:buffer.length}};
  } catch { return {ok:false,reason:'READ_FAILED'}; }
  finally { if(fd !== undefined) fs.closeSync(fd); }
}
function runMission({storeDir,missionId,nowMs = Date.now(),limit = 64,afterClaim} = {}) {
  check(finiteInt(nowMs), 'Invalid trusted clock');
  check(Number.isSafeInteger(limit) && limit > 0 && limit <= 128, 'Invalid task limit');
  let completed = 0, considered = 0, lastReason = null;
  while(considered < limit) {
    const outcome = transact(storeDir,missionId,state => {
      if(state.tasks.every(t=>t.status==='COMPLETED'))return {output:{reason:'COMPLETE'}};
      if(nowMs >= state.grant.expiresAt)return {output:{reason:'EXPIRED'}};
      if(state.usage.actionCount >= state.grant.maxActions)return {output:{reason:'ACTION_BUDGET'}};
      if(state.usage.failureCount >= state.grant.maxFailures)return {output:{reason:'FAILURE_BUDGET'}};
      const task = state.tasks.find(t=>t.status==='QUEUED'||(t.status==='RUNNING' && t.leaseUntil <= nowMs));
      if(!task)return {output:{reason:state.tasks.some(t=>t.status==='RUNNING')?'WAITING_FOR_LEASE':'NO_PENDING'}};
      const runtime = {
        missionId, workspaceRoot:state.grant.workspaceRoot,branch:state.grant.branch,
        isolatedWorkspace:true,nowMs,usage:state.usage
      };
      const verdict = evaluateMissionAction({kind:'read',target:task.target},state.grant,runtime);
      const claimId=randomUUID();
      return {event:{type:'CLAIM',atMs:nowMs,payload:{taskId:task.id,claimId,leaseUntil:nowMs+LEASE_MS}},
        output:{reason:'CLAIMED',task,grant:state.grant,claimId,verdict}};
    });
    if(outcome.reason!=='CLAIMED'){lastReason=outcome.reason;break;}
    considered++;
    if(typeof afterClaim==='function')afterClaim(outcome.task.id); // simulation hook for crash tests only
    let snapshot = outcome.verdict.decision==='AUTO_ELIGIBLE'
      ? secureReadSnapshot(outcome.task,outcome.grant.workspaceRoot)
      : {ok:false,reason:'PERMISSION_DENIED'};
    const wrote = transact(storeDir,missionId,state => {
      const current=state.tasks.find(t=>t.id===outcome.task.id);
      if(current?.status!=='RUNNING'||current.claimId!==outcome.claimId)
        return {output:false}; // another worker reclaimed; never report stale result as complete
      const event = snapshot.ok
        ? {type:'COMPLETE',atMs:nowMs,payload:{taskId:current.id,claimId:outcome.claimId,receipt:snapshot.receipt}}
        : {type:'BLOCK',atMs:nowMs,payload:{taskId:current.id,claimId:outcome.claimId,reason:snapshot.reason}};
      return {event,output:true};
    });
    if(wrote && snapshot.ok)completed++;
  }
  const state=inspectMission({storeDir,missionId});
  const paused=['EXPIRED','ACTION_BUDGET','FAILURE_BUDGET'].includes(lastReason);
  return {missionId,completed,status:paused?'PAUSED':state.status,reason:lastReason,usage:state.usage,
    approvalPrompts:0};
}
module.exports={createMission,inspectMission,runMission};
