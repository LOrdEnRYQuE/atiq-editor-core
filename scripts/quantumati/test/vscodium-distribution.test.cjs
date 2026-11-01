'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {auditDistribution,EXPECTED_GALLERY}=require('../vscodium-distribution.cjs');
const good=()=>({nameShort:'QuantumATi',nameLong:'QuantumATi Studio',applicationName:'quantumati',dataFolderName:'.quantumati',urlProtocol:'quantumati',darwinBundleIdentifier:'de.lordenryque.quantumati',reportIssueUrl:'https://github.com/LOrdEnRYQuE/atiq-editor-core/issues/new',licenseName:'MIT',licenseFileName:'LICENSE.txt',extensionsGallery:{...EXPECTED_GALLERY},linkProtectionTrustedDomains:['https://open-vsx.org']});
test('Open VSX metadata passes without claiming release readiness or privacy',()=>{
 const r=auditDistribution(good());assert.equal(r.configValid,true);assert.equal(r.releaseReady,false);assert.equal(r.checks.find(x=>x.id==='telemetry').status,'UNVERIFIED');
});
test('Microsoft marketplace is rejected',()=>{
 const p=good();p.extensionsGallery.serviceUrl='https://marketplace.visualstudio.com';assert.equal(auditDistribution(p).configValid,false);
});
test('vendor update and download destinations are rejected',()=>{
 const p=good();p.updateUrl='https://raw.githubusercontent.com/VSCodium/versions/refs/heads/master';assert.equal(auditDistribution(p).configValid,false);
 const q=good();q.downloadUrl='https://github.com/VSCodium/vscodium/releases';assert.equal(auditDistribution(q).configValid,false);
});
test('VSCodium identity and missing trusted domain are rejected',()=>{
 const p=good();p.applicationName='codium';assert.equal(auditDistribution(p).configValid,false);
 const q=good();delete q.linkProtectionTrustedDomains;assert.equal(auditDistribution(q).configValid,false);
});
test('invalid product objects fail closed',()=>{
 for(const input of [null,undefined,{},[],42,'product']){const r=auditDistribution(input);assert.equal(r.configValid,false);assert.equal(r.releaseReady,false);}
});
test('CLI reads valid JSON without mutation and rejects invalid JSON',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qati-dist-'));
 try{
 const file=path.join(dir,'product.json'),before=JSON.stringify(good());fs.writeFileSync(file,before);
 const cmd=path.join(__dirname,'..','vscodium-distribution.cjs');
 const ok=spawnSync(process.execPath,[cmd,file],{encoding:'utf8',timeout:5000});
 assert.equal(ok.status,0,ok.stderr);assert.equal(JSON.parse(ok.stdout).configValid,true);assert.equal(fs.readFileSync(file,'utf8'),before);
 fs.writeFileSync(file,'not-json');
 const bad=spawnSync(process.execPath,[cmd,file],{encoding:'utf8',timeout:5000});
 assert.notEqual(bad.status,0);assert.doesNotMatch(bad.stderr,/not-json/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('repository product metadata passes static preflight',()=>{
 const repo=path.resolve(__dirname,'../../..');const manifest=JSON.parse(fs.readFileSync(path.join(repo,'product.json'),'utf8'));
 const r=auditDistribution(manifest);assert.equal(r.configValid,true,JSON.stringify(r.checks));assert.equal(r.releaseReady,false);
});
