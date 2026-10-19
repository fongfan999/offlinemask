// Developer evaluation only. Inputs and saved spans are synthetic; no app imports this file.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { analyzeText } from '../src/core/text.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { categories, parseFixture, scoreFixture, summarize, meetsScreeningFloor } from './model-comparison-metrics.mjs';
import { createNativeProvider } from './native-prototype/provider.mjs';
import { createWasmProvider } from './native-prototype/wasm-provider.mjs';
import manifest from './model-manifest.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'artifacts/model-decision';
const [runtime, variant, round] = process.argv.slice(2);
assert.ok(['native', 'wasm'].includes(runtime));
assert.ok(['superclinical', 'msuperclinical', 'combined'].includes(variant));
assert.ok(['1', '2'].includes(round));
const directories = variant === 'combined' ? manifest.models.map(model => model.directory)
  : [manifest.models[variant === 'superclinical' ? 0 : 1].directory];
const source = await readFile(root + 'tests/fixtures/model-decision.json', 'utf8');
const protocol = JSON.parse(await readFile(root + 'docs/evaluations/2026-09-11-model-decision-protocol.json', 'utf8'));
assert.equal(createHash('sha256').update(source).digest('hex'), protocol.fixtureSha256, 'Frozen fixtures changed');
for (const [file, hash] of Object.entries(protocol.sourceHashes)) {
  assert.equal(createHash('sha256').update(await readFile(root + file)).digest('hex'), hash, `Frozen implementation changed: ${file}`);
}
const fixtures = JSON.parse(source).map(parseFixture);
assert.equal(fixtures.length, protocol.caseCount);
assert.equal(new Set(fixtures.map(fixture => fixture.id)).size, fixtures.length);
globalThis.fetch = async () => { throw Error('Network disabled during evaluation'); };
await mkdir(out, { recursive: true });
const baselineRssBytes = process.memoryUsage.rss();
let native, detector;
const started = performance.now();
try {
  if (runtime === 'native') native = await createNativeProvider(root + 'public/models');
  await writeFile(out + '/active.json', JSON.stringify({ parentPid: process.pid, nativePid: native?.pid }));
  const provider = native?.provider ?? await createWasmProvider(root + 'public/models');
  detector = await loadDetector(root + 'public/models', root + 'public/runtime/', runtime === 'native' ? 'cpu' : 'wasm', directories, provider);
  const loadMs = performance.now() - started;
  const warmupStarted = performance.now();
  await detector.detect('Chứng từ đang được kiểm tra.', () => {});
  const warmupMs = performance.now() - warmupStarted;
  async function evaluate(fixture) {
    const start = performance.now();
    let detections = [], error = null;
    try { detections = await detector.detect(fixture.text, () => {}); }
    catch { error = 'Detection failed; no preview'; }
    const inferenceMs = performance.now() - start;
    const analysis = analyzeText(fixture.text, '12345678', detections);
    const selected = Object.fromEntries(categories.map(category => [category,
      analyzeText(fixture.text, '12345678', filterDetections(detections, [category])).spans]));
    return { ...scoreFixture(fixture, analysis.spans, selected), error, inferenceMs,
      predictions: analysis.spans.map(span => ({ start: span.start, end: span.end,
        type: span.findingId.replace(/_\d+$/, ''), value: fixture.text.slice(span.start, span.end) })) };
  }
  const cases = [];
  for (const fixture of fixtures) {
    cases.push(await evaluate(fixture));
    if (cases.length % 14 === 0) console.log(`${runtime}/${variant}/${round}: ${cases.length}/${fixtures.length}`);
  }
  const lengths = [];
  const tail = parseFixture({ id: 'tail', group: 'length', annotated: protocol.lengthTail });
  const filler = protocol.lengthFiller;
  for (const length of (runtime === 'native' ? protocol.nativeLengths : protocol.wasmLengths)) {
    // Whole sentences plus whitespace padding; never cut a filler word at the sensitive suffix.
    const prefixLength = length - tail.text.length;
    assert.ok(prefixLength >= 0);
    const prefix = filler.repeat(Math.floor(prefixLength / filler.length)).padEnd(prefixLength, ' ');
    const fixture = { ...tail, id: String(length), text: prefix + tail.text,
      entities: tail.entities.map(entity => ({ ...entity, start: entity.start + prefix.length, end: entity.end + prefix.length })) };
    assert.equal(fixture.text.length, length);
    lengths.push(await evaluate(fixture));
    console.log(`${runtime}/${variant}/${round}: ${length} units finished`);
  }
  const summary = summarize(cases);
  const times = cases.map(row => row.inferenceMs).sort((a, b) => a - b);
  const report = { runtime, variant, round: Number(round), fixtureSha256: protocol.fixtureSha256,
    sourceHashes: protocol.sourceHashes, loadMs, warmupMs, baselineRssBytes,
    medianMs: times[Math.ceil(times.length * .5) - 1], p95Ms: times[Math.ceil(times.length * .95) - 1],
    summary, screeningPass: meetsScreeningFloor({ summary, shortSummary: summary }), cases, lengths,
    downloadBytes: manifest.models.filter(model => directories.includes(model.directory))
      .reduce((sum, model) => sum + Object.values(model.sizes).reduce((a, b) => a + b, 0), 0) };
  await writeFile(`${out}/${runtime}-${variant}-${round}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`${runtime}/${variant}/${round}: ${summary.fullyCovered}/${summary.entities}, ${summary.falsePositiveChars} ordinary chars hidden, pass=${report.screeningPass}`);
} finally { await detector?.dispose(); await native?.dispose(); }
