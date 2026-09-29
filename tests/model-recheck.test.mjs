import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, productScope } from '../scripts/model-recheck/comparison.mjs';
import { parseFixture, scoreFixture } from '../scripts/model-comparison-metrics.mjs';

test('candidate comparisons expose shifted partial coverage even when totals are equal', () => {
  const f = { ...parseFixture({ id: 'positions', annotated: '[[other|abcd]]xyz' }), file: 'synthetic' };
  const stage = spans => ({ ...scoreFixture(f, spans, { other: spans }), predictions: spans, selectedPredictions: { other: spans } });
  const before = stage([{ start: 0, end: 2 }]), after = stage([{ start: 1, end: 3 }, { start: 4, end: 5 }]);
  assert.equal(before.entities[0].covered, after.entities[0].covered);
  const result = compare(f, before, after);
  assert.deepEqual(result.losses, []);
  assert.deepEqual(result.positionLosses.map(p => [p.selection, p.lost]), [['all', [0]], ['other', [0]]]);
  assert.deepEqual(result.addedOrdinary[0].positions, [4]);
});

test('product-scope card view rescoring preserves frozen annotations and real selected-category misses', () => {
  const fixture = { ...parseFixture({ id: 'card', annotated: '[[banking|4111 1111 1111 1111]]' }), recordId: 'card', representation: 'prose' };
  fixture.entities[0].type = 'card'; fixture.entities[0].critical = true;
  const snapshot = structuredClone(fixture), spans = [{ start: 0, end: 19 }];
  const stage = { predictions: spans, selectedPredictions: { banking: [], other: spans }, error: null };
  const scoped = productScope(fixture, stage);
  assert.equal(scoped.entities[0].category, 'other');
  assert.equal(scoped.entities[0].critical, true);
  assert.equal(scoped.entities[0].selectedFull, true);
  assert.equal(productScope(fixture, { ...stage, selectedPredictions: { banking: spans, other: [] } }).entities[0].selectedFull, false);
  assert.deepEqual(fixture, snapshot);
});
