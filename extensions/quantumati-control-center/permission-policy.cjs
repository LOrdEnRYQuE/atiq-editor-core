'use strict';
const fs = require('node:fs');
const path = require('node:path');
const SECRET_NAMES = new Set(['.env','.npmrc','.pypirc','id_rsa','id_ed25519','credentials.json','secrets.json']);
function within(candidate, root) {
  if (!candidate || !root || typeof candidate !== 'string' || typeof root !== 'string') return false;
  const rootResolved = path.resolve(root), candidateResolved = path.resolve(candidate);
  const rel = path.relative(rootResolved, candidateResolved);
  if (rel === '..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) return false;
  try {
    const realRoot = fs.realpathSync(rootResolved), realTarget = fs.realpathSync(candidateResolved);
    const realRel = path.relative(realRoot, realTarget);
    return realRel !== '..' && !realRel.startsWith('..'+path.sep) && !path.isAbsolute(realRel);
  } catch (_error) { return false; }
}
function isSecret(target) {
  if (!target || typeof target !== 'string') return true;
  return path.normalize(target).split(path.sep).map(s=>s.toLowerCase()).some(
    p => SECRET_NAMES.has(p) || p.startsWith('.env.') || p === '.ssh' || p === '.aws' || p === '.git'
  );
}
/** Advisory only; a future trusted executor must enforce permissions separately. */
function decideAction(action, scope) {
  if (!action || !scope || typeof action.kind !== 'string') return {decision:'DENY',reason:'Invalid action'};
  if (action.kind === 'read') {
    if (isSecret(action.target)) return {decision:'DENY',reason:'Sensitive path'};
    return within(action.target, scope.workspaceRoot)
      ? {decision:'ALLOW',reason:'Read-only workspace inspection'}
      : {decision:'DENY',reason:'Outside permitted workspace or unresolved path'};
  }
  if (action.kind === 'write' || action.kind === 'delete') {
    if (isSecret(action.target)) return {decision:'DENY',reason:'Sensitive path'};
    return within(action.target, scope.workspaceRoot)
      ? {decision:'REQUIRE_APPROVAL',reason:'Workspace mutation requires executor and approval'}
      : {decision:'DENY',reason:'No trusted isolated executor available in this slice'};
  }
  if (action.kind === 'publish' || action.kind === 'external' || action.kind === 'git-push')
    return {decision:'REQUIRE_APPROVAL',reason:'External side effect requires explicit authorization'};
  return {decision:'DENY',reason:'Action not supported by read-only prototype'};
}
module.exports = { decideAction };
