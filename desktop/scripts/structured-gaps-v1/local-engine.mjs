import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verify, root, hash, fixtures } from './common.mjs';
import { createDetectionEngine } from '../../src/core/detection/engine.ts';
import { localOptions } from '../../src/core/detection/options.ts';
import { score, productFixture } from '../pretrained-scope/common.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
const protocol = await verify();
globalThis.fetch = async () => { throw Error('Network forbidden'); };
const engine = createDetectionEngine(), cases = [];
for (const original of await fixtures()) {
  const f = productFixture(original);
  const detections = await engine({text:f.text,options:localOptions}, () => assert.fail('No-pack route loaded a model'));
  const selected = {...f,entities:f.entities.filter(e=>localOptions.includes(e.category))};
  // Other private annotations are outside this route, not ordinary text. Report
  // ordinary masking against the complete annotation set, coverage against scope.
  cases.push({id:f.id,file:f.file,corpus:f.corpus,selected:score(selected,detections),full:score(f,detections)});
}
const summaries = Object.fromEntries(['regression','challenge'].map(corpus => {
  const rows = cases.filter(c=>c.corpus===corpus);
  return [corpus,{selectedScope:summarizeStage(rows.map(r=>r.selected)),fullScope:summarizeStage(rows.map(r=>r.full))}];
}));
const result = {createdAt:new Date().toISOString(),sourceHash:hash(await readFile(new URL(import.meta.url))),protocolHash:hash(JSON.stringify(protocol)),summaries,cases};
await writeFile(join(root,'docs/evaluations/structured-gaps-v1/local-engine.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
for (const [c,s] of Object.entries(summaries)) console.log(c,JSON.stringify({covered:s.selectedScope.summary.fullyCovered,total:s.selectedScope.summary.entities,ordinary:s.fullScope.summary.falsePositiveChars}));
