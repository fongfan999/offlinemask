import test from 'node:test';
import assert from 'node:assert/strict';
import { importReview, recordReview } from '../scripts/review-corpus/state.mjs';
const template = () => ({version:1,records:[{id:'a',digest:'exact',status:'pending',checks:{provenance:false,boundaries:false},note:''}],splitReview:{digest:'corpus',status:'pending'}});
test('review requires explicit identity and rejection rationale without mutating pending source',()=>{
 const ledger=template();
 assert.throws(()=>recordReview(ledger,'a','','approved','',[]));
 assert.throws(()=>recordReview(ledger,'a','author','approved','',['author']));
 assert.throws(()=>recordReview(ledger,'a','reviewer','rejected','',[]));
 const entry=recordReview(ledger,'a','reviewer','approved','',[]);
 assert.equal(ledger.records[0].status,'pending');assert.equal(entry.reviewer.kind,'human');assert.ok(Object.values(entry.checks).every(Boolean));
});
test('resume accepts matching decisions but never turns annotation review into split approval',()=>{
 const original=template(),edited=template();edited.records[0]=recordReview(edited,'a','reviewer','approved','Reviewed',[]);edited.splitReview.status='approved';
 const imported=importReview(edited,original);assert.equal(imported.records[0].status,'approved');assert.equal(imported.splitReview.status,'pending');
 assert.equal(original.records[0].status,'pending');
});
test('resume rejects foreign, partial, duplicate, stale and incomplete approvals',()=>{
 for(const mutate of [r=>{r.splitReview.digest='different';},r=>{r.records=[];},r=>{r.records.push(r.records[0]);},r=>{r.records[0].digest='old';},r=>{r.records[0].status='approved';}]){
  const changed=template();mutate(changed);assert.throws(()=>importReview(changed,template()));
 }
});
