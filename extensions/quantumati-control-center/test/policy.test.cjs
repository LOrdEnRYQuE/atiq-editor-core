'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {decideAction}=require('../permission-policy.cjs');
function withFixture(fn){const p=fs.mkdtempSync(path.join(os.tmpdir(),'qati-policy-'));try{return fn(p)}finally{fs.rmSync(p,{recursive:true,force:true})}}
test('sensitive .env is denied even for proposed writes',()=>withFixture(root=>{
 const secret=path.join(root,'.env');fs.writeFileSync(secret,'fake');
 assert.equal(decideAction({kind:'write',target:secret},{workspaceRoot:root}).decision,'DENY');
}));
test('sensitive .git objects cannot be deleted via proposed action',()=>withFixture(root=>{
 fs.mkdirSync(path.join(root,'.git'));const gitconfig=path.join(root,'.git','config');fs.writeFileSync(gitconfig,'fake');
 assert.equal(decideAction({kind:'delete',target:gitconfig},{workspaceRoot:root}).decision,'DENY');
}));
test('normal workspace write still requires approval',()=>withFixture(root=>{
 const file=path.join(root,'readme.md');fs.writeFileSync(file,'test');
 assert.equal(decideAction({kind:'write',target:file},{workspaceRoot:root}).decision,'REQUIRE_APPROVAL');
}));
test('symlink to outside project is denied',()=>withFixture(root=>{
 const other=fs.mkdtempSync(path.join(os.tmpdir(),'qati-outside-'));
 try{fs.writeFileSync(path.join(other,'file.txt'),'fake');fs.symlinkSync(path.join(other,'file.txt'),path.join(root,'link.txt'));
 assert.equal(decideAction({kind:'read',target:path.join(root,'link.txt')},{workspaceRoot:root}).decision,'DENY');}
 finally{fs.rmSync(other,{recursive:true,force:true})}
}));
