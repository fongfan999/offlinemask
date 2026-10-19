import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { categories, scoreFixture } from '../model-comparison-metrics.mjs';
import { loadCandidate } from '../shared-core/candidates.mjs';
import { verifyAssets } from '../shared-core/evidence.mjs';
import { loadNativeBigMed } from '../native-preprocessing/provider.mjs';
import { root, outputRoot, variants, fixtures, verify, summarizeChallenge } from './common.mjs';
const [variant, round] = process.argv.slice(2);
assert.ok(variants.includes(variant) && ['1', '2'].includes(round), 'Expected candidate and round 1 or 2');
const { base, protocol } = await verify();
await verifyAssets(base, variant === 'bigmed-native' ? 'bigmed' : variant);
globalThis.fetch = async () => { throw Error('Network forbidden during challenge evaluation'); };
const all = await fixtures();
let detector, setupError = null;
try {
  detector = variant === 'bigmed-native' ? await loadNativeBigMed(root, all.map(f => f.text)) : await loadCandidate(root, variant, all.map(f => f.text));
} catch (error) { setupError = error instanceof Error ? error.message : 'Candidate preparation failed'; }
const cases = [];
function score(f, detections, error) {
  const spans = analyzeText(f.text, '12345678', detections).spans;
  const selected = Object.fromEntries(categories.map(c => [c, analyzeText(f.text, '12345678', filterDetections(detections, [c])).spans]));
  return { ...scoreFixture(f, spans, selected), recordId: f.recordId, representation: f.representation, error,
    predictions: spans.map(s => ({ ...s, value: f.text.slice(s.start, s.end) })),
    selectedPredictions: Object.fromEntries(categories.map(c => [c, selected[c].map(s => ({ ...s, value: f.text.slice(s.start, s.end) }))])) };
}
try {
  for (const f of all) {
    let result;
    try {
      if (setupError) throw Error(setupError);
      const stages = await detector.inspect(f.text);
      result = { error: null, modelOnly: score(f, stages.modelOnly, null), complete: score(f, stages.complete, null) };
    } catch (failure) {
      const error = failure instanceof Error ? failure.message : 'Detection or scoring failed';
      result = { error, modelOnly: score(f, [], error), complete: score(f, [], error) };
    }
    cases.push({ id: f.id, ...result });
    if (cases.length % 25 === 0) console.log(variant, round, cases.length, '/', all.length);
  }
} finally { await detector?.dispose(); }
const stages = Object.fromEntries(['modelOnly', 'complete'].map(stage => [stage, summarizeChallenge(cases.map(c => c[stage]))]));
await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, `${variant}-${round}.json`), JSON.stringify({ variant, round, protocol, setupError, stages, cases }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ variant, round, failed: stages.complete.summary.failedCases, full: stages.complete.summary.fullyCovered,
  total: stages.complete.summary.entities, criticalFailures: stages.complete.criticalFailures.length, pass: stages.complete.challengePass }));
