import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtures, verify, root, hash } from '../model-recheck/common.mjs';
import { createDetectionEngine } from '../../src/core/detection/engine.ts';
import { score, productFixture } from './common.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
await verify();
const options=['email','phone','banking'],engine=createDetectionEngine(),cases=[];
globalThis.fetch=async()=>{throw Error('No networking in local scope audit');};
for(const f of (await fixtures()).map(productFixture)){
 const detections=await engine({text:f.text,options},()=>assert.fail('Local scope must not load a model'));
 cases.push({id:f.id,file:f.file,corpus:f.corpus,full:score(f,detections),selected:score({...f,entities:f.entities.filter(e=>options.includes(e.category))},detections)});
}
const sourceHashes={};
for(const path of ['docs/evaluations/pretrained-scope/local-scope-addendum.md','scripts/pretrained-scope/local-engine.mjs','src/core/detection/engine.ts','src/core/detection/options.ts','scripts/pretrained-scope/common.mjs'])sourceHashes[path]=hash(await readFile(join(root,path)));
const summaries=Object.fromEntries(['regression','challenge'].map(c=>[c,Object.fromEntries(['full','selected'].map(route=>[route,summarizeStage(cases.filter(r=>r.corpus===c).map(r=>r[route]))]))]));
await writeFile(join(root,'docs/evaluations/pretrained-scope/local-engine-results.json'),JSON.stringify({createdAt:new Date().toISOString(),options,sourceHashes,cases,summaries,
 limits:'The generic six-category screening flag is inapplicable to the selected three-category denominator. Compare explicit per-category counts. Original full-scope scoring intentionally includes unsupported categories.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(Object.fromEntries(Object.entries(summaries).map(([c,s])=>[c,{full:s.full.summary.fullyCovered,selected:s.selected.summary.byCategory,ordinary:s.selected.shortSummary.falsePositiveChars}]))));
