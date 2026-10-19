import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,readJson,hash,verify} from '../single-model-decision-v1/common.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {scoreFixture} from '../model-comparison-metrics.mjs';
await verify();
const reviewRoot=join(root,'docs/evaluations/single-model-owner-review-v1');
const ledger=await readJson(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'));
const key=await readJson(join(output,'review-key.json'));
assert.deepEqual({A:key.A,B:key.B},{A:'underthesea',B:'bigmed'});
assert.equal(hash(await readFile(join(output,'candidates.json'))),ledger.outputHash);
const requested=[
 [['đỗ hoàng phúc','name']],
 [['H’Hen Niê','name']],
 [],
 [['Nguyễn Ngọc Hà','name'],['007700112233','banking']],
 [['Lâm Quốc Hưng','name'],['15A Lê Quý Đôn, Quận 3, TP. Hồ Chí Minh','address']],
 [['17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh','address']],
 [],[],
 [['Tạ Uyên Chi','name']],
 [['4111 1111 1111 1111','other'],['123','other']],
 [],
 [['hẻm 16, số 5B Nguyễn Thị Minh Khai, Cần Thơ','address']],
];
const response=await readFile(join(reviewRoot,'response.txt'),'utf8');
const lines=response.trimEnd().split('\n');assert.equal(lines.length,12);
function entities(text,values){
 const mapped=normalizedSource(text);
 return values.map(([value,category])=>{
  const normalized=value.normalize('NFC'),at=mapped.text.indexOf(normalized);
  assert.ok(at>=0);assert.equal(mapped.text.indexOf(normalized,at+1),-1,'Expected unique reviewed occurrence');
  const [span]=mapped.restore([{start:at,end:at+normalized.length,category}]);
  return {...span,value:text.slice(span.start,span.end)};
 });
}
function assess(text,expected,saved){
 const scores=scoreFixture({id:saved.id,group:saved.group,text,entities:expected},saved.predictions,saved.selectedPredictions);
 return {acceptable: scores.entities.every(e=>e.selectedFull)&&scores.falsePositiveChars===0,
  ...scores,predictions:saved.predictions,selectedPredictions:saved.selectedPredictions};
}
const cases=ledger.cases.map((row,i)=>{
 assert.equal(hash(row.text),row.textSha256);assert.equal(key.cases[i].id,row.id);assert.equal(key.cases[i].file,row.file);
 const expected=entities(row.text,requested[i]);
 const result={number:row.number,id:row.id,file:row.file,textSha256:row.textSha256,
  responseVerbatim:lines[i],reviewStatus:i===4?'RECEIVED_CUSTOMER_ID_CLARIFICATION_PENDING':'RECEIVED',
  expectedSpans:expected,expectedScope:'Only this reviewed example; no general category-policy change inferred.',
  assessments:Object.fromEntries(['A','B'].map(label=>[label,assess(row.text,expected,key.cases[i][label])]))};
 if(i===0)result.reconciliation='The quoted person spans are treated as desired output. Both frozen outputs contain no detections; both miss the reviewed name. No success inferred from the response wording.';
 if(i===1)result.reconciliation='Owner says A overmasks. Frozen output primarily fragments/miscategorizes the desired name, with no extra lexical positions outside it. Preserve the owner wording separately from this computed diagnosis.';
 if(i===4){
  result.reconciliation='Customer ID KH847291 omitted from desired spans; owner clarification requested. Do not change banking defaults or silently approve excluding the identifier.';
  const includingId=[...expected,...entities(row.text,[['KH847291','banking']])];
  result.includingCustomerId=Object.fromEntries(['A','B'].map(label=>[label,assess(row.text,includingId,key.cases[i][label])]));
 }
 if(i===7)result.reconciliation='Owner expects no masking in this organization example. Record the case-level expectation; old other/organization annotation remains unchanged. Do not generalize to every organization or to location findings in other contexts.';
 return result;
});
const summary=Object.fromEntries(['A','B'].map(label=>[label,{
 model:key[label],acceptableResolvedCases:cases.filter(c=>c.number!==5&&c.assessments[label].acceptable).map(c=>c.number),
 unacceptableResolvedCases:cases.filter(c=>c.number!==5&&!c.assessments[label].acceptable).map(c=>c.number),resolvedCases:11,
 case5AcceptableWithoutId:cases[4].assessments[label].acceptable,case5AcceptableWithId:cases[4].includingCustomerId[label].acceptable,
}]));
const result={receivedAt:new Date().toISOString(),reviewer:'project owner via conversation',status:'ALL_12_RESPONSES_RECEIVED_ONE_SCOPE_CLARIFICATION_PENDING',
 bindings:{originalLedger:hash(await readFile(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'))),
 reviewPage:hash(await readFile(join(root,'docs/evaluations/single-model-decision-v1/review.md'))),output:ledger.outputHash,
 rawResponse:hash(response),script:hash(await readFile(new URL(import.meta.url)))},cases,summary,
 limits:'Human review of observed examples after model outputs were supplied. Not blind independent holdout, training approval, general policy change or model release acceptance. Historical files and model outputs unchanged.'};
await writeFile(join(reviewRoot,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary,null,2));
