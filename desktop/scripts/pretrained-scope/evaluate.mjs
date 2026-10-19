import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtures, verify, root, hash, readJson } from '../model-recheck/common.mjs';
import { loadCandidate } from '../shared-core/candidates.mjs';
import { loadNativeBigMed } from '../native-preprocessing/provider.mjs';
import { verifyAssets } from '../shared-core/evidence.mjs';
import { applyDetectionPolicy, localDetections } from '../../src/core/detection/policy.ts';
import { score, assertReplay, contextual, productFixture, variants } from './common.mjs';
await verify();
const protocol = await readJson(join(root, 'docs/evaluations/pretrained-scope/protocol.json'));
for (const [path, expected] of Object.entries(protocol.sourceHashes)) assert.equal(hash(await readFile(join(root, path))), expected, path);
const variant = process.argv[2]; assert.ok(variants.includes(variant));
await verifyAssets(await readJson(join(root, 'docs/evaluations/shared-core-protocol-v2.json')), variant === 'bigmed-native' ? 'bigmed' : variant);
const prior = await readJson(join(root, 'docs/evaluations/model-recheck-v1-results.json'));
const all = await fixtures(), cases = [];
globalThis.fetch = async () => { throw Error('Network forbidden during scope experiment'); };
let detector;
try {
  detector = variant === 'bigmed-native' ? await loadNativeBigMed(root, all.map(f => f.text)) : await loadCandidate(root, variant, all.map(f => f.text));
  for (const [i, f] of all.entries()) {
    const saved = prior.candidates[variant].cases[i];
    assert.deepEqual([f.id, f.file], [saved.id, saved.file]);
    const ds = await detector.inspect(f.text);
    assertReplay(score(f, ds.complete), saved.complete, f.id);
    assertReplay(score(f, ds.modelOnly), saved.modelOnly, f.id);
    const target = productFixture(f);
    cases.push({ id: f.id, file: f.file, corpus: f.corpus,
      full: score(target, ds.complete),
      contextual: score(target, applyDetectionPolicy(f.text, contextual(ds.modelOnly)).complete),
      rules: score(target, applyDetectionPolicy(f.text, []).complete),
      local: score(target, localDetections(f.text)),
    });
    if ((i + 1) % 60 === 0) console.log(variant, i + 1, '/', all.length);
  }
  await writeFile(join(root, `artifacts/pretrained-scope/${variant}.json`), JSON.stringify({ variant, protocol, replayCases: cases.length, cases }, null, 2) + '\n', { flag: 'wx' });
  console.log(variant, 'completed', cases.length);
} finally { await detector?.dispose(); }
