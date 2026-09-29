import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { categories, scoreFixture } from '../model-comparison-metrics.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
import { summarizeChallenge } from '../challenge-core/common.mjs';
import { loadCandidate } from '../shared-core/candidates.mjs';
import { loadNativeBigMed } from '../native-preprocessing/provider.mjs';
import { verifyAssets } from '../shared-core/evidence.mjs';
import { root, readJson, variants, fixtures, verify, outputRoot, summarizeTiming } from './common.mjs';
const [variant, round] = process.argv.slice(2);
assert.ok(variants.includes(variant) && ['1', '2'].includes(round));
const protocol = await verify();
await verifyAssets(await readJson(join(root, 'docs/evaluations/shared-core-protocol-v2.json')), variant === 'bigmed-native' ? 'bigmed' : variant);
globalThis.fetch = async () => { throw Error('Network forbidden during candidate recheck'); };
const all = await fixtures(), cases = [];
let detector, setupError = null, sampledNodeRssBytes = process.memoryUsage().rss;
const sample = () => { sampledNodeRssBytes = Math.max(sampledNodeRssBytes, process.memoryUsage().rss); };
const timer = setInterval(sample, 25), setupStart = performance.now();
try { detector = variant === 'bigmed-native' ? await loadNativeBigMed(root, all.map(f => f.text)) : await loadCandidate(root, variant, all.map(f => f.text)); }
catch (e) { setupError = e instanceof Error ? e.message : 'Setup failed'; }
const setupMs = performance.now() - setupStart;
function score(f, ds, error) {
  const spans = analyzeText(f.text, '12345678', ds).spans;
  const selected = Object.fromEntries(categories.map(c => [c, analyzeText(f.text, '12345678', filterDetections(ds, [c])).spans]));
  return { ...scoreFixture(f, spans, selected), error, recordId: f.recordId, representation: f.representation,
    predictions: spans.map(s => ({ ...s, value: f.text.slice(s.start, s.end) })),
    selectedPredictions: Object.fromEntries(categories.map(c => [c, selected[c].map(s => ({ ...s, value: f.text.slice(s.start, s.end) }))])) };
}
try {
  for (const f of all) {
    const start = performance.now(); let ds = { modelOnly: [], complete: [] }, error = null;
    try { if (setupError) throw Error(setupError); ds = await detector.inspect(f.text); }
    catch (e) { error = e instanceof Error ? e.message : 'Inference failed'; }
    const durationMs = performance.now() - start; sample();
    cases.push({ id: f.id, file: f.file, corpus: f.corpus, durationMs, error,
      modelOnly: score(f, ds.modelOnly, error), complete: score(f, ds.complete, error) });
    if (cases.length % 50 === 0) console.log(variant, round, cases.length, '/', all.length);
  }
} finally { clearInterval(timer); await detector?.dispose(); }
const stages = Object.fromEntries(['regression', 'challenge'].map(corpus => [corpus,
  Object.fromEntries(['modelOnly', 'complete'].map(stage => [stage, (corpus === 'challenge' ? summarizeChallenge : summarizeStage)(cases.filter(c => c.corpus === corpus).map(c => c[stage]))]))]));
await writeFile(join(outputRoot, `${variant}-${round}.json`), JSON.stringify({ variant, round, protocol, setupError,
  resource: { setupMs, sampledNodeRssBytes, ...summarizeTiming(cases) }, stages, cases }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ variant, round, setupError, summary: Object.fromEntries(Object.entries(stages).map(([c, s]) => [c, s.complete.summary])) }));
