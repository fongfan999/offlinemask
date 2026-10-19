import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { parseFixture, scoreFixture, categories } from '../model-comparison-metrics.mjs';
import { summarizeStage } from './metrics.mjs';
import { loadCandidate, variants } from './candidates.mjs';
import { root, outputRoot, verifyProtocol, verifyAssets, readJson } from './evidence.mjs';

const variant = process.argv[2];
if (!variants.includes(variant)) throw Error(`Select one of: ${variants.join(', ')}`);
const protocol = await verifyProtocol();
await verifyAssets(protocol, variant);
globalThis.fetch = async () => { throw Error('Network forbidden during shared-core evaluation'); };
const fixtures = [];
for (const file of Object.keys(protocol.fixtures)) for (const f of await readJson(join(root, 'tests/fixtures', file))) fixtures.push({ ...parseFixture(f), file });
const detector = await loadCandidate(root, variant, fixtures.map(f => f.text));
const cases = [];
function score(fixture, detections) {
  const spans = analyzeText(fixture.text, '12345678', detections).spans;
  const selected = Object.fromEntries(categories.map(c => [c, analyzeText(fixture.text, '12345678', filterDetections(detections, [c])).spans]));
  return { ...scoreFixture(fixture, spans, selected), group: fixture.group, predictions: spans.map(s => ({ ...s, value: fixture.text.slice(s.start, s.end) })) };
}
try {
  for (const fixture of fixtures) {
    let stages = { modelOnly: [], complete: [] }, error = null;
    try { stages = await detector.inspect(fixture.text); }
    catch (failure) { error = failure instanceof Error ? failure.message : 'Detection failed'; }
    cases.push({ file: fixture.file, id: fixture.id, error,
      modelOnly: { ...score(fixture, stages.modelOnly), error }, complete: { ...score(fixture, stages.complete), error } });
    if (cases.length % 25 === 0) console.log(variant, cases.length, '/', fixtures.length);
  }
} finally { await detector.dispose(); }
const stages = Object.fromEntries(['modelOnly', 'complete'].map(stage => [stage, summarizeStage(cases.map(c => c[stage]))]));
await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, `${variant}.json`), JSON.stringify({ variant, protocol, node: process.version,
  backend: 'Node CPU; native tokenizer reference for BigMed and Underthesea; not desktop measurements', stages, cases }, null, 2) + '\n');
console.log(JSON.stringify({ variant, stages, errors: cases.filter(c => c.error).map(c => ({ file: c.file, id: c.id, error: c.error })) }));
