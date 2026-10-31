'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const extensionPath = path.join(__dirname, '../extension.cjs');

function mockActivation(workspaceRoot = '/tmp/demo') {
 const cmds = new Map(), panels=[];
 const vscode = {
  ViewColumn:{One:1},
  workspace:{workspaceFolders:workspaceRoot ? [{uri:{scheme:'file',fsPath:workspaceRoot}}] : []},
  commands:{registerCommand:(name,cb)=>{cmds.set(name,cb);return {dispose(){cmds.delete(name)}}}},
  window:{createWebviewPanel:(id,title,column,options)=>{
    const p={id,title,column,options,revealed:0, disposed:false,
      webview:{html:'',listener:null,onDidReceiveMessage(cb){this.listener=cb;return {dispose(){}}}},
      onDidDispose(cb){p.disposeListener=cb;return {dispose(){}}},
      reveal(){p.revealed++},dispose(){p.disposed=true;p.disposeListener?.()}
    };panels.push(p);return p;
  }}
 };
 const original=Module._load;
 Module._load=function(request,parent,isMain){
  if(request==='vscode')return vscode;
  if(request==='./project-state.cjs') return {inspectProject:root=>({projectName:root||'None',status:'INSPECTED'})};
  if(request==='./dashboard.cjs') return {renderDashboardHtml:s=>'<main>'+s.projectName+'</main>'};
  return original.call(this,request,parent,isMain);
 };
 let extension;
 try {delete require.cache[require.resolve(extensionPath)];extension=require(extensionPath)}
 finally {Module._load=original}
 const context={subscriptions:[]};extension.activate(context);
 return {cmds,panels,context,vscode};
}

test('activates project control center automatically on startup',()=>{
 const {cmds,panels}=mockActivation('/tmp/demo');
 assert.equal(panels.length,1);
 assert.equal(panels[0].id,'quantumatiProjectCenter');
 assert.match(panels[0].webview.html,/\/tmp\/demo/);
 assert.equal(panels[0].options.enableScripts,true);
 assert.equal(typeof cmds.get('quantumati.openControlCenter'),'function');
});
test('refreshes webview after workspace changes',()=>{
 const {cmds,panels,vscode}=mockActivation('/tmp/old');
 vscode.workspace.workspaceFolders=[{uri:{scheme:'file',fsPath:'/tmp/new'}}];
 cmds.get('quantumati.refreshControlCenter')();
 assert.match(panels[0].webview.html,/\/tmp\/new/);
});
test('webview refresh message updates current panel',()=>{
 const {panels,vscode}=mockActivation('/tmp/a');
 vscode.workspace.workspaceFolders=[{uri:{scheme:'file',fsPath:'/tmp/b'}}];
 panels[0].webview.listener({kind:'refresh'});
 assert.match(panels[0].webview.html,/\/tmp\/b/);
});
test('stale webview callback cannot mutate a newly created panel',()=>{
 const {cmds,panels}=mockActivation('/tmp/a');
 const old=panels[0];old.dispose();
 assert.doesNotThrow(()=>old.webview.listener({kind:'refresh'}));
 cmds.get('quantumati.openControlCenter')();
 const fresh=panels[1];
 const before=fresh.webview.html;
 old.webview.listener({kind:'refresh'});
 assert.equal(fresh.webview.html,before);
});
test('refresh after close reopens project control center',()=>{
 const {cmds,panels}=mockActivation();
 panels[0].dispose();
 cmds.get('quantumati.refreshControlCenter')();
 assert.equal(panels.length,2);
});
