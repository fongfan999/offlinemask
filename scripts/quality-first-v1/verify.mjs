import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {score,contextual} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {summarizeStage} from '../shared-core/metrics.mjs';
await verify();await verifyExecution();
const dir='docs/evaluations/quality-first-v1',art='artifacts/quality-first-v1';
const read=async p=>JSON.parse(await readFile(p));
const p=await read(`${dir}/protocol.json`),compact=await read(`${dir}/results.json`),selection=await read(`${dir}/selection.json`);
for(const[f,digest]of Object.entries(p.files))assert.equal(hash(await readFile(f)),digest,f);
const full=await read(compact.fullResults.path);
assert.equal(hash(await readFile(compact.fullResults.path)),compact.fullResults.sha256);
assert.equal(hash(await readFile(`${dir}/protocol.json`)),full.protocolSha256);
assert.deepEqual(compact.ranking,full.ranking);
const cases=await read(`${art}/cases.json`),runs={};
for(const v of p.variants){
 const path=`${art}/${v}.json`;assert.equal(hash(await readFile(path)),full.rawHashes[v]);
 const run=await read(path);assert.deepEqual(run.protocol,p);assert.equal(run.outcomes.length,398);runs[v]=run.outcomes;
 for(const[i,f]of cases.entries()){
  const r=run.outcomes[i];assert.equal(r.id,f.id);assert.equal(r.corpus,f.corpus);assert.equal(r.result.error,null);
  assert.deepEqual(JSON.parse(JSON.stringify(score(f,applyDetectionPolicy(f.text,r.modelOnly).complete))),r.result);
 }
}
assert.equal(full.recipes.length,30);
for(const recipe of full.recipes){
 assert.equal(recipe.outcomes.length,398);
 for(const[i,f]of cases.entries()){
  const ds=recipe.variants.flatMap(v=>runs[v][i].modelOnly);
  const replay=JSON.parse(JSON.stringify(score(f,applyDetectionPolicy(f.text,recipe.route==='contextual'?contextual(ds):ds).complete)));
  const saved=recipe.outcomes[i];assert.deepEqual(replay,saved.result,`${recipe.id}:${f.id}`);
  assert.equal(saved.matches,replay.entities.every(e=>e.selectedFull)&&replay.falsePositiveChars===0);
 }
 for(const[corpus,stage]of Object.entries(recipe.stages)){
  const rows=recipe.outcomes.filter(r=>r.corpus===corpus);
  assert.deepEqual({...summarizeStage(rows.map(r=>r.result)),matchingCases:rows.filter(r=>r.matches).length},stage);
 }
 const ranked=recipe.outcomes.filter(r=>r.corpus!=='owner12');
 assert.equal(recipe.own,ranked.flatMap(r=>r.result.entities).filter(e=>e.selectedFull).length);
 assert.equal(recipe.total,500);assert.equal(recipe.ordinary,ranked.reduce((s,r)=>s+r.result.falsePositiveChars,0));
 assert.equal(recipe.matchingCases,ranked.filter(r=>r.matches).length);
 assert.equal(recipe.passes,['regression','challenge','approved24'].every(k=>recipe.stages[k].screeningPass));
}
const ranked=[...full.recipes].sort((a,b)=>Number(b.passes)-Number(a.passes)||b.own-a.own||a.ordinary-b.ordinary||a.variants.length-b.variants.length||a.assetBytes-b.assetBytes||a.id.localeCompare(b.id));
assert.deepEqual(ranked.map(r=>r.id),full.ranking.map(r=>r.id));
assert.equal(selection.candidate,ranked[0].id);assert.deepEqual(compact.selectedOutcomes,ranked[0].outcomes);
assert.equal(selection.ownCategoryCovered,ranked[0].own);assert.equal(selection.annotatedValues,500);
const receipt={verifiedAt:new Date().toISOString(),modelCaseExecutions:1592,errors:0,recipes:30,
 scoredCaseReplays:11940,allSixOptionPreviews:'Exact match',priorCoreAndOwnerApprovals:'Unchanged',
 selected:selection.candidate,releaseGate:full.releaseGate,
 resultsSha256:hash(await readFile(`${dir}/results.json`)),selectionSha256:hash(await readFile(`${dir}/selection.json`)),
 fullResultsSha256:compact.fullResults.sha256};
await writeFile(`${dir}/verification.json`,JSON.stringify(receipt,null,2)+'\n');console.log(receipt);
