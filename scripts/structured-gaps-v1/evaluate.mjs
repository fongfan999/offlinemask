import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { verify, root, output, readJson, fixtures, variants, routes } from './common.mjs';
import { loadCandidate } from '../shared-core/candidates.mjs';
import { verifyAssets } from '../shared-core/evidence.mjs';
import * as current from '../../src/core/detection/policy.ts';
import { score, contextual, assertReplay, productFixture } from '../pretrained-scope/common.mjs';
import { compare } from '../model-recheck/comparison.mjs';
const protocol = await verify(), variant = process.argv[2];
assert.ok(variants.includes(variant));
for (const file of Object.keys(protocol.beforeFiles)) if (file.startsWith('src/core/')) {
  const destination = join(output, 'reference', file);
  await mkdir(dirname(destination), {recursive:true});
  await writeFile(destination, protocol.beforeSources[file] ?? await readFile(join(root, file)));
}
const previous = await import(pathToFileURL(join(output, 'reference/src/core/detection/policy.ts')));
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')), variant);
const saved = await readJson(join(root, `artifacts/pretrained-scope/${variant}.json`));
const all = (await fixtures()).map(productFixture), cases = [];
globalThis.fetch = async () => { throw Error('Network forbidden during structured repair evaluation'); };
const detector = await loadCandidate(root, variant, all.map(f => f.text));
const predictions = (policy, text, ds) => ({ full: policy.applyDetectionPolicy(text, ds).complete,
  contextual: policy.applyDetectionPolicy(text, contextual(ds)).complete,
  rules: policy.applyDetectionPolicy(text, []).complete, local: policy.localDetections(text) });
try {
  for (const [i, f] of all.entries()) {
    assert.deepEqual([f.id,f.file], [saved.cases[i].id,saved.cases[i].file]);
    const ds = await detector.inspect(f.text);
    const before = predictions(previous, f.text, ds.modelOnly), after = predictions(current, f.text, ds.modelOnly);
    const row = {id:f.id,file:f.file,corpus:f.corpus,routes:{}};
    for (const route of routes) {
      const b = score(f,before[route]), a = score(f,after[route]);
      assertReplay(b,saved.cases[i][route],`${f.id}/${route}`);
      row.routes[route] = {before:b,after:a,changes:compare(f,b,a)};
    }
    cases.push(row);
    if ((i+1)%60===0) console.log(variant,i+1,'/',all.length);
  }
  await verify();
  await writeFile(join(output,`${variant}.json`),JSON.stringify({variant,protocol,cases},null,2)+'\n',{flag:'wx'});
  console.log(variant,'completed',cases.length);
} finally { await detector.dispose(); }
