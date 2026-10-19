import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, outputRoot, hash, readJson, verify, variants, summarizeChallenge } from './common.mjs';
const { protocol } = await verify();
const runs = {}, evidenceHashes = {};
for (const variant of variants) {
  const rounds = [];
  for (const round of ['1', '2']) {
    const path = join(outputRoot, `${variant}-${round}.json`);
    const r = await readJson(path);
    assert.deepEqual(r.protocol, protocol); assert.equal(r.variant, variant); assert.equal(r.round, round);
    assert.equal(r.cases.length, protocol.composition.cases);
    for (const s of ['modelOnly', 'complete']) assert.deepEqual(summarizeChallenge(r.cases.map(c => c[s])), r.stages[s]);
    evidenceHashes[`${variant}-${round}.json`] = hash(await readFile(path)); rounds.push(r);
  }
  assert.deepEqual(rounds[0].cases, rounds[1].cases, `Nondeterministic output: ${variant}`);
  runs[variant] = rounds[0];
}
const pair = runs.combined;
const comparisons = {};
for (const variant of variants) {
  const gains = [], losses = [], selectedGains = [], selectedLosses = [], criticalRegressions = [];
  for (let i = 0; i < pair.cases.length; i++) {
    const baseline = pair.cases[i].complete, candidate = runs[variant].cases[i].complete;
    assert.equal(baseline.id, candidate.id);
    for (let j = 0; j < baseline.entities.length; j++) {
      const b = baseline.entities[j], c = candidate.entities[j];
      assert.deepEqual([b.start,b.end,b.type], [c.start,c.end,c.type]);
      const item = { id: baseline.id, type: b.type, value: b.value, baselineCovered: b.covered, candidateCovered: c.covered };
      if (!b.full && c.full) gains.push(item);
      if (b.full && !c.full) losses.push(item);
      if (!b.selectedFull && c.selectedFull) selectedGains.push(item);
      if (b.selectedFull && !c.selectedFull) selectedLosses.push(item);
      // Preserve partial coverage too, including when all-options coverage hides a selected-category regression.
      const selectedCount = (row, entity) => {
        const spans = row.selectedPredictions[entity.category];
        let count = 0;
        for (let p = entity.start; p < entity.end; p++) if (!/\s/u.test(entity.value[p - entity.start]) && spans.some(s => s.start <= p && p < s.end)) count++;
        return count;
      };
      if (b.critical && (c.covered < b.covered || selectedCount(candidate,c) < selectedCount(baseline,b))) criticalRegressions.push(item);
    }
  }
  comparisons[variant] = { gains, losses, selectedGains, selectedLosses, criticalRegressions,
    pass: runs[variant].stages.complete.challengePass && criticalRegressions.length === 0 };
}
const report = { createdAt: new Date().toISOString(), protocol, repeatedOutputsIdentical: true, evidenceHashes, comparisons,
  candidates: Object.fromEntries(variants.map(v => [v, { setupError: runs[v].setupError, stages: runs[v].stages, cases: runs[v].cases }])) };
await writeFile(join(root, 'docs/evaluations/release-challenge-v1-results.json'), JSON.stringify(report,null,2)+'\n', { flag:'wx' });
console.log(JSON.stringify(Object.fromEntries(variants.map(v => [v, { summary: runs[v].stages.complete.summary,
  shortExcess: runs[v].stages.complete.shortSummary.excessMaskingRate, criticalFailures: runs[v].stages.complete.criticalFailures.length,
  gains: comparisons[v].gains.length, losses: comparisons[v].losses.length, criticalRegressions: comparisons[v].criticalRegressions.length, pass: comparisons[v].pass }]))));
