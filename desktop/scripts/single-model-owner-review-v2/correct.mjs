import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,hash,readJson,verify} from '../single-model-decision-v1/common.mjs';
import {scoreFixture} from '../model-comparison-metrics.mjs';
await verify();
const priorDir=join(root,'docs/evaluations/single-model-owner-review-v1');
const destination=join(root,'docs/evaluations/single-model-owner-review-v2');
const priorVerification=await readJson(join(priorDir,'verification.json'));
for(const[file,digest]of Object.entries(priorVerification.hashes))assert.equal(hash(await readFile(join(priorDir,file))),digest,file);
const previousBytes=await readFile(join(priorDir,'completed.json'));
const completed=JSON.parse(previousBytes);
const overlay=await readJson(join(priorDir,'reviewed-cases.json'));
const candidates=await readJson(join(output,'candidates.json'));
assert.equal(hash(await readFile(join(output,'candidates.json'))),completed.bindings.output);
const row=completed.cases.find(c=>c.number===8),fixture=overlay.cases.find(c=>c.number===8);
assert.equal(hash(fixture.text),row.textSha256);
const value='Hop tac xa Nong san Suoi Mo',start=fixture.text.indexOf(value);
assert.ok(start>=0);
const entities=[{start,end:start+value.length,value,category:'other',type:'organization'}];
row.expectedSpans=entities;
row.reviewStatus='CORRECTED_BY_OWNER';
row.reconciliation='Owner corrects prior keep-visible expectation: organization names must be hidden. Both saved models mask only Nong san Suoi Mo as a location, missing the legal prefix and the intended organization category.';
row.correctionVerbatim="I thought I made a mistake, so organization names should be hidden, anything else?";
for(const[label,variant]of Object.entries({A:'underthesea',B:'bigmed'})){
 const saved=candidates[variant].find(c=>c.id===row.id&&c.file===row.file).canonical;
 const scores=scoreFixture({...fixture,entities},saved.predictions,saved.selectedPredictions);
 row.assessments[label]={acceptable:scores.entities.every(e=>e.selectedFull)&&scores.falsePositiveChars===0,...scores,
  predictions:saved.predictions,selectedPredictions:saved.selectedPredictions};
 assert.equal(row.assessments[label].acceptable,false);
 assert.equal(scores.falsePositiveChars,0);
 assert.equal(scores.entities[0].selectedFull,false);
}
fixture.entities=entities;
fixture.provenance={...fixture.provenance,source:'Owner review plus explicit organization-scope correction',reviewStatus:'CORRECTED_BY_OWNER'};
completed.summary=Object.fromEntries(['A','B'].map(label=>[label,{model:label==='A'?'underthesea':'bigmed',reviewedCases:12,
 acceptableCases:completed.cases.filter(c=>c.assessments[label].acceptable).map(c=>c.number),
 unacceptableCases:completed.cases.filter(c=>!c.assessments[label].acceptable).map(c=>c.number)}]));
assert.equal(completed.summary.A.acceptableCases.length,5);assert.equal(completed.summary.B.acceptableCases.length,9);
assert.ok(completed.cases.find(c=>c.number===5).expectedSpans.some(e=>e.value==='KH847291'));
completed.completedAt=new Date().toISOString();
completed.supersedes={path:'single-model-owner-review-v1/completed.json',sha256:hash(previousBytes),reason:'Owner explicitly corrects organization example and scope.'};
completed.scope='Organization names are in masking scope, consistent with the existing other category. Customer identifiers remain in banking scope. Existing user category selection still applies. No model approval or training inferred.';
completed.correctionScriptSha256=hash(await readFile(new URL(import.meta.url)));
await writeFile(join(destination,'completed.json'),JSON.stringify(completed,null,2)+'\n',{flag:'wx'});
overlay.reviewSha256=hash(await readFile(join(destination,'completed.json')));
overlay.scope='Owner-reviewed observed regression overlay corrected to hide full organization names. Historical v1 preserved. Not an independent holdout or training corpus.';
await writeFile(join(destination,'reviewed-cases.json'),JSON.stringify(overlay,null,2)+'\n',{flag:'wx'});
await verify();
const hashes={};for(const f of ['completed.json','reviewed-cases.json'])hashes[f]=hash(await readFile(join(destination,f)));
await writeFile(join(destination,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),hashes,
 previousEvidence:'Verified unchanged',newInferenceRuns:0,correctedCase:8,remainingScopeQuestions:[],
 summary:completed.summary},null,2)+'\n',{flag:'wx'});
console.log('Organization correction recorded; original evidence unchanged; A 5/12, B 9/12.');
