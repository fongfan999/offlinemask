import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {hash} from '../single-model-decision-v1/common.mjs';
const dir='docs/evaluations/quality-first-v1',artifact='artifacts/quality-first-v1';
const bytes=await readFile(`${dir}/results.json`),data=JSON.parse(bytes),best=data.recipes[0];
assert.equal(best.id,data.selectedCandidate);
const cases=JSON.parse(await readFile(`${artifact}/cases.json`));
const original=JSON.parse(await readFile('docs/evaluations/shared-core-protocol-v2.json'));
const models=JSON.parse(await readFile('scripts/model-manifest.json')).models;
const readme=[];
const contributions=best.variants.map(variant=>{
 const without=data.recipes.find(r=>r.route===best.route&&r.variants.length===best.variants.length-1&&r.variants.every(v=>v!==variant&&best.variants.includes(v)));
 const gains=[],losses=[];
 for(const[i,o]of best.outcomes.entries())if(o.corpus!=='owner12')for(const[j,e]of o.result.entities.entries()){
  const previous=without.outcomes[i].result.entities[j];
  if(e.selectedFull&&!previous.selectedFull)gains.push({id:o.id,corpus:o.corpus,value:e.value,category:e.category});
  if(!e.selectedFull&&previous.selectedFull)losses.push({id:o.id,corpus:o.corpus,value:e.value,category:e.category});
 }
 return{variant,ownCategoryGain:best.own-without.own,extraOrdinaryPositions:best.ordinary-without.ordinary,gains,losses};
});
const missed=best.outcomes.filter(o=>o.corpus!=='owner12').flatMap(o=>o.result.entities.filter(e=>!e.selectedFull).map(e=>({id:o.id,corpus:o.corpus,...e})));
const selection={selectedAt:new Date().toISOString(),status:'SELECTED_FOR_V1_INTEGRATION_NOT_RELEASE_QUALIFIED',
 candidate:best.id,userDirection:'Automatic contextual masking remains required. Select highest measured complete sensitive-value coverage; size secondary. One optional pack; no training or telemetry.',
 variants:best.variants,role:'Models: TEN/DIA_CHI/TO_CHUC only. Structured fields: unchanged shared rules. Normalize inference to NFC and restore original offsets before shared reconciliation.',
 policyOrder:best.variants,modelAssetBytes:best.assetBytes,ownCategoryCovered:best.own,annotatedValues:best.total,
 matchedCases:best.matchingCases,caseRecords:386,missed,contributions,
 assets:Object.fromEntries(best.variants.map(v=>[v,original.assets[v]])),
 upstreamReferences:{underthesea:'undertheseanlp/vietnamese-ner-v1.4.0a2@a51e05fc09e1b1f0800dbad8ae84e86ad311debd (locally exported INT8; conversion provenance in shared-core-protocol-v2)',
 bigmed:'OpenMed/OpenMed-PII-Vietnamese-BigMed-Large-278M-v1-onnx-android@2c996ac92e24c939755a8197c3f574c4f65874cf',
 large:`${models.find(m=>m.directory==='vietnamese-pii-multilingual').repository}@${models.find(m=>m.directory==='vietnamese-pii-multilingual').revision}`},
 releaseGate:data.releaseGate,applicationChanged:false,
 fullResults:{path:`${artifact}/full-results.json`,sha256:hash(bytes)},
 integrationRemaining:['Native/preprocessing parity for all selected graphs without developer Python/reference caches',
 'Explicitly installable verified pack containing the locally converted Underthesea artifact',
 'Packaged memory/latency, startup/processing network checks, and release quality failures'],
 limits:'Best among this finite observed synthetic comparison, not a universal best model or field accuracy. No permission to lower thresholds inferred.'};
await writeFile(`${dir}/selection.json`,JSON.stringify(selection,null,2)+'\n',{flag:'wx'});
const compact={...data,recipes:undefined,selectedOutcomes:best.outcomes,fullResults:selection.fullResults};
await rename(`${dir}/results.json`,`${artifact}/full-results.json`);
await writeFile(`${dir}/results.json`,JSON.stringify(compact,null,2)+'\n',{flag:'wx'});
readme.push('# Selected candidate: exact synthetic previews\n','Source text is synthetic. Selection metric excludes the overlapping owner12 group. No production or banking accuracy claim.\n');
for(const[i,o]of best.outcomes.entries()){
 const f=cases[i];assert.equal(f.id,o.id);
 readme.push(`## ${o.corpus} · ${o.id}\n\n\`\`\`text\n${f.text}\n\`\`\`\n\nExpected: ${f.entities.map(e=>`${JSON.stringify(e.value)} (${e.category})`).join('; ')||'Keep everything'}.\n\nActual: ${o.result.predictions.map(p=>`${JSON.stringify(p.value)} → ${p.findingId}`).join('; ')||'Keep everything'}.\n\nIncomplete own-option values: ${o.result.entities.filter(e=>!e.selectedFull).map(e=>JSON.stringify(e.value)).join('; ')||'None'}. Extra ordinary lexical positions: ${o.result.falsePositiveChars}.\n`);
}
await writeFile(`${dir}/previews.md`,readme.join('\n'),{flag:'wx'});
console.log(selection.candidate,selection.status);
