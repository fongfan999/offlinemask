import { readFile, writeFile } from 'node:fs/promises';
import { decodeBioTokenSpans } from 'openmed';
import { modelDetections, mergeModelDetections } from '../src/core/detection/model-policy.ts';
import { detectBankingIdentifiers } from '../src/core/detection/banking.ts';
import { detectContactDetails } from '../src/core/detection/contact.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { analyzeText } from '../src/core/text.ts';
import { categories, parseFixture, scoreFixture, summarize } from './model-comparison-metrics.mjs';

const root = new URL('../artifacts/alternative-models/', import.meta.url);
const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/model-comparison.json', import.meta.url))).map(parseFixture);
const results = [];
for (const variant of ['int8', 'fp32']) {
  const reference = JSON.parse(await readFile(new URL(`underthesea-${variant}-reference.json`, root)));
  const cases = fixtures.map(fixture => {
    const entry = reference.find(value => value.id === fixture.id);
    const mapping = { PER: 'PERSON', LOC: 'LOCATION', ORG: 'ORGANIZATION' };
    const spans = entry.windows.flatMap(tokens => modelDetections(fixture.text, decodeBioTokenSpans(fixture.text,
      tokens.map(token => { const [prefix, label] = token.entity.split('-');
        return { ...token, entity: mapping[label] ? `${prefix}-${mapping[label]}` : 'O' }; }), { threshold: 0 })));
    const detections = [...detectBankingIdentifiers(fixture.text), ...detectContactDetails(fixture.text), ...mergeModelDetections(spans)];
    const predictions = analyzeText(fixture.text, '12345678', detections).spans;
    const selected = Object.fromEntries(categories.map(category => [category,
      analyzeText(fixture.text, '12345678', filterDetections(detections, [category])).spans]));
    return { ...scoreFixture(fixture, predictions, selected), predictions: predictions.map(span => ({ ...span, value: fixture.text.slice(span.start, span.end) })) };
  });
  results.push({ variant, summary: summarize(cases), shortSummary: summarize(cases.filter(value => value.group !== 'long')), cases });
}
await writeFile(new URL('underthesea-reference-scores.json', root), JSON.stringify({ note: 'Native tokenizer offsets and native ONNX CPU quality reference; not a shipping adapter or comparable JS timing.', results }, null, 2) + '\n');
for (const result of results) console.log(result.variant, result.summary);
