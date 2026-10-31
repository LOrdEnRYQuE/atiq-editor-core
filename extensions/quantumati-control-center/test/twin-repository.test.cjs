'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {inspectProductTwin}=require('../product-twin.cjs');
test('the QuantumATi repository model links actual committed source files',()=>{
 const root=path.resolve(__dirname,'../../..');
 const report=inspectProductTwin(root);
 assert.equal(report.status,'INSPECTED');
 const ids=new Set(report.capabilities.map(c=>c.id));
 for(const id of ['project-control-center','workspace-inspection','product-digital-twin','evidence-staleness'])assert.ok(ids.has(id),id);
 for(const cap of report.capabilities){
  assert.equal(cap.status,'IMPLEMENTATION_FOUND',cap.id);
  assert.equal(cap.verification,'NOT_VERIFIED',cap.id);
  assert.match(cap.fingerprint,/^[0-9a-f]{64}$/);
 }
});
