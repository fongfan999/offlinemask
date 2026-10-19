import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { summarizeChallenge } from '../challenge-core/common.mjs';
import { compare, productScope } from './comparison.mjs';
import { root, readJson, hash, variants, fixtures, verify, outputRoot } from './common.mjs';
const protocol = await verify(), all = await fixtures(), candidates = {}, rawHashes = {};
const stripTiming = cases => cases.map(({ durationMs, ...c }) => c);
for (const variant of variants) {
  const runs = [];
  for (const round of ['1', '2']) {
    const name = `${variant}-${round}.json`, bytes = await readFile(join(outputRoot, name));
    rawHashes[name] = hash(bytes); const run = JSON.parse(bytes); assert.deepEqual(run.protocol, protocol); runs.push(run);
  }
  assert.deepEqual(stripTiming(runs[0].cases), stripTiming(runs[1].cases), `Non-deterministic output: ${variant}`);
  assert.equal(runs[0].cases.length, all.length);
  for (let i = 0; i < all.length; i++) assert.deepEqual([runs[0].cases[i].id, runs[0].cases[i].file], [all[i].id, all[i].file]);
  const cases = stripTiming(runs[0].cases);
  const productRows = cases.filter(c => c.corpus === 'challenge').map(c => {
    const f = all.find(f => f.corpus === c.corpus && f.file === c.file && f.id === c.id);
    return productScope(f, c.complete);
  });
  candidates[variant] = { stages: runs[0].stages, productScopeChallenge: summarizeChallenge(productRows),
    resources: runs.map(r => r.resource), cases, errors: cases.filter(c => c.error).map(c => ({ id: c.id, file: c.file, error: c.error })) };
}
const prior = await readJson(join(root, 'docs/evaluations/context-fields-v1-results.json'));
assert.deepEqual(candidates.combined.cases, prior.cases, 'Current pair must reproduce the previous core evidence');
const comparisons = {};
for (const variant of variants.filter(v => v !== 'combined')) {
  comparisons[variant] = {};
  for (const corpus of ['regression', 'challenge']) {
    const outcomes = all.flatMap((f, i) => f.corpus === corpus ? [compare(f, candidates.combined.cases[i].complete, candidates[variant].cases[i].complete)] : []);
    comparisons[variant][corpus] = Object.fromEntries(Object.keys(outcomes[0]).map(key => [key, outcomes.flatMap(o => o[key])]));
  }
}
const base = await readJson(join(root, 'docs/evaluations/shared-core-protocol-v2.json'));
const assetBytes = Object.fromEntries(variants.map(v => [v, base.assets[v === 'bigmed-native' ? 'bigmed' : v].reduce((n, a) => n + Object.values(a.files).reduce((m, f) => m + f.size, 0), 0)]));
await writeFile(join(root, 'docs/evaluations/model-recheck-v1-results.json'), JSON.stringify({ createdAt: new Date().toISOString(),
  protocol, rawHashes, repeatedOutputsIdentical: true, incumbentMatchesPriorEvidence: true, assetBytes, candidates, comparisons }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(Object.fromEntries(variants.map(v => [v, { regression: candidates[v].stages.regression.complete.summary,
  challenge: candidates[v].stages.challenge.complete.summary, productScopePass: candidates[v].productScopeChallenge.challengePass,
  resources: candidates[v].resources }]))));
