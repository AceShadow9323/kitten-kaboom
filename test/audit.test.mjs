import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAudit,auditState} from '../server/audit.mjs';
test('audit retention is bounded and preserves repeated identical messages using sequence numbers',()=>{
 const r={code:'ABC234',phase:'playing',rev:0,players:[{name:'A',alive:true,hand:['SECRET']}],turn:0,owed:1,deck:['PRIVATE'],logEvents:[]};
 for(let n=1;n<=510;n++){r.rev=n;r.logEvents=[{seq:n,at:new Date().toISOString(),text:'A drew a card.'}];appendAudit(r,{before:auditState(r),sequence:n-1,actor:'A',source:'draw'})}
 assert.equal(r.auditLog.length,500);assert.equal(r.auditLog[0].revision,11);assert.equal(new Set(r.auditLog.map(e=>e.id)).size,500);
 assert.ok(r.auditLog.every(e=>e.messages.length===1));assert.ok(!JSON.stringify(r.auditLog).includes('SECRET'));assert.ok(!JSON.stringify(r.auditLog).includes('PRIVATE'));
});
