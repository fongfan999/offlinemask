import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,fixtures,readJson,hash,verify} from './common.mjs';
import {summarizeStage} from '../shared-core/metrics.mjs';
import {score,productFixture,assertReplay,contextual} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
import {compare} from '../model-recheck/comparison.mjs';
await verify();const all=(await fixtures()).map(productFixture);
const under=await readJson(join(root,'artifacts/contextual-repair-v1/underthesea.json'));
const big=await readJson(join(output,'bigmed.json'));
const candidates={underthesea:[],bigmed:big.cases};
for(const[i,f]of all.entries()){
 const saved=under.cases[i];assert.deepEqual([f.id,f.file],[saved.id,saved.file]);
 const canonical=score(f,applyDetectionPolicy(f.text,saved.normalizedModelOnly).complete);
 assertReplay(canonical,saved.both,f.id);
 candidates.underthesea.push({id:f.id,file:f.file,corpus:f.corpus,raw:saved.address,canonical,
  contextual:score(f,applyDetectionPolicy(f.text,contextual(saved.normalizedModelOnly)).complete),modelOnly:saved.normalizedModelOnly});
}
const assets=await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json'));
const summaries={},rankings=[];
for(const[v,rows]of Object.entries(candidates)){
 summaries[v]={};
 for(const corpus of ['regression','challenge'])summaries[v][corpus]=Object.fromEntries(['raw','canonical','contextual'].map(route=>[route,summarizeStage(rows.filter(r=>r.corpus===corpus).map(r=>r[route]))]));
 const s=summarizeStage(rows.map(r=>r.canonical)).summary;
 rankings.push({variant:v,ownCategoryCovered:Object.values(s.byCategory).reduce((n,c)=>n+c.selectedFull,0),total:s.entities,
  ordinary:s.falsePositiveChars,assetBytes:assets.assets[v].reduce((n,a)=>n+a.downloadBytes,0),
  passesBoth:Object.values(summaries[v]).every(c=>c.canonical.screeningPass)});
}
rankings.sort((a,b)=>b.ownCategoryCovered-a.ownCategoryCovered||a.ordinary-b.ordinary||a.assetBytes-b.assetBytes);
const comparisons=all.map((f,i)=>({id:f.id,file:f.file,corpus:f.corpus,...compare(f,candidates.bigmed[i].canonical,candidates.underthesea[i].canonical)}));
const result={createdAt:new Date().toISOString(),summaries,rankings,resourceCandidate:rankings[0].variant,
 releaseDecision:rankings.some(r=>r.passesBoth)?'QUALITY_SCREEN_ONLY_REVIEW_PENDING':'REJECT_BOTH_FOR_RELEASE',
 reviewStatus:'PENDING_OWNER_REVIEW',comparisons,
 evidence:{underthesea:hash(await readFile(join(root,'artifacts/contextual-repair-v1/underthesea.json'))),bigmed:hash(await readFile(join(output,'bigmed.json')))},
 limits:'Observed synthetic cases; Underthesea inference reused with exact replay; BigMed newly executed. Resource candidate is an engineering ranking, not release selection.'};
await writeFile(join(root,'docs/evaluations/single-model-decision-v1/results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
await writeFile(join(output,'candidates.json'),JSON.stringify(candidates,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:result.releaseDecision,rankings,summaries},null,2));
