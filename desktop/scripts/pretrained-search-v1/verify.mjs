import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {verify,hash} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {modelDetections,mergeModelDetections} from '../../src/core/detection/model-policy.ts';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {summarizeStage} from '../shared-core/metrics.mjs';
await verify();await verifyExecution();
const read=async p=>JSON.parse(await readFile(p));
const summaries={};
for(const variant of ['', '/schema', '/compatible']){
 const doc=`docs/evaluations/pretrained-search-v1${variant}`,dir=`artifacts/pretrained-search-v1${variant}`;
 const protocol=await read(`${doc}/protocol.json`),result=await read(`${doc}/results.json`);
 for(const[f,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),digest,f);
 assert.equal(hash(await readFile(`${doc}/protocol.json`)),result.protocolSha256);
 assert.equal(hash(await readFile(`${dir}/raw.jsonl`)),result.rawSha256);
 const cases=await read(`${dir}/cases.json`),raw=(await readFile(`${dir}/raw.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(raw.length,398);assert.equal(result.outcomes.length,398);
 const canonical={name:'PERSON',person:'PERSON','street address':'STREET_ADDRESS',location:'LOCATION',organization:'ORGANIZATION','company name':'ORGANIZATION'};
 for(const[fIndex,f]of cases.entries()){
  const r=raw[fIndex],saved=result.outcomes[fIndex],mapped=normalizedSource(f.text);
  assert.equal(r.index,fIndex);assert.equal(r.id,f.id);assert.equal(saved.id,f.id);assert.equal(saved.corpus,f.corpus);
  assert.equal(r.text,mapped.text);assert.equal(r.error,null);
  const chars=[...mapped.text],covered=new Uint8Array(chars.length),utf16=[0];
  for(const c of chars)utf16.push(utf16.at(-1)+c.length);
  for(const w of r.windows){
   assert.ok(w.start>=0&&w.end>w.start&&w.end<=chars.length);
   assert.ok(w.inputTokens>0&&w.inputTokens<=protocol.maxInputTokens);
   covered.fill(1,w.start,w.end);
  }
  for(const[i,c]of chars.entries())if(!/\s/u.test(c))assert.equal(covered[i],1,`Unprocessed character: ${f.id}:${i}`);
  const spans=r.entities.map(e=>{
   assert.ok(protocol.labels.includes(e.label));assert.ok(e.score>=protocol.threshold&&e.score<=1);
   assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&e.end<=chars.length);
   assert.equal(chars.slice(e.start,e.end).join(''),e.text);
   return{start:utf16[e.start],end:utf16[e.end],canonical_label:canonical[e.label]};
  });
  const modelOnly=mapped.restore(mergeModelDetections(modelDetections(mapped.text,spans))).map(d=>({...d,
   source:'GreenNode GLiNER · CPU FP32 · evaluation only',reason:'Local contextual model evidence; review required.'}));
  assert.deepEqual(modelOnly,saved.modelOnly);
  const replay=JSON.parse(JSON.stringify(score(f,applyDetectionPolicy(f.text,modelOnly).complete)));
  assert.deepEqual(replay,saved.result,`All six category previews and metrics: ${f.id}`);
  assert.equal(saved.matches,replay.entities.every(e=>e.selectedFull)&&replay.falsePositiveChars===0);
 }
 for(const[corpus,stage]of Object.entries(result.stages)){
  const rows=result.outcomes.filter(r=>r.corpus===corpus);
  assert.deepEqual({...summarizeStage(rows.map(r=>r.result)),matchingCases:rows.filter(r=>r.matches).length},stage);
 }
 assert.equal(result.decision,Object.values(result.stages).slice(0,3).every(s=>s.screeningPass)?'SCREEN_PASSED_NOT_RELEASE_QUALIFIED':'REJECT_TESTED_CONFIGURATION');
 summaries[variant||'readme-labels']={executions:398,errors:0,sourceCoverage:'Every nonwhitespace code point processed',
  replay:'Exact model/source spans, all categories and six selected previews, metrics and gate decisions verified',
  protocolSha256:result.protocolSha256,rawSha256:result.rawSha256,resultsSha256:hash(await readFile(`${doc}/results.json`))};
}
const summary={verifiedAt:new Date().toISOString(),priorEvidence:'All inherited source/fixture and approval hashes unchanged',runs:summaries};
await writeFile('docs/evaluations/pretrained-search-v1/verification.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
