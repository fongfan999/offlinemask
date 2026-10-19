// Verify partial own-category coverage against the exact original policy, not
// against an approximation reconstructed from already-masked preview spans.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, hash, readJson, verify, fixtures, outputRoot } from './policy-hardening-v2/common.mjs';
import { loadCandidate } from './shared-core/candidates.mjs';
import { verifyAssets } from './shared-core/evidence.mjs';
import { analyzeText } from '../src/core/text.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { categories, scoreFixture } from './model-comparison-metrics.mjs';
const protocol=await verify(),base=await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json'));
const expected=await readJson(join(root,'docs/evaluations/policy-hardening-v2-results.json'));
const sourceSha256=hash(await readFile(join(root,'scripts/policy-hardening-selected-audit.mjs')));
const manifest={createdAt:new Date().toISOString(),sourceSha256,
  policyProtocolSha256:hash(await readFile(join(root,'docs/evaluations/policy-hardening-v2-protocol.json'))),
  method:'Reconstruct hash-verified original core in ignored artifacts. Replay both policies on the same real current model-derived Detection arrays. Assert both policies reproduce their saved all-options previews and previous selected-full flags. Compare exact non-whitespace own-category covered positions for every annotated value, including partial coverage.'};
await writeFile(join(root,'docs/evaluations/policy-hardening-selected-audit-protocol.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
for(const [file,digest] of Object.entries(base.files)) if(file.startsWith('src/core/')) {
  const source=protocol.beforeSources[file]??await readFile(join(root,file),'utf8');assert.equal(hash(source),digest,file);
  const dest=join(outputRoot,'reference',file);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,source);
}
const oldPolicy=await import(pathToFileURL(join(outputRoot,'reference/src/core/detection/policy.ts')));
const oldOptions=await import(pathToFileURL(join(outputRoot,'reference/src/core/detection/options.ts')));
const legacy=await readJson(join(root,'docs/evaluations/shared-core-comparison.json'));
const challenge=await readJson(join(root,'docs/evaluations/release-challenge-v1-results.json'));
const oldRows={regression:legacy.results.find(r=>r.variant==='combined').cases,challenge:challenge.candidates.combined.cases};
const fs=await fixtures(),byKey=rows=>new Map(rows.map(c=>[`${c.file??'release-challenge-v1.json'}/${c.id}`,c]));
const oldMaps={regression:byKey(oldRows.regression),challenge:byKey(oldRows.challenge)},newMap=byKey(expected.cases);
await verifyAssets(base,'combined');
globalThis.fetch=async()=>{throw Error('Network forbidden during selected-category audit');};
const detector=await loadCandidate(root,'combined',fs.map(f=>f.text)),outcomes=[];
try {
  for(const f of fs) {
    const current=await detector.inspect(f.text),previous=oldPolicy.applyDetectionPolicy(f.text,current.modelOnly);
    assert.deepEqual(previous.modelOnly,current.modelOnly,'Shared model merge must be idempotent');
    const saved=oldMaps[f.corpus].get(`${f.file}/${f.id}`),savedNew=newMap.get(`${f.file}/${f.id}`);
    const spans=ds=>analyzeText(f.text,'12345678',ds).spans;
    const predicted=ds=>spans(ds).map(s=>({...s,value:f.text.slice(s.start,s.end)}));
    assert.deepEqual(predicted(previous.complete),saved.complete.predictions,`Before replay: ${f.id}`);
    assert.deepEqual(predicted(current.complete),savedNew.complete.predictions,`After replay: ${f.id}`);
    const oldSelected=Object.fromEntries(categories.map(c=>[c,spans(oldOptions.filterDetections(previous.complete,[c]))]));
    const newSelected=Object.fromEntries(categories.map(c=>[c,spans(filterDetections(current.complete,[c]))]));
    const scored=scoreFixture(f,spans(previous.complete),oldSelected);
    assert.deepEqual(scored.entities.map(e=>e.selectedFull),saved.complete.entities.map(e=>e.selectedFull),'Original selected flags must replay');
    const counts=(entity,selected)=>{
      let count=0;for(let p=entity.start;p<entity.end;p++) if(!/\s/u.test(f.text[p])&&selected[entity.category].some(s=>s.start<=p&&p<s.end))count++;
      return count;
    };
    for(const e of f.entities) {
      const before=counts(e,oldSelected),after=counts(e,newSelected);
      assert.ok(after>=before,`Own-category partial regression: ${f.file}/${f.id}/${e.value}`);
      outcomes.push({file:f.file,id:f.id,category:e.category,start:e.start,end:e.end,before,after});
    }
    if(outcomes.length%50===0)console.log('Verified values',outcomes.length);
  }
}finally{await detector.dispose();}
await writeFile(join(root,'docs/evaluations/policy-hardening-selected-audit.json'),JSON.stringify({createdAt:new Date().toISOString(),manifest,
  cases:fs.length,categorySelections:fs.length*categories.length,annotatedValues:outcomes.length,regressions:0,outcomes},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:fs.length,categorySelections:fs.length*categories.length,values:outcomes.length,regressions:0}));
