import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, outputRoot, readJson, verify } from './evidence.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
const { protocol } = await verify();
const first = await readJson(join(outputRoot, 'bigmed-1.json')), second = await readJson(join(outputRoot, 'bigmed-2.json'));
assert.deepEqual(first.protocol, protocol); assert.deepEqual(second.protocol, protocol);
assert.deepEqual(first.cases, second.cases, 'Nondeterministic results');
for (const s of ['modelOnly', 'complete']) assert.deepEqual(first.stages[s], summarizeStage(first.cases.map(c => c[s])));
const baseline = await readJson(join(root, 'docs/evaluations/shared-core-comparison.json'));
const comparisons = [];
for (const variant of ['combined', 'bigmed', 'underthesea']) {
  const previous = baseline.results.find(r => r.variant === variant);
  assert.deepEqual(first.cases.map(c => `${c.file}/${c.id}`), previous.cases.map(c => `${c.file}/${c.id}`));
  const changes = [], fullGains = [], fullLosses = [], selectedGains = [], selectedLosses = [], increasedOrdinaryMasking = [];
  first.cases.forEach((c, i) => {
    const before = previous.cases[i];
    c.complete.entities.forEach((e, j) => {
      const old = before.complete.entities[j], value = { file: c.file, id: c.id, category: e.category, value: e.value, start: e.start };
      if (!old.full && e.full) fullGains.push(value);
      if (old.full && !e.full) fullLosses.push(value);
      if (!old.selectedFull && e.selectedFull) selectedGains.push(value);
      if (old.selectedFull && !e.selectedFull) selectedLosses.push(value);
    });
    if (c.complete.falsePositiveChars > before.complete.falsePositiveChars) increasedOrdinaryMasking.push({ file: c.file, id: c.id,
      before: before.complete.falsePositiveChars, after: c.complete.falsePositiveChars });
    if (JSON.stringify(c.complete.predictions) !== JSON.stringify(before.complete.predictions) || c.error !== before.error) changes.push({ file: c.file, id: c.id, before, after: c });
  });
  comparisons.push({ variant, fullGains, fullLosses, selectedGains, selectedLosses, increasedOrdinaryMasking, changes });
}
await writeFile(join(root, 'docs/evaluations/native-preprocessing-comparison.json'), JSON.stringify({ createdAt: new Date().toISOString(),
  protocol, repeatedOutputsIdentical: true, cachedNativeQueries: first.cachedNativeQueries, stages: first.stages, cases: first.cases, comparisons }, null, 2) + '\n');
console.log(JSON.stringify({ stages: first.stages, differences: comparisons.map(c => ({ variant: c.variant, ...Object.fromEntries(Object.entries(c).filter(([,v]) => Array.isArray(v)).map(([k,v]) => [k,v.length])) })) }));
