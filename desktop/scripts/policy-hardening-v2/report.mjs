import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {summarizeStage} from '../shared-core/metrics.mjs';
import {root,hash,readJson,fixtures,verify,outputRoot} from './common.mjs';
const protocol=await verify();
const one=await readJson(join(outputRoot,'after-1.json')),two=await readJson(join(outputRoot,'after-2.json'));
assert.deepEqual(one.protocol,protocol);assert.deepEqual(two.protocol,protocol);
assert.deepEqual(one.cases,two.cases);assert.deepEqual(one.local,two.local);
const legacy=await readJson(join(root,'docs/evaluations/shared-core-comparison.json'));
const challenge=await readJson(join(root,'docs/evaluations/release-challenge-v1-results.json'));
// The baseline report schemas differ; retain each original row without changing scores.
const regressionCases=legacy.results.find(r=>r.variant==='combined')?.cases;
assert.ok(regressionCases,'Locate frozen regression pair rows');
const before={regression:regressionCases,challenge:challenge.candidates.combined.cases};
const comparisons={};
const originals=new Map((await fixtures()).map(f=>[`${f.corpus}/${f.file}/${f.id}`,f.text]));
for(const corpus of ['regression','challenge']) {
  const after=one.cases.filter(c=>c.corpus===corpus),baseline=before[corpus];
  assert.equal(after.length,baseline.length);
  const gains=[],losses=[],selectedGains=[],selectedLosses=[],partialRegressions=[],extraMasking=[];
  for(let i=0;i<after.length;i++) {
    const a=after[i].complete,b=baseline[i].complete;assert.equal(a.id,b.id);
    assert.deepEqual(after[i].modelOnly.predictions,baseline[i].modelOnly.predictions,'Model-derived predictions must remain unchanged');
    for(let j=0;j<b.entities.length;j++) {
      const old=b.entities[j],current=a.entities[j];assert.deepEqual([old.start,old.end,old.value],[current.start,current.end,current.value]);
      const item={file:after[i].file,id:a.id,category:old.category,value:old.value,from:old.covered,to:current.covered};
      if(!old.full&&current.full)gains.push(item);if(old.full&&!current.full)losses.push(item);
      if(!old.selectedFull&&current.selectedFull)selectedGains.push(item);if(old.selectedFull&&!current.selectedFull)selectedLosses.push(item);
      if(current.covered<old.covered)partialRegressions.push(item);
    }
    const text=originals.get(`${corpus}/${after[i].file}/${a.id}`);
    const newOrdinaryMask=a.falsePositives.some(span=>Array.from({length:span.end-span.start},(_,j)=>span.start+j).some(p=>/[\p{L}\p{M}\p{N}]/u.test(text[p])&&!b.falsePositives.some(old=>old.start<=p&&p<old.end)));
    if(newOrdinaryMask)extraMasking.push({id:a.id,file:after[i].file,before:b.falsePositiveChars,after:a.falsePositiveChars,spans:a.falsePositives});
  }
  comparisons[corpus]={before:summarizeStage(baseline.map(c=>c.complete)),after:summarizeStage(after.map(c=>c.complete)),gains,losses,selectedGains,selectedLosses,partialRegressions,extraMasking};
}
await writeFile(join(root,'docs/evaluations/policy-hardening-v2-results.json'),JSON.stringify({createdAt:new Date().toISOString(),protocol,repeatedOutputsIdentical:true,
  rawHashes:Object.fromEntries(await Promise.all(['after-1.json','after-2.json'].map(async p=>[p,hash(await readFile(join(outputRoot,p)))]))),
  comparisons,cases:one.cases,local:one.local},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(comparisons));
