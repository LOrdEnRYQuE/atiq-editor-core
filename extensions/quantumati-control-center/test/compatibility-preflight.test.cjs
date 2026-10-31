'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {evaluateCompatibility,inspectRepository}=require('../compatibility-preflight.cjs');
const sample={
 rootPackage:{version:'1.110.0',name:'code-oss-dev'},
 product:{nameShort:'Code - OSS',applicationName:'code-oss',dataFolderName:'.vscode-oss'},
 extension:{engines:{vscode:'^1.110.0'}},
 engineeringWorkflow:'route: GET /repos/microsoft/vscode/collaborators/example/permission'
};
test('old Code OSS baseline is a migration blocker, not a claimed upgrade',()=>{
 const r=evaluateCompatibility(sample,{referenceVersion:'1.144.0'});
 assert.equal(r.releaseReady,false);
 assert.equal(r.checks.find(c=>c.id==='core_version').status,'OUTDATED');
 assert.equal(r.checks.find(c=>c.id==='core_version').observed,'1.110.0');
});
test('product identity remains Code OSS unless actually changed',()=>{
 const r=evaluateCompatibility(sample,{referenceVersion:'1.144.0'});
 assert.equal(r.checks.find(c=>c.id==='branding').status,'NOT_BRANDED');
});
test('inherited upstream collaborator URL is reported as CI blocker',()=>{
 const r=evaluateCompatibility(sample,{referenceVersion:'1.144.0'});
 assert.equal(r.checks.find(c=>c.id==='ci_permissions').status,'UPSTREAM_COUPLING');
});
test('missing marketplace config cannot be called licensed or compatible',()=>{
 const r=evaluateCompatibility(sample,{referenceVersion:'1.144.0'});
 assert.equal(r.checks.find(c=>c.id==='extension_registry').status,'NOT_CONFIGURED');
});
test('unknown privacy and desktop build stay UNVERIFIED even when branding is set',()=>{
 const input={...sample,rootPackage:{version:'1.144.0'},product:{nameShort:'QuantumATi',applicationName:'quantumati'},engineeringWorkflow:'jobs:\n  main:\n    runs-on: ubuntu-latest'};
 const r=evaluateCompatibility(input,{referenceVersion:'1.144.0'});
 assert.equal(r.checks.find(c=>c.id==='privacy').status,'UNVERIFIED');
 assert.equal(r.checks.find(c=>c.id==='desktop_build').status,'UNVERIFIED');
 assert.equal(r.releaseReady,false);
});
test('malformed or missing version must fail closed',()=>{
 const r=evaluateCompatibility({...sample,rootPackage:{version:'oops'}},{referenceVersion:'1.144.0'});
 assert.equal(r.checks.find(c=>c.id==='core_version').status,'UNKNOWN');
 assert.equal(r.releaseReady,false);
});
test('repository reader observes fixture without changing files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'qati-preflight-'));
 try{
  fs.mkdirSync(path.join(root,'extensions','quantumati-control-center'),{recursive:true});
  fs.mkdirSync(path.join(root,'.github','workflows'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(sample.rootPackage));
  fs.writeFileSync(path.join(root,'product.json'),JSON.stringify(sample.product));
  fs.writeFileSync(path.join(root,'extensions','quantumati-control-center','package.json'),JSON.stringify(sample.extension));
  fs.writeFileSync(path.join(root,'.github','workflows','no-engineering-system-changes.yml'),sample.engineeringWorkflow);
  const before=fs.readFileSync(path.join(root,'product.json'),'utf8');
  const output=inspectRepository(root,{referenceVersion:'1.144.0'});
  assert.equal(output.checks.find(c=>c.id==='ci_permissions').status,'UPSTREAM_COUPLING');
  assert.equal(fs.readFileSync(path.join(root,'product.json'),'utf8'),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
