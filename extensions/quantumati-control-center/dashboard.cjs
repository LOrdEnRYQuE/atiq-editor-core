'use strict';
const {randomBytes}=require('node:crypto');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderDashboardHtml(s){
const nonce=randomBytes(16).toString('hex');
const evidence=(s.evidence||[]).map(x=>'<li>'+esc(x)+'</li>').join('')||'<li>No manifest evidence</li>';
const scripts=(s.scripts||[]).map(x=>'<li>'+esc(x)+' (not executed)</li>').join('')||'<li>None discovered</li>';
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><style>
body{background:var(--vscode-editor-background);color:var(--vscode-foreground);font:14px system-ui;padding:32px;max-width:960px;margin:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}section{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:18px;margin:12px 0}h1{font-size:28px}button{padding:10px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:5px;cursor:pointer}
</style></head><body><h1>QuantumATi — Project Control Center</h1><p>Product-first workbench / read-only prototype (L1)</p>
<section><h2>${esc(s.projectName)}</h2><p>Inspection status: ${esc(s.status)}</p><button id="refresh" data-action="refresh">Refresh inspection</button></section>
<div class="grid"><section><h3>Observed evidence</h3><ul>${evidence}</ul></section><section><h3>Discovered scripts</h3><ul>${scripts}</ul></section>
<section><h3>Verification</h3><p>Build: ${esc(s.verification.build)}</p><p>Tests: ${esc(s.verification.tests)}</p></section></div>
<section><h3>Limits</h3><p>No LLM, OpenCode agent execution, build, network call or automatic writes are connected yet.</p>
<ul>${(s.warnings||[]).map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></section>
<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.getElementById('refresh').addEventListener('click',()=>vscode.postMessage({kind:'refresh'}));</script></body></html>`;
}
module.exports={renderDashboardHtml};
