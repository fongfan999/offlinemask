import assert from 'node:assert/strict';
import { analyzeText } from '../../src/core/text.ts';
import { filterDetections } from '../../src/core/detection/options.ts';
import { categories, scoreFixture } from '../model-comparison-metrics.mjs';
export const variants = ['small', 'large', 'combined', 'bigmed-native', 'underthesea'];
export const contextualTypes = new Set(['TEN', 'DIA_CHI', 'TO_CHUC']);
export const contextual = predictions => predictions.filter(row => contextualTypes.has(row.type));
export const productFixture = f => ({ ...f, entities: f.entities.map(e => e.type === 'card' ? { ...e, category: 'other' } : e) });
export function score(f, detections) {
  const predicted = values => analyzeText(f.text, '12345678', values).spans.map(span => ({ ...span, value: f.text.slice(span.start, span.end) }));
  const predictions = predicted(detections);
  const selectedPredictions = Object.fromEntries(categories.map(c => [c, predicted(filterDetections(detections, [c]))]));
  return { ...scoreFixture(f, predictions, selectedPredictions), predictions, selectedPredictions,
    error: null, recordId: f.recordId, representation: f.representation };
}
export function assertReplay(actual, saved, id) {
  assert.deepEqual(actual.predictions, saved.predictions, `Full saved preview mismatch: ${id}`);
  assert.deepEqual(actual.selectedPredictions, saved.selectedPredictions, `Selected saved preview mismatch: ${id}`);
}
