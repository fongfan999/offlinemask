import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {score,contextual} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {summarizeStage} from '../shared-core/metrics.mjs';
await verify();await verifyExecution();
const read=async p=>JSON.parse(await readFile(p));
const protocol=await read('docs/evaluations/quality-first-v1/protocol.json');
for(const[f,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),digest,f);
const cases=await read('artifacts/quality-first-v1/cases.json'),runs={},rawHashes={};
const assets=(await read('docs/evaluations/shared-core-protocol-v2.json')).assets;
for(const variant of protocol.variants){
 const path=`artifacts/quality-first-v1/${variant}.json`,run=await read(path);runs[variant]=run;
 assert.deepEqual(run.protocol,protocol);assert.equal(run.outcomes.length,398);rawHashes[variant]=hash(await readFile(path));
 for(const[i,f]of cases.entries()){
  const row=run.outcomes[i];assert.equal(row.id,f.id);assert.equal(row.corpus,f.corpus);assert.equal(row.result.error,null);
  assert.deepEqual(JSON.parse(JSON.stringify(score(f,applyDetectionPolicy(f.text,row.modelOnly).complete))),row.result);
 }
}
const recipes=[];
for(let mask=1;mask<16;mask++)for(const route of ['all','contextual']){
 const variants=protocol.variants.filter((_,i)=>mask&(1<<i)),id=`${variants.join('+')}:${route}`;
 const outcomes=cases.map((f,i)=>{
  const evidence=variants.flatMap(v=>runs[v].outcomes[i].modelOnly),ds=route==='contextual'?contextual(evidence):evidence;
  const result=score(f,applyDetectionPolicy(f.text,ds).complete);
  return{id:f.id,corpus:f.corpus,number:f.number,result,matches:result.entities.every(e=>e.selectedFull)&&result.falsePositiveChars===0};
 });
 const stages=Object.fromEntries(['regression','challenge','approved24','owner12'].map(corpus=>{
  const rows=outcomes.filter(o=>o.corpus===corpus);
  return[corpus,{...summarizeStage(rows.map(o=>o.result)),matchingCases:rows.filter(o=>o.matches).length}];
 }));
 const selected=outcomes.filter(o=>o.corpus!=='owner12');
 const own=selected.flatMap(o=>o.result.entities).filter(e=>e.selectedFull).length;
 const ordinary=selected.reduce((s,o)=>s+o.result.falsePositiveChars,0);
 const files=new Map();for(const v of variants)for(const a of assets[v])for(const[file,data]of Object.entries(a.files))files.set(`${a.directory}/${file}`,data.size);
 recipes.push({id,variants,route,own,total:selected.flatMap(o=>o.result.entities).length,ordinary,
  matchingCases:selected.filter(o=>o.matches).length,assetBytes:[...files.values()].reduce((a,b)=>a+b,0),
  passes:['regression','challenge','approved24'].every(s=>stages[s].screeningPass),stages,outcomes});
}
recipes.sort((a,b)=>Number(b.passes)-Number(a.passes)||b.own-a.own||a.ordinary-b.ordinary||a.variants.length-b.variants.length||a.assetBytes-b.assetBytes||a.id.localeCompare(b.id));
assert.equal(recipes[0].total,500);
const results={reportedAt:new Date().toISOString(),protocolSha256:hash(await readFile('docs/evaluations/quality-first-v1/protocol.json')),rawHashes,
 selectedCandidate:recipes[0].id,releaseGate:recipes[0].passes?'SCREEN_PASSED_NOT_PACKAGED_QUALIFIED':'NOT_PASSED',
 ranking:recipes.map(({outcomes,...r})=>r),recipes,
 limits:protocol.limits};
await writeFile('docs/evaluations/quality-first-v1/results.json',JSON.stringify(results,null,2)+'\n',{flag:'wx'});
console.table(results.ranking.map(r=>({recipe:r.id,own:r.own,total:r.total,ordinary:r.ordinary,matching:r.matchingCases,MB:Math.round(r.assetBytes/1e6),passes:r.passes})));
console.log('Selected best available',results.selectedCandidate,'Release gate',results.releaseGate);
