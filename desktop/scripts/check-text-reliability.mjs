import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { analyzeText, maskedText } from '../src/core/text.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { parseFixture, scoreFixture, summarize, categories } from './model-comparison-metrics.mjs';

// Fresh synthetic diagnostic cases: do not tune a policy and call these held-out afterwards.
globalThis.fetch = async () => { throw new Error('Network forbidden during reliability checks'); };
const source = await readFile(new URL('../tests/fixtures/model-reliability.json', import.meta.url), 'utf8');
const detector = await loadDetector(new URL('../public/models', import.meta.url).pathname, '', 'cpu');
const cases = [];
try {
  for (const fixture of JSON.parse(source).map(parseFixture)) {
    let error = null, detections = [], spans = [], selectedSpans = {};
    try {
      detections = await detector.detect(fixture.text, () => {});
      const analysis = analyzeText(fixture.text, '12345678', detections);
      spans = analysis.spans;
      assert.equal(maskedText(fixture.text, analysis, Object.fromEntries(analysis.findings.map(f => [f.id,'keep']))), fixture.text);
      for (const category of categories) selectedSpans[category] = analyzeText(fixture.text, '12345678', filterDetections(detections,[category])).spans;
    } catch (failure) { error = failure.message; }
    cases.push({ ...scoreFixture(fixture, spans, selectedSpans), error });
    console.log(`${error ? 'ERROR' : 'PROCESSED'} ${fixture.id}`);
  }
} finally { await detector.dispose(); }
const report = { fixtureSha256: createHash('sha256').update(source).digest('hex'), summary:summarize(cases), cases };
await mkdir(new URL('../artifacts/reliability', import.meta.url), {recursive:true});
await writeFile(new URL('../artifacts/reliability/fresh-cases.json', import.meta.url), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary,null,2));
assert.equal(cases.filter(c => c.error).length, 0, 'Processing failures');
