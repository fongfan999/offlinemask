import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { categories, parseFixture, scoreFixture, summarize, meetsScreeningFloor } from '../scripts/model-comparison-metrics.mjs';

test('partial masking and wrong-category masking cannot count as complete selected-category coverage', () => {
  const fixture = parseFixture({ id: 'partial', group: 'test', annotated: '😀 [[name|Lê An]] gửi [[banking|123456]].' });
  const name = fixture.entities[0], account = fixture.entities[1];
  const result = scoreFixture(fixture, [{ start: name.start, end: name.start + 2 }, account], { name: [], banking: [account] });
  assert.equal(result.entities[0].full, false);
  assert.equal(result.entities[1].full, true);
  assert.equal(result.entities[1].selectedFull, true);
  const wrongCategory = scoreFixture(fixture, [name, account], { name: [], banking: [account] });
  assert.equal(wrongCategory.entities[0].full, true);
  assert.equal(wrongCategory.entities[0].selectedFull, false);
  assert.equal(summarize([result]).partial, 1);
});

test('negative fixtures penalize ordinary masking; whitespace and separators do not inflate false positives', () => {
  const fixture = parseFixture({ id: 'negative', group: 'test', annotated: 'Người nhận,  hôm nay.' });
  const result = scoreFixture(fixture, [{ start: 0, end: 12 }]);
  assert.equal(result.falsePositiveChars, 9);
  assert.equal(summarize([result]).falsePositiveNegativeCases, 1);
  const annotated = parseFixture({ id: 'separator', annotated: '[[name|An]], [[name|Bình]]' });
  assert.equal(scoreFixture(annotated, [{ start: 0, end: annotated.text.length }]).falsePositiveChars, 0);
});

test('annotations preserve exact Unicode offsets, repeats, and reject malformed categories', async () => {
  const fixture = parseFixture({ id: 'repeats', annotated: '😀 [[name|An]] và [[name|An]]' });
  assert.equal(fixture.text, '😀 An và An');
  assert.equal(fixture.entities.length, 2);
  assert.equal(fixture.entities[0].start, 3);
  assert.throws(() => parseFixture({ id: 'bad', annotated: '[[unknown|x]]' }));
  assert.throws(() => parseFixture({ id: 'bad', annotated: '[[name|x]' }));
  const cases = JSON.parse(await readFile(new URL('./fixtures/model-comparison.json', import.meta.url))).map(parseFixture);
  assert.equal(new Set(cases.map(value => value.id)).size, cases.length);
  for (const value of cases) for (const entity of value.entities)
    assert.equal(value.text.slice(entity.start, entity.end), entity.value);
});

test('request failures remain in coverage denominators and are counted explicitly', () => {
  const fixture = parseFixture({ id: 'failed', annotated: 'Tên: [[name|Lê An]]' });
  const result = { ...scoreFixture(fixture, []), error: 'Synthetic alignment failure' };
  const summary = summarize([result]);
  assert.equal(summary.failedCases, 1);
  assert.equal(summary.entities, 1);
  assert.equal(summary.fullyCovered, 0);
  assert.equal(summary.missed, 1);
});

test('screening rejects request failures and wrong-category names despite perfect all-options masking', () => {
  const cases = categories.map(category => {
    const fixture = parseFixture({ id: category, annotated: `[[${category}|Example]]` });
    return scoreFixture(fixture, fixture.entities, { [category]: fixture.entities });
  });
  const summary = summarize(cases);
  assert.equal(meetsScreeningFloor({ summary, shortSummary: summary }), true);
  assert.equal(meetsScreeningFloor({ summary: { ...summary, failedCases: 1 }, shortSummary: summary }), false);
  const wrongCategory = structuredClone(summary);
  wrongCategory.byCategory.name.selectedFull = 0;
  assert.equal(meetsScreeningFloor({ summary: wrongCategory, shortSummary: summary }), false);
});
