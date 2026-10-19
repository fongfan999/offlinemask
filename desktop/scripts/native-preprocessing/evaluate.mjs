import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyAssets } from '../shared-core/evidence.mjs';
import { categories, parseFixture, scoreFixture } from '../model-comparison-metrics.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
import { filterDetections } from '../../src/core/detection/options.ts';
import { analyzeText } from '../../src/core/text.ts';
import { loadNativeBigMed } from './provider.mjs';
import { root, outputRoot, readJson, verify } from './evidence.mjs';

const round = process.argv[2]; assert.ok(['1', '2'].includes(round), 'Select round 1 or 2');
const { base, protocol } = await verify();
await verifyAssets(base, 'bigmed');
globalThis.fetch = async () => { throw Error('Network forbidden during native preprocessing evaluation'); };
const fixtures = [];
for (const file of Object.keys(base.fixtures)) for (const row of await readJson(join(root, 'tests/fixtures', file))) fixtures.push({ ...parseFixture(row), file });
const detector = await loadNativeBigMed(root, fixtures.map(f => f.text));
const cases = [];
function score(fixture, detections, error) {
  const spans = analyzeText(fixture.text, '12345678', detections).spans;
  const selected = Object.fromEntries(categories.map(c => [c, analyzeText(fixture.text, '12345678', filterDetections(detections, [c])).spans]));
  return { ...scoreFixture(fixture, spans, selected), group: fixture.group, error,
    predictions: spans.map(s => ({ ...s, value: fixture.text.slice(s.start, s.end) })) };
}
try {
  for (const f of fixtures) {
    let result;
    try {
      const stages = await detector.inspect(f.text);
      result = { modelOnly: score(f, stages.modelOnly, null), complete: score(f, stages.complete, null), error: null };
    } catch (failure) {
      const error = failure instanceof Error ? failure.message : 'Detection failed';
      result = { modelOnly: score(f, [], error), complete: score(f, [], error), error };
    }
    cases.push({ file: f.file, id: f.id, ...result });
    if (cases.length % 25 === 0) console.log('BigMed native', round, cases.length, '/', fixtures.length);
  }
} finally { await detector.dispose(); }
const stages = Object.fromEntries(['modelOnly', 'complete'].map(s => [s, summarizeStage(cases.map(c => c[s]))]));
await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, `bigmed-${round}.json`), JSON.stringify({ round, protocol, cachedNativeQueries: detector.cachedQueries,
  node: process.version, stages, cases }, null, 2) + '\n');
console.log(JSON.stringify({ round, stages, errors: cases.filter(c => c.error).map(c => ({ id: c.id, error: c.error })) }));
