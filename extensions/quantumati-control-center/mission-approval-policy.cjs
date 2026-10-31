'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

const SAFE_KINDS=new Set(['read','edit','test']);
const ALWAYS_REVIEW=new Set(['delete','deploy','payment','publish','git-push','install','network']);
const SECRET_SEGMENTS=new Set(['.git','.ssh','.aws','.env','.npmrc','.pypirc','credentials.json','secrets.json','id_rsa','id_ed25519']);
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-z0-9][a-z0-9_-]{0,79}$/i;
const MAX_READ=2*1024*1024;

/**
 * Advisory decision only. Do not pass untrusted agent-supplied grants as grant.
 * Future privileged broker must authenticate the mission grant, serialize usage
 * accounting, enforce the result at the filesystem/process boundary and log it.
 */
function decision(value,reason) {
  return {decision:value,reason,enforced:false};
}
function isNonNegativeInt(v) {return Number.isSafeInteger(v)&&v>=0;}
function validGrant(grant, runtime) {
  if(!grant||typeof grant!=='object'||!runtime||typeof runtime!=='object')return false;
  if(!ID.test(grant.missionId||'')||!ID.test(runtime.missionId||''))return false;
  if(typeof grant.workspaceRoot!=='string'||!path.isAbsolute(grant.workspaceRoot))return false;
  if(typeof runtime.workspaceRoot!=='string'||!path.isAbsolute(runtime.workspaceRoot))return false;
  if(typeof grant.branch!=='string'||!grant.branch.trim()||grant.branch==='main'||grant.branch==='master')return false;
  if(!Number.isSafeInteger(grant.expiresAt)||!Number.isSafeInteger(runtime.nowMs))return false;
  if(!isNonNegativeInt(grant.maxCostCents)||!isNonNegativeInt(grant.maxActions)||grant.maxActions===0)return false;
  if(!isNonNegativeInt(grant.maxFailures)||grant.maxFailures===0)return false;
  if(!Array.isArray(grant.allowedKinds)||!grant.allowedKinds.every(x=>SAFE_KINDS.has(x)))return false;
  if(!Array.isArray(grant.allowedTestIds)||!grant.allowedTestIds.every(x=>typeof x==='string'&&ID.test(x)))return false;
  if(!runtime.usage||!isNonNegativeInt(runtime.usage.actionCount)||!isNonNegativeInt(runtime.usage.failureCount)||!isNonNegativeInt(runtime.usage.costCents))return false;
  if(runtime.missionId!==grant.missionId||runtime.branch!==grant.branch)return false;
  if(path.resolve(runtime.workspaceRoot)!==path.resolve(grant.workspaceRoot))return false;
  return true;
}
function isSensitive(relative) {
  return relative.split(path.sep).some(segment=>{
    const s=segment.toLowerCase();
    return SECRET_SEGMENTS.has(s)||s.startsWith('.env.');
  });
}
function validateFileTarget(target,root) {
  if(typeof target!=='string'||!target||target.includes('\0')||!path.isAbsolute(target))return {state:'DENY',reason:'Invalid absolute target'};
  const raw=target.split(/[\\/]/);
  if(raw.includes('..')||raw.includes('.'))return {state:'DENY',reason:'Non-canonical target'};
  const rootAbs=path.resolve(root),targetAbs=path.resolve(target);
  const rel=path.relative(rootAbs,targetAbs);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return {state:'DENY',reason:'Outside mission workspace'};
  if(isSensitive(rel))return {state:'DENY',reason:'Sensitive path'};
  try {
    const rootStat=fs.lstatSync(rootAbs);
    if(rootStat.isSymbolicLink()||!rootStat.isDirectory())return {state:'DENY',reason:'Untrusted workspace root'};
    let current=rootAbs;
    const parts=rel.split(path.sep);
    for(let i=0;i<parts.length;i++){
      current=path.join(current,parts[i]);
      let stat;
      try {stat=fs.lstatSync(current);}
      catch(err){
        if(err.code==='ENOENT'&&i===parts.length-1)return {state:'ABSENT'};
        return {state:'DENY',reason:'Unresolved parent'};
      }
      if(stat.isSymbolicLink())return {state:'DENY',reason:'Symlinks are not permitted'};
      if(i<parts.length-1&&!stat.isDirectory())return {state:'DENY',reason:'Invalid directory'};
      if(i===parts.length-1){
        if(!stat.isFile()||stat.size>MAX_READ)return {state:'DENY',reason:'Unsupported source file'};
        const content=fs.readFileSync(current);
        return {state:'FILE',hash:createHash('sha256').update(content).digest('hex')};
      }
    }
  }catch{return {state:'DENY',reason:'Filesystem cannot be inspected safely'};}
  return {state:'DENY',reason:'Unknown filesystem state'};
}
function safeInput(action,keys){
  return Object.keys(action).every(k=>keys.includes(k));
}
function evaluateMissionAction(action,grant,runtime) {
  if(!action||typeof action!=='object'||Array.isArray(action)||typeof action.kind!=='string')
    return decision('DENY','Invalid action');
  if(!validGrant(grant,runtime))return decision('DENY','No valid mission scope or context');
  if(ALWAYS_REVIEW.has(action.kind))return decision('REQUIRE_APPROVAL','Requires a separate action-specific authorization');
  if(!SAFE_KINDS.has(action.kind))return decision('DENY','Unsupported action');
  if(!runtime.isolatedWorkspace)return decision('DENY','Verified workspace isolation is required by this policy');
  if(runtime.nowMs>=grant.expiresAt)return decision('PAUSE','Mission authorization has expired');
  if(runtime.usage.actionCount>=grant.maxActions)return decision('PAUSE','Action limit reached');
  if(runtime.usage.failureCount>=grant.maxFailures)return decision('PAUSE','Failure limit reached');
  if(runtime.usage.costCents>grant.maxCostCents)return decision('PAUSE','Cost limit exceeded');
  if(!grant.allowedKinds.includes(action.kind))return decision('REQUIRE_APPROVAL','Action type not granted for this mission');
  if(action.kind==='test'){
    if(!safeInput(action,['kind','testId'])||typeof action.testId!=='string'||!grant.allowedTestIds.includes(action.testId))
      return decision('DENY','Only named allowlisted test IDs may run');
    return decision('AUTO_ELIGIBLE','Named test permitted by scoped mission grant');
  }
  if(!safeInput(action,action.kind==='read'?['kind','target']:['kind','target','expectedSha256']))
    return decision('DENY','Unexpected action parameters');
  const inspected=validateFileTarget(action.target,grant.workspaceRoot);
  if(inspected.state==='DENY')return decision('DENY',inspected.reason);
  if(action.kind==='read'){
    if(inspected.state!=='FILE')return decision('DENY','Read target does not exist');
    return decision('AUTO_ELIGIBLE','In-scope read-only inspection');
  }
  if(typeof action.expectedSha256!=='string'||(action.expectedSha256!=='ABSENT'&&!HASH.test(action.expectedSha256)))
    return decision('DENY','Missing valid optimistic-concurrency precondition');
  if(inspected.state==='ABSENT'&&action.expectedSha256==='ABSENT')
    return decision('AUTO_ELIGIBLE','New file eligible under absent-file precondition');
  if(inspected.state==='FILE'&&action.expectedSha256===inspected.hash)
    return decision('AUTO_ELIGIBLE','Source fingerprint matches current file');
  return decision('PAUSE','Stale source precondition: reconcile before editing');
}
module.exports={evaluateMissionAction,validateFileTarget};
