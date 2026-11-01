'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {renderDashboardHtml}=require('../dashboard.cjs');
const context={projectName:'QuantumATi Demo',status:'INSPECTED',scripts:[],evidence:[],warnings:[],verification:{build:'NOT_RUN',tests:'NOT_RUN'}};
test('provider UI is vendor-neutral and truthfully disconnected',()=>{
 const html=renderDashboardHtml(context);
 assert.match(html,/AI PROVIDERS/);
 assert.match(html,/NOT CONNECTED/);
 assert.doesNotMatch(html,/OPENCODE GATEWAY/i);
 assert.doesNotMatch(html,/data-action="open-code"/);
 assert.match(html,/data-action="refresh"/);
});
test('existing sections remain navigable and untrusted names escaped',()=>{
 const html=renderDashboardHtml({...context,projectName:'<script>alert(1)</script>'});
 for(const route of ['overview','project','goals','agents','verification','permissions','activity','settings']) {
   assert.match(html,new RegExp('data-page="'+route+'"'));
 }
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('Extensions navigation exists without implying provider connectivity',()=>{
 const html=renderDashboardHtml(context);
 assert.match(html,/data-action="extensions"/);
 assert.match(html,/Browse Extensions/);
 assert.match(html,/NOT CONNECTED/);
});
