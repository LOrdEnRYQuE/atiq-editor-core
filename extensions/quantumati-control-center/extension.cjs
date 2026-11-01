'use strict';
const vscode=require('vscode');
const {inspectProject}=require('./project-state.cjs');
const {renderDashboardHtml}=require('./dashboard.cjs');
function activate(context){
let panel;
const openExtensions=()=>vscode.commands.executeCommand('workbench.view.extensions');
const state=()=>{const folder=vscode.workspace.workspaceFolders?.[0];return inspectProject(folder?.uri.scheme==='file'?folder.uri.fsPath:null)};
function open(){
if(panel){panel.reveal(vscode.ViewColumn.One);panel.webview.html=renderDashboardHtml(state());return}
const current=vscode.window.createWebviewPanel('quantumatiProjectCenter','QuantumATi — Project Control Center',vscode.ViewColumn.One,{enableScripts:true,retainContextWhenHidden:true});
panel=current;
current.webview.html=renderDashboardHtml(state());
context.subscriptions.push(current.webview.onDidReceiveMessage(m=>{if(panel===current && m?.kind==='refresh')current.webview.html=renderDashboardHtml(state());else if(panel===current && m?.kind==='openExtensions')return openExtensions()}));
context.subscriptions.push(current.onDidDispose(()=>{if(panel===current)panel=undefined}));
}
context.subscriptions.push(vscode.commands.registerCommand('quantumati.openControlCenter',open));
context.subscriptions.push(vscode.commands.registerCommand('quantumati.openExtensions',openExtensions));
context.subscriptions.push(vscode.commands.registerCommand('quantumati.refreshControlCenter',()=>{if(panel)panel.webview.html=renderDashboardHtml(state());else open()}));
open();
}
module.exports={activate,deactivate(){}};
