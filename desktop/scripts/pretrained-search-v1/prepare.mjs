import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fixtures,verify,hash} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {productFixture} from '../pretrained-scope/common.mjs';
await verify();
const {cases:approved}=await verifyExecution();
const owner=JSON.parse(await readFile('docs/evaluations/single-model-owner-review-v2/reviewed-cases.json'));
const receipt=JSON.parse(await readFile('docs/evaluations/single-model-owner-review-v2/verification.json'));
for(const[file,digest]of Object.entries(receipt.hashes))
 assert.equal(hash(await readFile(`docs/evaluations/single-model-owner-review-v2/${file}`)),digest,file);
const cases=[...(await fixtures()).map(productFixture),
 ...approved.map(f=>({...f,corpus:'approved24'})),
 ...owner.cases.map(f=>({...f,corpus:'owner12'}))];
assert.equal(cases.length,398);
const inputs=cases.map((f,index)=>({index,id:f.id,corpus:f.corpus,text:f.text.normalize('NFC')}));
for(const[name,value]of Object.entries({cases,inputs}))
 await writeFile(`artifacts/pretrained-search-v1/${name}.json`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const files=['scripts/pretrained-search-v1/prepare.mjs','scripts/pretrained-search-v1/infer.py',
 'scripts/pretrained-search-v1/score.mjs','scripts/pretrained-search-v1/report.mjs',
 'scripts/pretrained-scope/common.mjs','scripts/shared-core/metrics.mjs',
 'scripts/model-comparison-metrics.mjs','scripts/contextual-repair-v1/normalized-source.mjs',
 'src/core/detection/model-policy.ts','artifacts/pretrained-search-v1/manifest.json',
 'artifacts/pretrained-search-v1/cases.json','artifacts/pretrained-search-v1/inputs.json',
 'docs/evaluations/single-model-owner-review-v2/reviewed-cases.json'];
const library='artifacts/pretrained-search-v1/python-packages/gliner';
for(const f of await readdir(library,{recursive:true}))if(f.endsWith('.py'))files.push(`${library}/${f}`);
const p={frozenAt:new Date().toISOString(),candidate:'GreenNode/gliner-pii-base-v1.0-tuned',
 revision:'85cf26b39f2a02d9af9af483ac66b2194bf14c9f',labels:['name','street address','location','organization'],
 threshold:0.3,flatNer:true,multiLabel:false,maxInputTokens:384,overlapWords:24,maxWindowCharacters:1200,
 role:'Contextual names, addresses and organizations; existing shared rules handle structured fields. No tuning.',
 runtime:'GLiNER 0.2.22 / torch 2.8.0 / transformers 4.57.6, CPU FP32, four threads; strict weights-only loading',
 evidence:'362 historical cases, 24 approved before earlier inference, 12 overlapping owner-reviewed cases reported separately. No fresh holdout.',
 files:Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])))};
await writeFile('docs/evaluations/pretrained-search-v1/protocol.json',JSON.stringify(p,null,2)+'\n',{flag:'wx'});
console.log('Frozen 398 case executions; owner12 overlaps historical corpus.');
