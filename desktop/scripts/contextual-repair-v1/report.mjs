import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,verify,hash} from './common.mjs';
import {summarizeStage} from '../shared-core/metrics.mjs';
const protocol=await verify(),summaries={},rawHashes={},remaining={},executions={};
for(const variant of ['combined','underthesea']){
 const bytes=await readFile(join(output,`${variant}.json`)),run=JSON.parse(bytes);
 assert.deepEqual(run.protocol,protocol);assert.equal(run.cases.length,protocol.cases);rawHashes[variant]=hash(bytes);
 executions[variant]={raw:run.rawRuns,normalized:run.normalizedRuns};summaries[variant]={};
 for(const corpus of ['regression','challenge']){
  const rows=run.cases.filter(c=>c.corpus===corpus);
  const routes=variant==='underthesea'?['address','nfc','both']:['address'];
  summaries[variant][corpus]={before:summarizeStage(rows.map(r=>r.before))};
  for(const route of routes){
   const changes=Object.fromEntries(['gains','losses','selectedGains','selectedLosses','positionLosses','addedOrdinary'].map(k=>[k,rows.flatMap(r=>r.changes[route][k])]));
   summaries[variant][corpus][route]={...summarizeStage(rows.map(r=>r[route])),changes};
  }
 }
 const last=variant==='underthesea'?'both':'address';
 remaining[variant]=run.cases.flatMap(r=>{
  const missed=r[last].entities.filter(e=>!e.selectedFull);
  return missed.length||r[last].falsePositiveChars?[{id:r.id,file:r.file,corpus:r.corpus,missed,ordinary:r[last].falsePositiveChars,
   predictions:r[last].predictions,modelOnly:r.normalizedModelOnly??r.modelOnly}]:[];
 });
}
await writeFile(join(root,'docs/evaluations/contextual-repair-v1/results.json'),JSON.stringify({createdAt:new Date().toISOString(),rawHashes,executions,summaries,remaining,
 limits:'Observed developer-authored synthetic diagnostics. NFC is a candidate-only adapter with developer native offsets; no pack replacement or shipping runtime qualification.'},null,2)+'\n',{flag:'wx'});
for(const [v,cs] of Object.entries(summaries))for(const[c,rs]of Object.entries(cs))for(const[r,s]of Object.entries(rs))console.log(v,c,r,JSON.stringify({
 full:s.summary.fullyCovered,total:s.summary.entities,selected:Object.values(s.summary.byCategory).reduce((n,c)=>n+c.selectedFull,0),ordinary:s.summary.falsePositiveChars,pass:s.screeningPass,
 changes:s.changes&&Object.fromEntries(Object.entries(s.changes).map(([k,a])=>[k,a.length]))}));
