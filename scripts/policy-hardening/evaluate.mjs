import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {analyzeText} from '../../src/core/text.ts';
import {filterDetections} from '../../src/core/detection/options.ts';
import {createDetectionEngine} from '../../src/core/detection/engine.ts';
import {categories,scoreFixture} from '../model-comparison-metrics.mjs';
import {summarizeStage} from '../shared-core/metrics.mjs';
import {loadCandidate} from '../shared-core/candidates.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {root,readJson,fixtures,verify,outputRoot} from './common.mjs';
const round=process.argv[2];assert.ok(['1','2'].includes(round));
const protocol=await verify();
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')),'combined');
globalThis.fetch=async()=>{throw Error('Network forbidden during policy evaluation');};
const fs=await fixtures(),detector=await loadCandidate(root,'combined',fs.map(f=>f.text)),cases=[];
function score(f,ds,error) {
  const spans=analyzeText(f.text,'12345678',ds).spans;
  const selected=Object.fromEntries(categories.map(c=>[c,analyzeText(f.text,'12345678',filterDetections(ds,[c])).spans]));
  return {...scoreFixture(f,spans,selected),error,recordId:f.recordId,representation:f.representation,
    predictions:spans.map(s=>({...s,value:f.text.slice(s.start,s.end)})),
    selectedPredictions:Object.fromEntries(categories.map(c=>[c,selected[c].map(s=>({...s,value:f.text.slice(s.start,s.end)}))]))};
}
try {
  for(const f of fs) {
    let value;
    try {const ds=await detector.inspect(f.text);value={error:null,modelOnly:score(f,ds.modelOnly,null),complete:score(f,ds.complete,null)};}
    catch(failure){const error=failure instanceof Error?failure.message:'Inference failed';value={error,modelOnly:score(f,[],error),complete:score(f,[],error)};}
    cases.push({id:f.id,file:f.file,corpus:f.corpus,...value});
    if(cases.length%50===0)console.log(round,cases.length,'/',fs.length);
  }
}finally{await detector.dispose();}
const local={},engine=createDetectionEngine();
for(const options of [['email','phone','banking'],['email'],['phone'],['banking']]) {
  const rows=[];
  for(const f of fs.filter(f=>f.corpus==='challenge')) {
    const target={...f,entities:f.entities.filter(e=>options.includes(e.category))};
    let spans=[],error=null;
    try {spans=analyzeText(f.text,'12345678',await engine({text:f.text,options},()=>assert.fail('No model loading'))).spans;}
    catch(failure){error=failure instanceof Error?failure.message:'Local failure';}
    rows.push({...scoreFixture(target,spans,Object.fromEntries(options.map(c=>[c,spans]))),error,
      predictions:spans.map(s=>({...s,value:f.text.slice(s.start,s.end)}))});
  }
  local[options.join('+')]=rows;
}
await writeFile(join(outputRoot,`after-${round}.json`),JSON.stringify({round,protocol,cases,local},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(Object.fromEntries(['regression','challenge'].map(c=>[c,summarizeStage(cases.filter(f=>f.corpus===c).map(f=>f.complete))]))));
