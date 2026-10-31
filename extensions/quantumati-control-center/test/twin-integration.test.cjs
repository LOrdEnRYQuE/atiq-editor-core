'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectProject}=require('../project-state.cjs');
const {fingerprintSources}=require('../product-twin.cjs');
const {renderDashboardHtml}=require('../dashboard.cjs');
function withWorkspace(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'quantumati-ui-twin-'));
 fs.mkdirSync(path.join(root,'.quantumati'));fs.mkdirSync(path.join(root,'src'));
 try{return fn(root)}finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('a declared capability is reflected in Mission Control without a verification claim',()=>withWorkspace(root=>{
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'example-project'}));
 fs.writeFileSync(path.join(root,'src','login.js'),'module.exports=true');
 fs.writeFileSync(path.join(root,'.quantumati','product.json'),JSON.stringify({version:1,capabilities:[{id:'login',title:'Login capability',sources:['src/login.js']}]}));
 const inspected=inspectProject(root);assert.equal(inspected.twin.status,'INSPECTED');
 const html=renderDashboardHtml(inspected);
 assert.match(html,/PRODUCT DIGITAL TWIN/);assert.match(html,/Login capability/);assert.match(html,/IMPLEMENTATION_FOUND/);
 assert.match(html,/NOT_VERIFIED/);assert.doesNotMatch(html,/>VERIFIED</);
}));
test('an edited source invalidates a previously recorded pass in the rendered UI',()=>withWorkspace(root=>{
 const source=path.join(root,'src','login.js');fs.writeFileSync(source,'v1');
 fs.writeFileSync(path.join(root,'.quantumati','product.json'),JSON.stringify({version:1,capabilities:[{id:'login',title:'Login capability',sources:['src/login.js']}]}));
 const fingerprint=fingerprintSources(root,['src/login.js']).fingerprint;
 fs.writeFileSync(path.join(root,'.quantumati','evidence.json'),JSON.stringify({version:1,proofs:[{capabilityId:'login',fingerprint,runId:'manual-1',recordedAt:'2026-10-31T20:00:00Z',exitCode:0}]}));
 assert.match(renderDashboardHtml(inspectProject(root)),/PASS_RECORDED/);
 fs.writeFileSync(source,'v2');
 const after=renderDashboardHtml(inspectProject(root));
 assert.match(after,/STALE/);assert.match(after,/NOT_VERIFIED/);
}));
test('untrusted capability title is HTML-escaped in Mission Control',()=>withWorkspace(root=>{
 fs.writeFileSync(path.join(root,'src','login.js'),'v1');
 fs.writeFileSync(path.join(root,'.quantumati','product.json'),JSON.stringify({version:1,capabilities:[{id:'login',title:'<img src=x onerror=alert(1)>',sources:['src/login.js']}]}));
 const html=renderDashboardHtml(inspectProject(root));
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
}));
