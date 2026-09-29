import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {directory,output,hash,readJson,verifyExecution} from './common.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
const {cases,protocol}=await verifyExecution();
const report=await readJson(join(directory,'results.json'));
for(const variant of protocol.variants){
 const bytes=await readFile(join(output,variant+'.json')),run=JSON.parse(bytes);
 assert.equal(hash(bytes),report.rawHashes[variant]);assert.equal(run.cases.length,24);
 for(const[i,f]of cases.entries()){
  const row=run.cases[i];assert.equal(row.result.error,null);
  const replay=score(f,applyDetectionPolicy(f.text,row.modelOnly).complete);
  // JSON output omits undefined optional recordId/representation properties.
  // Compare the same serialization, preserving every scored value and preview.
  assert.deepEqual(JSON.parse(JSON.stringify(replay)),row.result);
 }
}
const files={};for(const name of ['execution-protocol.json','results.json','comparison.md'])files[name]=hash(await readFile(join(directory,name)));
await writeFile(join(directory,'execution-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),files,
 verifierSha256:hash(await readFile(new URL(import.meta.url))),approvedCases:24,caseExecutions:48,errors:0,replayedFullAndSixCategoryResults:48,
 historicalAndProductionSources:'Verified unchanged',releaseDecision:report.releaseDecision,
 method:'Re-score saved real model detections with unchanged policy and assert exact serialized result identity; no new inference.',
 verificationNote:'Initial inline replay check differed only on optional undefined properties omitted by JSON. Final verifier uses identical serialization; no data, scores or outputs changed.'},null,2)+'\n',{flag:'wx'});
console.log('Verified all approvals and 48 exact serialized result replays; no production changes.');
