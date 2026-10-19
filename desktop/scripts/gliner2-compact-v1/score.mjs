import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {summarizeStage} from '../shared-core/metrics.mjs';
import {categories,meetsScreeningFloor} from '../model-comparison-metrics.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {modelDetections} from '../../src/core/detection/model-policy.ts';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
await verify();await verifyExecution();
const artifact='artifacts/gliner2-compact-v1', evidence='docs/evaluations/gliner2-compact-v1';
const read=async p=>JSON.parse(await readFile(p));
const protocol=await read(`${evidence}/protocol.json`);
for(const [f,h] of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),h,f);
const cases=await read('artifacts/quality-first-v1/cases.json');
const raw=(await readFile(`${artifact}/raw.jsonl`,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
assert.equal(raw.length,cases.length);
const orgSet=new Set(protocol.organizationAnnotations.map(e=>`${e.index}:${e.entityIndex}`));
function contextual(row,f){
 const mapped=normalizedSource(f.text),spans=[];
 for(const e of row.entities){
  assert.equal(mapped.text.slice(e.start,e.end),e.text,`Invalid original span ${f.id}`);
  assert.ok(Number.isFinite(e.score)&&e.score>=0&&e.score<=1);
  const label={person_name:'PERSON',street_address:'STREET_ADDRESS'}[e.label];
  if(label&&e.score>=protocol.threshold)spans.push({...e,canonical_label:label});
 }
 return mapped.restore(modelDetections(mapped.text,spans)).map(d=>({...d,source:'PII Engineer Multi NER v2.1 · INT8'}));
}
function retained(result,index){
 const orgs=result.entities.filter((e,j)=>orgSet.has(`${index}:${j}`));
 const filtered={...result,entities:result.entities.filter((e,j)=>!orgSet.has(`${index}:${j}`))};
 // The full fixture remains the ordinary-text reference. Deferred organizations
 // are neutral for retained coverage, not relabelled as ordinary text or successes.
 for(const e of orgs)for(let p=e.start;p<e.end;p++)if(/[\p{L}\p{M}\p{N}]/u.test(cases[index].text[p])){
  filtered.sensitiveChars--;
  if(result.predictions.some(d=>d.start<=p&&d.end>p))filtered.coveredChars--;
 }
 return filtered;
}
function stage(rows){
 const full=summarizeStage(rows.map(r=>r.result));
 const retainedRows=rows.map(r=>retained(r.result,r.index));
 const reduced=summarizeStage(retainedRows);
 for(const [key,list]of [['summary',rows],['shortSummary',rows.filter(r=>r.result.group!=='long')]]){
  reduced[key].negativeCases=list.filter(r=>!r.result.entities.length).length;
  reduced[key].falsePositiveNegativeCases=list.filter(r=>!r.result.entities.length&&r.result.falsePositiveChars>0).length;
 }
 reduced.screeningPass=meetsScreeningFloor(reduced)&&categories.every(c=>{
  const v=reduced.summary.byCategory[c];return v.total>0&&v.selectedFull/v.total>=(['email','phone','banking'].includes(c)?.99:.95);
 });
 const orgs=rows.flatMap(r=>r.result.entities.filter((e,j)=>orgSet.has(`${r.index}:${j}`)));
 const leaks=rows.flatMap(r=>r.result.entities.filter((e,j)=>orgSet.has(`${r.index}:${j}`)).flatMap(e=>
  ['name','address','email','phone','banking'].flatMap(c=>r.result.selectedPredictions[c].filter(p=>p.start<e.end&&p.end>e.start).map(p=>({id:r.id,category:c,expected:e.value,predicted:p.value})))));
 return{full,retained:reduced,retainedOwn:retainedRows.flatMap(r=>r.entities).filter(e=>e.selectedFull).length,
  retainedMatchingCases:retainedRows.filter(r=>!r.error&&r.entities.every(e=>e.selectedFull)&&r.falsePositiveChars===0).length,
  organizations:{total:orgs.length,own:orgs.filter(e=>e.selectedFull).length,categoryLeaks:leaks}};
}
const runs={};
for(const v of ['underthesea','bigmed','large'])runs[v]=await read(`artifacts/quality-first-v1/${v}.json`);
const recipes={gliner2:cases.map((f,index)=>{
 const row=raw[index];assert.equal(row.index,index);assert.equal(row.id,f.id);assert.equal(row.corpus,f.corpus);
 const modelOnly=contextual(row,f),result=score(f,applyDetectionPolicy(f.text,modelOnly).complete);result.error=row.error;
 return{index,id:f.id,corpus:f.corpus,result,modelOnly,durationMs:row.durationMs};
})};
for(const id of protocol.comparators)recipes[id]=cases.map((f,index)=>{
 const modelOnly=id.split('+').flatMap(v=>{
  const r=runs[v].outcomes[index];assert.equal(r.id,f.id);assert.equal(r.result.error,null);return r.modelOnly;
 }).filter(e=>['TEN','DIA_CHI','TO_CHUC'].includes(e.type));
 return{index,id:f.id,corpus:f.corpus,result:score(f,applyDetectionPolicy(f.text,modelOnly).complete)};
});
const results={protocolSha256:hash(await readFile(`${evidence}/protocol.json`)),rawSha256:hash(await readFile(`${artifact}/raw.jsonl`)),
 reportedAt:new Date().toISOString(),recipes:Object.fromEntries(Object.entries(recipes).map(([id,rows])=>[id,{
  ranked:stage(rows.filter(r=>r.corpus!=='owner12')),
  stages:Object.fromEntries(['regression','challenge','approved24','owner12'].map(c=>[c,stage(rows.filter(r=>r.corpus===c))]))}])),
 failures:recipes.gliner2.filter(r=>r.result.error||retained(r.result,r.index).entities.some(e=>!e.selectedFull)||r.result.falsePositiveChars>0),
 performance:{loadMs:raw[0].loadMs,totalInferenceMs:raw.reduce((s,r)=>s+r.durationMs,0),cached:false,
  durations:raw.map(r=>({id:r.id,group:cases[r.index].group,ms:r.durationMs,windows:r.windows.length}))},
 limits:protocol.limits};
const check=process.argv.includes('--verify');
if(check){const saved=await read(`${evidence}/results.json`);results.reportedAt=saved.reportedAt;assert.deepEqual(results,saved);console.log('Verified exact raw replay, all six option previews, four comparison recipes and scope metrics.');}
else await writeFile(`${evidence}/results.json`,JSON.stringify(results,null,2)+'\n',{flag:'wx'});
console.table(Object.entries(results.recipes).map(([id,r])=>({id,own:r.ranked.retainedOwn,total:r.ranked.retained.summary.entities,
 names:r.ranked.retained.summary.byCategory.name.selectedFull+'/'+r.ranked.retained.summary.byCategory.name.total,
 addresses:r.ranked.retained.summary.byCategory.address.selectedFull+'/'+r.ranked.retained.summary.byCategory.address.total,
 ordinary:r.ranked.retained.summary.falsePositiveChars,negatives:r.ranked.retained.summary.falsePositiveNegativeCases,
 passes:['regression','challenge','approved24'].every(c=>r.stages[c].retained.screeningPass)})));
