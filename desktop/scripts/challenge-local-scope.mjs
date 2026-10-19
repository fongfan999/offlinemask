// Separate audit of the actual model-free application path; no detector tuning.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDetectionEngine } from '../src/core/detection/engine.ts';
import { analyzeText } from '../src/core/text.ts';
import { scoreFixture, summarize } from './model-comparison-metrics.mjs';
import { root, hash, readJson, fixtures, verify } from './challenge-core/common.mjs';
const protocolPath=join(root,'docs/evaluations/release-challenge-local-scope-protocol.json');
const resultPath=join(root,'docs/evaluations/release-challenge-local-scope-results.json');
const sourcePath=join(root,'scripts/challenge-local-scope.mjs');
const parent=await verify();
const scopes={combined:['email','phone','banking'],email:['email'],phone:['phone'],banking:['banking']};
if(process.argv[2]==='--freeze') {
  await writeFile(protocolPath,JSON.stringify({createdAt:new Date().toISOString(),
    parentProtocolSha256:hash(await readFile(join(root,'docs/evaluations/release-challenge-v1-protocol.json'))),sourceSha256:hash(await readFile(sourcePath)),scopes,
    reason:'Separate evaluation of actual no-pack category selections. The model comparison scores selected categories by filtering each candidate complete detector; that is not the app model-free path.',
    method:'Same 100 synthetic cases, two passes, no modelRoot, fetch blocked and any model loading progress fails. All unselected categories must remain unmasked. Counts describe cases and occurrences, not independent records.',
    criteria:'Every expected local critical value fully covered in its selected scope, zero failures, at most 1% ordinary lexical masking on short cases, at most one affected original all-ordinary negative case. Diagnostic audit; no thresholds or production code changed.'},null,2)+'\n',{flag:'wx'});
  process.exit(0);
}
assert.equal(process.argv[2],'--run');
const protocol=await readJson(protocolPath);
assert.equal(hash(await readFile(sourcePath)),protocol.sourceSha256);
assert.equal(hash(await readFile(join(root,'docs/evaluations/release-challenge-v1-protocol.json'))),protocol.parentProtocolSha256);
assert.deepEqual(scopes,protocol.scopes);
globalThis.fetch=async()=>{throw Error('Network forbidden in local scope audit');};
const original=await fixtures(),rounds=[];
for(let round=0;round<2;round++) {
  const run={};
  const detect=createDetectionEngine();
  for(const [scope,options] of Object.entries(scopes)) {
    const cases=[];
    for(const f of original) {
      const target={...f,entities:f.entities.filter(e=>options.includes(e.category))};
      let spans=[],error=null;
      try {
        const detections=await detect({text:f.text,options},()=>assert.fail('Model loading forbidden'));
        spans=analyzeText(f.text,'12345678',detections).spans;
      } catch(failure) {error=failure instanceof Error?failure.message:'Local scope failed';}
      cases.push({...scoreFixture(target,spans,Object.fromEntries(options.map(c=>[c,spans]))),error,
        recordId:f.recordId,representation:f.representation,originalNegative:f.entities.length===0,
        predictions:spans.map(s=>({...s,value:f.text.slice(s.start,s.end)}))});
    }
    const summary=summarize(cases),shortSummary=summarize(cases.filter(c=>c.group!=='long'));
    const affectedOriginalNegatives=cases.filter(c=>c.originalNegative&&c.falsePositiveChars>0).length;
    run[scope]={summary,shortSummary,affectedOriginalNegatives,
      pass:summary.failedCases===0&&summary.fullyCovered===summary.entities&&shortSummary.excessMaskingRate<=.01&&affectedOriginalNegatives<=1,cases};
  }
  rounds.push(run);
}
assert.deepEqual(rounds[0],rounds[1]);
await writeFile(resultPath,JSON.stringify({createdAt:new Date().toISOString(),protocol,repeatedOutputsIdentical:true,scopes:rounds[0]},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(Object.fromEntries(Object.entries(rounds[0]).map(([name,r])=>[name,{full:r.summary.fullyCovered,total:r.summary.entities,failed:r.summary.failedCases,pass:r.pass}]))));
