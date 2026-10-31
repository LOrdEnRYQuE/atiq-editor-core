'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { inspectProductTwin } = require('./product-twin.cjs');

/** Read-only inventory, not a verification pass. */
function inspectProject(workspaceRoot) {
  const base = {
    status: 'NO_WORKSPACE', projectName: 'No project open',
    scripts: [], evidence: [], warnings: [],
    verification: { build: 'NOT_RUN', tests: 'NOT_RUN' },
    twin: { status: 'NO_MODEL', capabilities: [], warnings: [], verification: 'NOT_VERIFIED' }
  };
  if (!workspaceRoot) return base;
  let directory;
  try {
    directory = fs.realpathSync(workspaceRoot);
    if (!fs.statSync(directory).isDirectory()) throw new Error('not a directory');
  } catch (_error) {
    return { ...base, status:'PARTIAL', warnings:['Workspace directory could not be inspected'] };
  }
  const result = { ...base, status:'INSPECTED', projectName:path.basename(directory) };
  const manifest = path.join(directory, 'package.json');
  try {
    const stat = fs.lstatSync(manifest);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 1024 * 1024)
      throw new Error('unsupported manifest type or size');
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    result.evidence.push('package.json');
    if (typeof parsed.name === 'string' && parsed.name.trim()) result.projectName = parsed.name.trim();
    if (parsed.scripts && typeof parsed.scripts === 'object' && !Array.isArray(parsed.scripts))
      result.scripts = Object.keys(parsed.scripts).filter(x => typeof parsed.scripts[x] === 'string').sort();
  } catch (error) {
    if (error.code !== 'ENOENT') {
      result.status = 'PARTIAL';
      result.warnings.push('package.json is unreadable or invalid; no scripts inferred');
    }
  }
  result.twin = inspectProductTwin(directory);
  return result;
}
module.exports = { inspectProject };
