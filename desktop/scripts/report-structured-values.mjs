import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {summarize} from './model-comparison-metrics.mjs';
const root=new URL('../',import.meta.url).pathname;
const load=async path=>JSON.parse(await readFile(root+path));
const hash=x=>createHash('sha256').update(x).digest('hex');
const protocol=await load('docs/evaluations/2026-09-14-structured-values-protocol.json');
for(const [file,expected] of Object.entries(protocol.afterHashes))assert.equal(hash(await readFile(root+file)),expected);
const previousProtocol=await load('docs/evaluations/2026-09-14-text-reliability-final-protocol.json');
for(const [file,expected] of Object.entries(previousProtocol.implementationHashes))assert.equal(hash(await readFile(root+'artifacts/structured-values/baseline/'+file)),expected,'Baseline changed '+file);
function differences(a,b){
 assert.equal(a.file,b.file);assert.deepEqual(a.cases.map(c=>c.id),b.cases.map(c=>c.id));
 const losses=[],newFalsePositives=[],changes=[];
 for(let i=0;i<a.cases.length;i++){
  const old=a.cases[i],next=b.cases[i];
  const lost=next.entities.flatMap((e,j)=>{
   const previous=old.entities[j];assert.equal(e.value,previous.value);assert.equal(e.start,previous.start);
   return (previous.full&&!e.full||previous.selectedFull&&!e.selectedFull||previous.covered>e.covered)?[{value:e.value,category:e.category,before:previous,after:e}]:[];
  });
  if(lost.length)losses.push({id:next.id,lost,before:old.predictions,after:next.predictions});
  if(next.falsePositiveChars>old.falsePositiveChars)newFalsePositives.push({id:next.id,before:old.falsePositives,after:next.falsePositives});
  if(JSON.stringify(old.predictions)!==JSON.stringify(next.predictions))changes.push({id:next.id,before:old,after:next});
 }
 return {file:a.file,before:a.summary,after:b.summary,screeningPass:b.screeningPass,losses,newFalsePositives,changes};
}
const comparisons=[];
for(const runtime of ['native','wasm'])for(const variant of ['single','combined']){
 const base=await load(`artifacts/text-reliability-20260914/revised-${runtime}-${variant}.json`);
 const last=await load(`artifacts/text-reliability-20260914/final-after-${runtime}-${variant}.json`);
 assert.deepEqual(base.sources,previousProtocol.implementationHashes);assert.deepEqual(last.sources,previousProtocol.implementationHashes);
 const fresh=await load(`artifacts/structured-values/before-${runtime}-${variant}.json`);
 const after=await load(`artifacts/structured-values/after-${runtime}-${variant}.json`);
 const before=[...base.rows,...last.rows,...fresh.rows];
 assert.deepEqual(before.map(r=>r.file),after.rows.map(r=>r.file));
 for(const row of before)assert.equal(hash(await readFile(root+'tests/fixtures/'+row.file)),protocol.fixtureHashes[row.file]);
 const rows=before.map((r,i)=>differences(r,after.rows[i]));
 comparisons.push({runtime,variant,regressionBefore:summarize(before.slice(0,-1).flatMap(r=>r.cases)),regressionAfter:summarize(after.rows.slice(0,-1).flatMap(r=>r.cases)),rows});
}
const sources={};for(const file of Object.keys(protocol.beforeHashes))sources[file]=await readFile(root+'artifacts/structured-values/baseline/'+file,'utf8');
await writeFile(root+'docs/evaluations/2026-09-14-structured-values.json',JSON.stringify({createdAt:new Date().toISOString(),protocol,baselineSources:sources,models:await load('scripts/model-manifest.json'),comparisons},null,2)+'\n');
for(const c of comparisons)console.log(JSON.stringify({runtime:c.runtime,variant:c.variant,before:c.regressionBefore,after:c.regressionAfter,fresh:c.rows.at(-1),losses:c.rows.flatMap(r=>r.losses),additionalFP:c.rows.flatMap(r=>r.newFalsePositives)},(key,value)=>key==='changes'?undefined:value));
