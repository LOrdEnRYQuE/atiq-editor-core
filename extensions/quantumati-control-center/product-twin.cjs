'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MODEL_LIMIT = 128 * 1024;
const SOURCE_LIMIT = 1024 * 1024;
const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const SECRET_SEGMENTS = new Set(['.git', '.ssh', '.aws', '.env', '.npmrc', '.pypirc', 'id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json']);
function safeSegments(relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative) || relative.includes('\\')) throw new Error('Unsafe source path');
  const segments = relative.split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || s.toLowerCase().startsWith('.env.') || SECRET_SEGMENTS.has(s.toLowerCase()))) throw new Error('Unsafe source path');
  return segments;
}
function inspectRegularFile(root, relative, limit) {
  const segments = safeSegments(relative);
  const resolvedRoot = fs.realpathSync(root);
  let current = resolvedRoot;
  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('Symlink not allowed');
    if (i < segments.length - 1 && !stat.isDirectory()) throw new Error('Unexpected path component');
    if (i === segments.length - 1 && (!stat.isFile() || stat.size > limit)) throw new Error('Unsafe file type or size');
  }
  return fs.readFileSync(current);
}
function readJson(root, rel, required=false) {
  try { const content = inspectRegularFile(root, rel, MODEL_LIMIT); return JSON.parse(content.toString('utf8')); }
  catch (e) { if (e.code === 'ENOENT' && !required) return null; throw e; }
}
function validateModel(model) {
  if (!model || model.version !== 1 || !Array.isArray(model.capabilities) || model.capabilities.length > 100) throw new Error('Unsupported product model');
  const ids = new Set();
  for (const c of model.capabilities) {
    if (!c || !ID.test(c.id) || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 100 || !Array.isArray(c.sources) || c.sources.length < 1 || c.sources.length > 16) throw new Error('Invalid capability');
    if (ids.has(c.id)) throw new Error('Duplicate capability');
    ids.add(c.id);
    for (const source of c.sources) safeSegments(source);
    if (new Set(c.sources).size !== c.sources.length) throw new Error('Duplicate source');
  }
  return model.capabilities;
}
function fingerprintSources(root, sources) {
  const h = crypto.createHash('sha256');
  let missing = false; let blocked = false;
  for (const source of [...sources].sort()) {
    h.update(source + '\0');
    try {
      const buf = inspectRegularFile(root, source, SOURCE_LIMIT);
      h.update(String(buf.length) + '\0'); h.update(buf);
    } catch (e) {
      if (e.code === 'ENOENT') { missing = true; h.update('MISSING\0'); }
      else { blocked = true; h.update('BLOCKED\0'); }
    }
    h.update('\0');
  }
  return {fingerprint:h.digest('hex'),missing,blocked};
}
function validateProof(p, validIds) {
  return p && typeof p === 'object' && validIds.has(p.capabilityId) && /^[0-9a-f]{64}$/.test(p.fingerprint) && typeof p.runId === 'string' && p.runId.length>0 && p.runId.length<=128 && Number.isInteger(p.exitCode) && typeof p.recordedAt==='string' && !Number.isNaN(Date.parse(p.recordedAt));
}
function inspectProductTwin(workspaceRoot) {
  const base={status:'NO_MODEL',capabilities:[],warnings:[],verification:'NOT_VERIFIED'};
  if (!workspaceRoot) return base;
  let model;
  try { model=readJson(workspaceRoot,'.quantumati/product.json'); }
  catch { return {...base,status:'PARTIAL',warnings:['Product model cannot be safely read']}; }
  if (!model) return base;
  let capabilities;
  try {capabilities=validateModel(model)}
  catch {return {...base,status:'PARTIAL',warnings:['Invalid product model structure or unsafe source path']};}
  const validIds=new Set(capabilities.map(c=>c.id));
  let proofs=[];let warnings=[];
  try {
    const evidence=readJson(workspaceRoot,'.quantumati/evidence.json');
    if (evidence) {
      if (evidence.version !== 1 || !Array.isArray(evidence.proofs) || evidence.proofs.length > 200 || !evidence.proofs.every(p=>validateProof(p,validIds))) throw new Error('Invalid evidence');
      proofs=evidence.proofs;
    }
  } catch { warnings=['Evidence file unreadable or invalid; no recorded claims accepted']; }
  const result=capabilities.map(c=>{
    const snapshot=fingerprintSources(workspaceRoot,c.sources);
    const proof=proofs.filter(p=>p.capabilityId===c.id).at(-1);
    let status;
    if (snapshot.blocked) status='BLOCKED';
    else if (proof && (snapshot.missing || snapshot.fingerprint!==proof.fingerprint)) status='STALE';
    else if (snapshot.missing) status='MISSING_SOURCE';
    else if (proof) status=proof.exitCode===0?'PASS_RECORDED':'FAILED_RECORDED';
    else status='IMPLEMENTATION_FOUND';
    return {id:c.id,title:c.title,sources:[...c.sources],status,verification:'NOT_VERIFIED',provenance:proof?'UNTRUSTED_WORKSPACE_FILE':'LOCAL_FILESYSTEM',runId:proof?.runId||null, fingerprint:snapshot.fingerprint};
  });
  return {status:warnings.length?'PARTIAL':'INSPECTED',capabilities:result,warnings,verification:'NOT_VERIFIED'};
}
module.exports={inspectProductTwin,fingerprintSources};
