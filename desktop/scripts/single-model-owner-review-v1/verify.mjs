import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,readJson,hash,verify} from '../single-model-decision-v1/common.mjs';
import {scoreFixture} from '../model-comparison-metrics.mjs';
await verify();
const directory=join(root,'docs/evaluations/single-model-owner-review-v1');
const receiptBytes=await readFile(join(directory,'receipt.json'));
const receipt=JSON.parse(receiptBytes),completed=await readJson(join(directory,'completed.json'));
assert.equal(hash(receiptBytes),completed.initialReceiptSha256);
assert.equal(hash(await readFile(join(directory,'response.txt'))),receipt.bindings.rawResponse);
assert.equal(hash(await readFile(join(root,'scripts/single-model-owner-review-v1/record.mjs'))),receipt.bindings.script);
assert.equal(hash(await readFile(join(root,'scripts/single-model-owner-review-v1/clarify.mjs'))),completed.scriptSha256);
const oldVerification=await readJson(join(root,'docs/evaluations/single-model-decision-v1/verification.json'));
for(const[file,digest]of Object.entries(oldVerification.hashes))assert.equal(hash(await readFile(join(root,file))),digest,file);
const ledger=await readJson(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'));
const candidates=await readJson(join(output,'candidates.json'));
assert.equal(hash(await readFile(join(output,'candidates.json'))),completed.bindings.output);
assert.equal(completed.cases.length,12);assert.deepEqual(completed.pendingClarifications,[]);
const reviewed=[];
for(const row of completed.cases){
 const original=ledger.cases.find(c=>c.number===row.number);
 assert.equal(hash(original.text),row.textSha256);
 assert.deepEqual([row.id,row.file],[original.id,original.file]);
 for(const e of row.expectedSpans){
  assert.equal(original.text.slice(e.start,e.end),e.value);
  assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&e.end<=original.text.length);
 }
 const fixture={id:row.id,file:row.file,text:original.text,entities:row.expectedSpans,group:'owner-reviewed-observed'};
 for(const [label,variant]of Object.entries({A:'underthesea',B:'bigmed'})){
  const saved=candidates[variant].find(c=>c.id===row.id&&c.file===row.file).canonical;
  assert.deepEqual(saved.predictions,row.assessments[label].predictions);
  const score=scoreFixture(fixture,saved.predictions,saved.selectedPredictions);
  const acceptable=score.entities.every(e=>e.selectedFull)&&score.falsePositiveChars===0;
  assert.equal(acceptable,row.assessments[label].acceptable);
 }
 reviewed.push({...fixture,number:row.number,provenance:{source:'Owner conversation review and customer-ID clarification',
  originalTextSha256:row.textSha256,reviewStatus:'EXPECTATIONS_RECORDED',independentHoldout:false,
  categoryAssignment:'Existing category mapping applied by assistant; no global scope change inferred.'}});
}
for(const label of ['A','B']){
 assert.deepEqual(completed.cases.filter(c=>c.assessments[label].acceptable).map(c=>c.number),completed.summary[label].acceptableCases);
}
assert.ok(reviewed[4].entities.some(e=>e.value==='KH847291'&&e.category==='banking'));
assert.equal(reviewed[7].entities.length,0);
assert.equal(completed.cases[0].assessments.A.entities[0].covered,0);
assert.equal(completed.cases[0].assessments.B.entities[0].covered,0);
await writeFile(join(directory,'reviewed-cases.json'),JSON.stringify({reviewSha256:hash(await readFile(join(directory,'completed.json'))),
 scope:'Separate observed owner-reviewed regression overlay; preserves old annotations/results. Not a training corpus or general organization policy.',cases:reviewed},null,2)+'\n',{flag:'wx'});
const hashes={};
for(const name of ['response.txt','receipt.json','completed.json','reviewed-cases.json'])hashes[name]=hash(await readFile(join(directory,name)));
await writeFile(join(directory,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),hashes,
 verifierSha256:hash(await readFile(new URL(import.meta.url))),cases:12,categoryAndFullOutputReplays:24,
 productionAndHistoricalEvidence:'Verified unchanged',newInferenceRuns:0,reviewStatus:'All 12 responses recorded, customer ID clarified'},null,2)+'\n',{flag:'wx'});
console.log('Verified 12 reviewed cases, 24 model assessments, exact source spans and unchanged historical evidence.');
