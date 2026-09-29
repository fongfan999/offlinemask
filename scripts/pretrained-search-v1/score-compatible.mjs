import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {modelDetections,mergeModelDetections} from '../../src/core/detection/model-policy.ts';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {summarizeStage} from '../shared-core/metrics.mjs';
await verify();await verifyExecution();
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const dir='artifacts/pretrained-search-v1/compatible',doc='docs/evaluations/pretrained-search-v1/compatible';
const protocol=await read(`${doc}/protocol.json`);
for(const[f,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),digest,f);
const cases=await read(`${dir}/cases.json`),bytes=await readFile(`${dir}/raw.jsonl`);
const raw=bytes.toString().trim().split('\n').map(JSON.parse);
assert.equal(raw.length,cases.length);
const canonical={person:'PERSON','company name':'ORGANIZATION','street address':'STREET_ADDRESS',location:'LOCATION',organization:'ORGANIZATION'};
const outcomes=cases.map((f,i)=>{
 const r=raw[i],mapped=normalizedSource(f.text);
 assert.equal(r.index,i);assert.equal(r.id,f.id);assert.equal(r.corpus,f.corpus);assert.equal(r.text,mapped.text);
 const utf16=[0];for(const char of mapped.text)utf16.push(utf16.at(-1)+char.length);
 const spans=r.entities.map(e=>{
  assert.ok(canonical[e.label]);assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.end>e.start);
  const start=utf16[e.start],end=utf16[e.end];assert.equal(mapped.text.slice(start,end),e.text);
  return {start,end,canonical_label:canonical[e.label]};
 });
 const modelOnly=mapped.restore(mergeModelDetections(modelDetections(mapped.text,spans))).map(d=>({...d,
  source:'GreenNode GLiNER · CPU FP32 · evaluation only',reason:'Local contextual model evidence; review required.'}));
 const result=score(f,applyDetectionPolicy(f.text,modelOnly).complete);result.error=r.error;
 return {id:f.id,corpus:f.corpus,number:f.number,text:f.text,modelOnly,result,
  matches:!result.error&&result.entities.every(e=>e.selectedFull)&&result.falsePositiveChars===0};
});
const stages=Object.fromEntries(['regression','challenge','approved24','owner12'].map(corpus=>{
 const rows=outcomes.filter(r=>r.corpus===corpus);
 return[corpus,{...summarizeStage(rows.map(r=>r.result)),matchingCases:rows.filter(r=>r.matches).length}];
}));
const results={reportedAt:new Date().toISOString(),protocolSha256:hash(await readFile(`${doc}/protocol.json`)),
 rawSha256:hash(bytes),runtime:await read(`${dir}/runtime.json`),stages,outcomes,
 decision:Object.values(stages).slice(0,3).every(s=>s.screeningPass)?'SCREEN_PASSED_NOT_RELEASE_QUALIFIED':'REJECT_TESTED_CONFIGURATION',
 limits:'Synthetic observed cases only. FP32 contextual-label configuration. No INT8/native packaging qualification. Owner12 overlaps historical cases. Punctuation/symbol excess excluded by historical metric; exact previews preserved.'};
await writeFile(`${doc}/results.json`,JSON.stringify(results,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:results.decision,stages},null,2));
