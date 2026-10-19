// All inputs and persisted outputs here are public synthetic fixtures.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadDetector } from '../../src/core/detection/openmed.ts';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { parseFixture, scoreFixture, summarize, categories } from '../model-comparison-metrics.mjs';
import { createNativeProvider } from './provider.mjs';
import { createWasmProvider } from './wasm-provider.mjs';
const mode = process.argv[2] ?? 'native';
if (!['native', 'cpu', 'wasm'].includes(mode)) throw Error('Unknown runtime');
const root = new URL('../../', import.meta.url).pathname;
const out = root + 'artifacts/native-prototype';
await mkdir(out, { recursive: true });
globalThis.fetch = async () => { throw Error('Network disabled during evaluation'); };
let native, detector;
const results = [], reports = [];
const started = performance.now();
try {
  if (mode === 'native') native = await createNativeProvider(root + 'public/models');
  await writeFile(out + '/active-processes.json', JSON.stringify({ mode, parentPid: process.pid, nativePid: native?.pid }));
  const provider = mode === 'wasm' ? await createWasmProvider(root + 'public/models') : native?.provider;
  detector = await loadDetector(root + 'public/models', root + 'public/runtime/', mode === 'wasm' ? 'wasm' : 'cpu', undefined, provider);
  const loadMs = Math.round(performance.now() - started);
  for (const file of ['model-comparison.json', 'model-reliability.json', 'address-holdout.json', 'address-validation.json', 'address-final-check.json', 'text-model.json']) {
    const source = await readFile(root + 'tests/fixtures/' + file, 'utf8');
    const rows = [];
    for (const fixture of JSON.parse(source).map(value => value.annotated ? parseFixture(value) : value)) {
      const before = performance.now();
      try {
        const detections = await detector.detect(fixture.text, () => {});
        const analysis = analyzeText(fixture.text, '12345678', detections);
        const selected = Object.fromEntries(categories.map(category => [category, analyzeText(fixture.text, '12345678', filterDetections(detections, [category])).spans]));
        const spans = analysis.spans.map(span => ({ start: span.start, end: span.end, type: span.findingId.replace(/_\d+$/, ''), value: fixture.text.slice(span.start, span.end) }));
        results.push({ file, id: fixture.id, ms: Math.round(performance.now() - before), spans });
        if (fixture.entities) rows.push(scoreFixture(fixture, analysis.spans, selected));
      } catch {
        results.push({ file, id: fixture.id, error: 'Detection failed' });
      }
    }
    reports.push({ file, sha256: createHash('sha256').update(source).digest('hex'), ...(rows.length ? { summary: summarize(rows) } : {}) });
    console.log(mode, file, 'finished');
  }
  const suffix = 'Khách hàng Trần Minh Bình nhận thư tại căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội. Email synthetic@example.org. Ngày 10/09/2026, số tiền 2.500.000 đồng.';
  const filler = 'Nội dung tổng hợp đã được kiểm tra. ';
  for (const length of [161, 2000, 10000, 50000]) {
    const text = filler.repeat(Math.ceil(Math.max(0, length - suffix.length) / filler.length)).slice(0, Math.max(0, length - suffix.length)) + suffix;
    const before = performance.now();
    try {
      const detections = await detector.detect(text, () => {});
      const analysis = analyzeText(text, '12345678', detections);
      const spans = analysis.spans.map(span => ({ start: span.start, end: span.end, type: span.findingId.replace(/_\d+$/, ''), value: text.slice(span.start, span.end) }));
      results.push({ file: 'runtime-lengths', id: String(length), ms: Math.round(performance.now() - before), spans });
    } catch { results.push({ file: 'runtime-lengths', id: String(length), error: 'Detection failed' }); }
    console.log(mode, length, 'finished');
  }
  await writeFile(out + '/' + mode + '.json', JSON.stringify({ mode, loadMs, threads: native?.threads ?? 'runtime default', node: process.version, reports, results }, null, 2) + '\n');
} finally { await detector?.dispose(); await native?.dispose(); }
