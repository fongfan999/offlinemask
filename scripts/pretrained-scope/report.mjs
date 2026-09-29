import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, fixtures, verify, hash, readJson } from '../model-recheck/common.mjs';
import { variants, productFixture } from './common.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
import { compare } from '../model-recheck/comparison.mjs';
await verify();
const protocol = await readJson(join(root,'docs/evaluations/pretrained-scope/protocol.json'));
for (const [path, expected] of Object.entries(protocol.sourceHashes)) assert.equal(hash(await readFile(join(root,path))),expected,path);
const all = (await fixtures()).map(productFixture), runs = {}, rawHashes = {};
for (const variant of variants) {
  const bytes=await readFile(join(root,`artifacts/pretrained-scope/${variant}.json`));rawHashes[variant+'.json']=hash(bytes);
  runs[variant]=JSON.parse(bytes);assert.deepEqual(runs[variant].protocol,protocol);assert.equal(runs[variant].replayCases,all.length);
}
const byType = rows => Object.fromEntries([...new Set(rows.flatMap(r=>r.entities.map(e=>e.type).filter(Boolean)))].map(type=>{
  const es=rows.flatMap(r=>r.entities.filter(e=>e.type===type));return[type,{total:es.length,full:es.filter(e=>e.full).length,selectedFull:es.filter(e=>e.selectedFull).length}];
}));
const summaries = {}, comparisons = {};
for (const variant of variants) {
  summaries[variant]={};comparisons[variant]={};
  for (const corpus of ['regression','challenge']) {
    summaries[variant][corpus]=Object.fromEntries(['full','contextual','rules','local'].map(route=>{
      const rows=runs[variant].cases.filter(r=>r.corpus===corpus).map(r=>r[route]);return[route,{...summarizeStage(rows),typedEntities:byType(rows)}];
    }));
    const diffs={againstOwnFull:[],againstPair:[]};
    for (const [i,f] of all.entries()) if(f.corpus===corpus) {
      assert.deepEqual([f.id,f.file],[runs[variant].cases[i].id,runs[variant].cases[i].file]);
      diffs.againstOwnFull.push({id:f.id,file:f.file,...compare(f,runs[variant].cases[i].full,runs[variant].cases[i].contextual)});
      diffs.againstPair.push({id:f.id,file:f.file,...compare(f,runs.combined.cases[i].full,runs[variant].cases[i].contextual)});
    }
    comparisons[variant][corpus]=diffs;
  }
  for (const [i,row] of runs[variant].cases.entries()) {
    assert.deepEqual(row.rules,runs.small.cases[i].rules,'Rule baseline must be model independent');
    assert.deepEqual(row.local,runs.small.cases[i].local,'Local baseline must be model independent');
  }
}
const result={createdAt:new Date().toISOString(),protocol,rawHashes,summaries,comparisons,
  limits:'Observed synthetic regression diagnostics; original full scope retained. No new quality qualification, model installation, training, inference timing or desktop resource claim. Rules-only contextual policy is experimental and not actual no-pack engine scope.'};
await writeFile(join(root,'docs/evaluations/pretrained-scope/results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(Object.fromEntries(variants.map(v=>[v,Object.fromEntries(['regression','challenge'].map(c=>[c,Object.fromEntries(['full','contextual','rules','local'].map(route=>{
 const r=summaries[v][c][route];return[route,{full:r.summary.fullyCovered,total:r.summary.entities,categories:r.summary.byCategory,ordinary:r.shortSummary.falsePositiveChars,negative:r.summary.falsePositiveNegativeCases,pass:r.screeningPass,typed:r.typedEntities}];
}))]))])),null,2));
