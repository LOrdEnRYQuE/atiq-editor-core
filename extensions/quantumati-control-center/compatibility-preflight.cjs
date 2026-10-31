'use strict';
const fs = require('node:fs');
const path = require('node:path');
const SAFE_VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-[a-z0-9.-]+)?$/i;
function versionParts(value) {
  const m = typeof value === 'string' && value.match(SAFE_VERSION);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function compareVersions(a, b) {
  const x = versionParts(a), y = versionParts(b);
  if (!x || !y) return null;
  for (let i=0;i<3;i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
function evaluateCompatibility(input = {}, options = {}) {
  const pkg = input.rootPackage || {};
  const product = input.product || {};
  const extension = input.extension || {};
  const workflow = input.engineeringWorkflow;
  const observedVersion = pkg.version;
  const refVersion = options.referenceVersion;
  const compared = compareVersions(observedVersion, refVersion);
  const checks = [
    {
      id: 'core_version',
      status: compared === null ? 'UNKNOWN' : compared < 0 ? 'OUTDATED' : compared > 0 ? 'AHEAD_OF_REFERENCE' : 'MATCHES_REFERENCE',
      observed: typeof observedVersion === 'string' ? observedVersion : null,
      reference: typeof refVersion === 'string' ? refVersion : null,
      detail: 'Version comparison only; does not prove API, dependency, build, or runtime compatibility.'
    },
    {
      id: 'branding',
      status: /^quantumati$/i.test(product.applicationName || '') && /^quantumati$/i.test(product.nameShort || '') ? 'DECLARED' : 'NOT_BRANDED',
      observed: { nameShort: product.nameShort || null, applicationName: product.applicationName || null },
      detail: 'Static product metadata; does not prove installer branding.'
    },
    {
      id: 'extension_engine',
      status: typeof extension.engines?.vscode === 'string' ? 'DECLARED_NOT_RUNTIME_TESTED' : 'UNKNOWN',
      observed: extension.engines?.vscode || null,
      detail: 'A semver declaration is not proof of working extension activation or desktop startup.'
    },
    {
      id: 'ci_permissions',
      status: typeof workflow !== 'string' ? 'UNKNOWN' : /\/repos\/microsoft\/vscode\/collaborators\//.test(workflow) ? 'UPSTREAM_COUPLING' : 'NO_KNOWN_UPSTREAM_REFERENCE',
      observed: typeof workflow === 'string' ? 'workflow inspected' : null,
      detail: 'Only detects the inherited upstream collaborator lookup in one known workflow.'
    },
    {
      id: 'extension_registry',
      status: product.extensionsGallery ? 'DECLARED_LICENSE_NOT_VERIFIED' : 'NOT_CONFIGURED',
      observed: product.extensionsGallery ? 'configured' : null,
      detail: 'Registry presence does not grant rights to use proprietary Microsoft Marketplace extensions.'
    },
    {
      id: 'privacy',
      status: 'UNVERIFIED', observed: null,
      detail: 'Requires network-level telemetry and extension/provider audits; static metadata cannot prove privacy.'
    },
    {
      id: 'desktop_build',
      status: 'UNVERIFIED', observed: null,
      detail: 'Requires a real OS-targeted build, install, startup and end-to-end checks.'
    }
  ];
  return {schemaVersion:1,releaseReady:false,scope:'READ_ONLY_STATIC_PREFLIGHT',checks};
}
function readRegularFile(root, parts) {
  const rootReal = fs.realpathSync(root);
  let current = rootReal;
  for (let i=0;i<parts.length;i++) {
    current = path.join(current,parts[i]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (i<parts.length-1 && !stat.isDirectory()) || (i===parts.length-1 && (!stat.isFile() || stat.size>128*1024))) throw new Error('Unsupported file entry');
  }
  return fs.readFileSync(current,'utf8');
}
function inspectRepository(root, options = {}) {
  const warnings = [];
  function textFile(parts) {
    try { return readRegularFile(root,parts); }
    catch { warnings.push('Cannot safely inspect ' + parts.join('/')); return null; }
  }
  function jsonFile(parts) {
    const content=textFile(parts);
    if (content === null) return null;
    try { return JSON.parse(content); }
    catch { warnings.push('Invalid JSON at ' + parts.join('/')); return null; }
  }
  const rootPackage = jsonFile(['package.json']);
  const product = jsonFile(['product.json']);
  const extension = jsonFile(['extensions','quantumati-control-center','package.json']);
  const engineeringWorkflow = textFile(['.github','workflows','no-engineering-system-changes.yml']);
  return {...evaluateCompatibility({rootPackage,product,extension,engineeringWorkflow},options),warnings};
}
if (require.main === module) {
  const root=path.resolve(__dirname,'../..');
  const report=inspectRepository(root,{referenceVersion:process.argv[2] || undefined});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
module.exports={evaluateCompatibility,inspectRepository};
