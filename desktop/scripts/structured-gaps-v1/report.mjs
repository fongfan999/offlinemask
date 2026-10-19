import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, output, verify, hash, variants, routes } from './common.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
const protocol = await verify(), summaries = {}, rawHashes = {};
for (const variant of variants) {
  const bytes = await readFile(join(output,`${variant}.json`)), run = JSON.parse(bytes);
  rawHashes[variant] = hash(bytes); assert.deepEqual(run.protocol,protocol); assert.equal(run.cases.length,protocol.cases);
  summaries[variant] = {};
  for (const corpus of ['regression','challenge']) {
    summaries[variant][corpus] = {};
    for (const route of routes) {
      const rows = run.cases.filter(c => c.corpus === corpus).map(c => c.routes[route]);
      const changes = Object.fromEntries(['gains','losses','selectedGains','selectedLosses','positionLosses','addedOrdinary'].map(key => [key,rows.flatMap(r => r.changes[key])]));
      summaries[variant][corpus][route] = {
        before:summarizeStage(rows.map(r=>r.before)), after:summarizeStage(rows.map(r=>r.after)), changes,
      };
    }
  }
}
const result = {createdAt:new Date().toISOString(),rawHashes,summaries,
  limits:'Observed synthetic diagnostics, not independently reviewed accuracy or release qualification. No model, UI, category routing or installed pack change. Rules and raw local paths are diagnostic; other still requires a pack.'};
await writeFile(join(root,'docs/evaluations/structured-gaps-v1/results.json'), JSON.stringify(result,null,2)+'\n',{flag:'wx'});
for (const [v, corpora] of Object.entries(summaries)) for (const [c, rs] of Object.entries(corpora)) for (const [r,s] of Object.entries(rs)) console.log(v,c,r,JSON.stringify({
  before:s.before.summary.fullyCovered,after:s.after.summary.fullyCovered,total:s.after.summary.entities,
  changes:Object.fromEntries(Object.entries(s.changes).map(([k,v])=>[k,v.length]))}));
