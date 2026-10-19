import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, outputRoot, verifyProtocol, readJson } from './evidence.mjs';
import { variants } from './candidates.mjs';
import { summarizeStage } from './metrics.mjs';
const protocol = await verifyProtocol();
const parity = await readJson(join(outputRoot, 'parity.json'));
assert.deepEqual(parity.protocol, protocol); assert.equal(parity.identical, true);
const expectedIds = [];
for (const file of Object.keys(protocol.fixtures)) for (const row of await readJson(join(root, 'tests/fixtures', file))) expectedIds.push(`${file}/${row.id}`);
assert.equal(parity.checked, expectedIds.length);
const results = [];
for (const variant of variants) {
  const run = await readJson(join(outputRoot, `${variant}.json`));
  assert.deepEqual(run.protocol, protocol);
  assert.equal(run.variant, variant);
  assert.deepEqual(run.cases.map(c => `${c.file}/${c.id}`), expectedIds);
  for (const stage of ['modelOnly', 'complete']) assert.deepEqual(run.stages[stage], summarizeStage(run.cases.map(c => c[stage])));
  results.push({ variant, backend: run.backend, node: run.node, stages: run.stages, cases: run.cases });
}
const reference = results.find(r => r.variant === 'combined');
for (const result of results) {
  result.comparedWithPair = { completeGains: [], completeLosses: [], selectedGains: [], selectedLosses: [], increasedOrdinaryMasking: [] };
  result.cases.forEach((row, i) => {
    const base = reference.cases[i], next = row.complete;
    next.entities.forEach((entity, j) => {
      const before = base.complete.entities[j];
      const value = { file: row.file, id: row.id, category: entity.category, value: entity.value, start: entity.start };
      for (const [field, metric] of [['complete', 'full'], ['selected', 'selectedFull']]) {
        if (!before[metric] && entity[metric]) result.comparedWithPair[field + 'Gains'].push(value);
        if (before[metric] && !entity[metric]) result.comparedWithPair[field + 'Losses'].push(value);
      }
    });
    if (next.falsePositiveChars > base.complete.falsePositiveChars) result.comparedWithPair.increasedOrdinaryMasking.push({ file: row.file, id: row.id,
      before: base.complete.falsePositiveChars, after: next.falsePositiveChars });
  });
}
await writeFile(join(root, 'docs/evaluations/shared-core-comparison.json'), JSON.stringify({ createdAt: new Date().toISOString(),
  protocol, parity: { checked: parity.checked, identical: parity.identical, backend: parity.backend }, results }, null, 2) + '\n');
for (const r of results) console.log(JSON.stringify({ variant: r.variant, modelOnly: r.stages.modelOnly.summary.fullyCovered,
  complete: r.stages.complete, differences: Object.fromEntries(Object.entries(r.comparedWithPair).map(([key, values]) => [key, values.length])),
  errors: r.cases.filter(c => c.error).map(c => ({ file: c.file, id: c.id, error: c.error })) }));
