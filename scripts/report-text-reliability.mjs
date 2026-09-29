import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {summarize} from './model-comparison-metrics.mjs';
const root=new URL('../',import.meta.url).pathname;
const dir=root+'artifacts/text-reliability-20260914/';
const load=async file=>JSON.parse(await readFile(file));
const protocol=await load(root+'docs/evaluations/2026-09-14-text-reliability-protocol.json');
const finalProtocol=await load(root+'docs/evaluations/2026-09-14-text-reliability-final-protocol.json');
for(const [file,hash] of Object.entries(finalProtocol.implementationHashes))assert.equal(createHash('sha256').update(await readFile(root+file)).digest('hex'),hash,file);
function compare(a,b){
 assert.equal(a.file,b.file);assert.deepEqual(a.cases.map(c=>c.id),b.cases.map(c=>c.id));
 const changes=[];
 for(let i=0;i<a.cases.length;i++){
  const old=a.cases[i],next=b.cases[i];
  assert.deepEqual(old.entities.map(e=>[e.category,e.start,e.end,e.value]),next.entities.map(e=>[e.category,e.start,e.end,e.value]));
  const outcomes=next.entities.map((e,k)=>({value:e.value,category:e.category,oldFull:old.entities[k].full,newFull:e.full,
   oldSelected:old.entities[k].selectedFull,newSelected:e.selectedFull,oldCovered:old.entities[k].covered,newCovered:e.covered}));
  if(JSON.stringify(old.predictions)!==JSON.stringify(next.predictions))changes.push({id:next.id,outcomes,
   beforeFalsePositives:old.falsePositives,afterFalsePositives:next.falsePositives,
   before:old.predictions,after:next.predictions});
 }
 return {file:a.file,before:a.summary,after:b.summary,screeningPass:b.screeningPass,changes,
  lostFull:changes.flatMap(c=>c.outcomes.filter(e=>e.oldFull&&!e.newFull).map(e=>({id:c.id,...e}))),
  lostSelected:changes.flatMap(c=>c.outcomes.filter(e=>e.oldSelected&&!e.newSelected).map(e=>({id:c.id,...e}))),
  lostPartial:changes.flatMap(c=>c.outcomes.filter(e=>e.newCovered<e.oldCovered).map(e=>({id:c.id,...e}))),
  addedFalsePositiveCases:b.cases.filter((c,i)=>c.falsePositiveChars>a.cases[i].falsePositiveChars).map(c=>c.id)};
}
const comparisons=[];
for(const runtime of ['native','wasm'])for(const variant of ['single','combined']){
 const before=await load(dir+`before-${runtime}-${variant}.json`),initial=await load(dir+`after-${runtime}-${variant}.json`),after=await load(dir+`revised-${runtime}-${variant}.json`);
 const freshBefore=await load(dir+`final-before-${runtime}-${variant}.json`),freshAfter=await load(dir+`final-after-${runtime}-${variant}.json`);
 assert.deepEqual(after.sources,finalProtocol.implementationHashes);
 assert.deepEqual(freshAfter.sources,finalProtocol.implementationHashes);
 const rows=before.rows.map((r,i)=>compare(r,after.rows[i]));
 const originalCases=before.rows.flatMap(r=>r.cases),updatedCases=after.rows.flatMap(r=>r.cases);
 comparisons.push({runtime,variant,beforeSources:before.sources,afterSources:after.sources,
  aggregateBefore:summarize(originalCases),aggregateAfter:summarize(updatedCases),
  initialExperiment:initial.rows.map((r,i)=>({file:r.file,summary:r.summary,...Object.fromEntries(Object.entries(compare(before.rows[i],r)).filter(([key])=>['lostFull','lostSelected','lostPartial','addedFalsePositiveCases'].includes(key)))})),
  regression:rows,final:compare(freshBefore.rows[0],freshAfter.rows[0]),finalCases:freshAfter.rows[0].cases});
}
const baselineSources={};
for(const file of protocol.implementationFiles){try{baselineSources[file]=await readFile(dir+'baseline/'+file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}}
const report={createdAt:new Date().toISOString(),protocol,finalProtocol,baselineSources,
 dependencyLockSha256:createHash('sha256').update(await readFile(root+'pnpm-lock.yaml')).digest('hex'),
 models:await load(root+'scripts/model-manifest.json'),runtime:await load(root+'scripts/native-prototype/runtime-manifest.json'),
 decision:'Targeted integration fixes only; no model promotion. Current optional pair and production WASM backend remain unchanged.',comparisons};
await writeFile(root+'docs/evaluations/2026-09-14-text-reliability.json',JSON.stringify(report,null,2)+'\n');
for(const c of comparisons){console.log(c.runtime,c.variant,JSON.stringify({aggregateBefore:c.aggregateBefore,aggregateAfter:c.aggregateAfter,
 losses:c.regression.flatMap(r=>[...r.lostFull,...r.lostSelected,...r.lostPartial]),addedFalsePositives:c.regression.flatMap(r=>r.addedFalsePositiveCases),finalBefore:c.final.before,finalAfter:c.final.after,finalPass:c.final.screeningPass,finalLosses:[...c.final.lostFull,...c.final.lostSelected,...c.final.lostPartial],finalAddedFP:c.final.addedFalsePositiveCases}));}
