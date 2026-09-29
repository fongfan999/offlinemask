import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,readJson,hash,verify} from '../single-model-decision-v1/common.mjs';
import {scoreFixture} from '../model-comparison-metrics.mjs';
await verify();
const directory=join(root,'docs/evaluations/single-model-owner-review-v1');
const initialBytes=await readFile(join(directory,'receipt.json'));
const initial=JSON.parse(initialBytes);
assert.equal(hash(await readFile(join(directory,'response.txt'))),initial.bindings.rawResponse);
const ledger=await readJson(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'));
assert.equal(hash(await readFile(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'))),initial.bindings.originalLedger);
const key=await readJson(join(output,'review-key.json'));
assert.equal(hash(await readFile(join(output,'candidates.json'))),initial.bindings.output);
const cases=structuredClone(initial.cases),row=cases[4],text=ledger.cases[4].text;
const value='KH847291',start=text.indexOf(value);assert.ok(start>=0);
row.expectedSpans.push({start,end:start+value.length,value,category:'banking'});
row.expectedSpans.sort((a,b)=>a.start-b.start);
row.reviewStatus='RECEIVED_AND_CLARIFIED';
row.reconciliation='Owner explicitly confirms that KH847291 must remain masked. Both models correctly mask it; both still fail the complete name/category expectation.';
row.clarification={question:'Ở ví dụ 5, KH847291 là mã định danh khách hàng. Bạn muốn giữ mã này hiển thị, hay đã bỏ sót nó khi liệt kê phần cần ẩn?',answer:'Vẫn cần ẩn mã khách hàng'};
delete row.includingCustomerId;
row.assessments=Object.fromEntries(['A','B'].map(label=>{
 const saved=key.cases[4][label];
 const scores=scoreFixture({id:row.id,group:saved.group,text,entities:row.expectedSpans},saved.predictions,saved.selectedPredictions);
 return [label,{acceptable:scores.entities.every(e=>e.selectedFull)&&scores.falsePositiveChars===0,...scores,
 predictions:saved.predictions,selectedPredictions:saved.selectedPredictions}];
}));
const summary=Object.fromEntries(['A','B'].map(label=>[label,{model:key[label],
 acceptableCases:cases.filter(c=>c.assessments[label].acceptable).map(c=>c.number),
 unacceptableCases:cases.filter(c=>!c.assessments[label].acceptable).map(c=>c.number),reviewedCases:cases.length}]));
const final={completedAt:new Date().toISOString(),reviewer:initial.reviewer,status:'ALL_12_EXPECTATIONS_RECORDED',
 pendingClarifications:[],initialReceiptSha256:hash(initialBytes),scriptSha256:hash(await readFile(new URL(import.meta.url))),
 bindings:initial.bindings,cases,summary,
 scope:'Case-level expected spans recorded, including customer ID clarification. No global organization exclusion, training permission or model release approval inferred.',
 limits:initial.limits};
await writeFile(join(directory,'completed.json'),JSON.stringify(final,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary,null,2));
