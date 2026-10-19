import assert from 'node:assert/strict';
import { scoreFixture } from '../model-comparison-metrics.mjs';

export function productScope(fixture, stage) {
  const entities = fixture.entities.map(e => e.type === 'card' ? { ...e, category: 'other' } : e);
  return { ...scoreFixture({ ...fixture, entities }, stage.predictions, stage.selectedPredictions),
    error: stage.error, recordId: fixture.recordId, representation: fixture.representation };
}
export function compare(fixture, before, after) {
  const gains = [], losses = [], selectedGains = [], selectedLosses = [], positionLosses = [];
  assert.equal(before.entities.length, after.entities.length);
  for (let i = 0; i < before.entities.length; i++) {
    const b = before.entities[i], a = after.entities[i];
    assert.deepEqual([b.start, b.end, b.category], [a.start, a.end, a.category]);
    const item = { id: fixture.id, file: fixture.file, value: b.value, category: b.category, type: b.type, critical: b.critical ?? false };
    if (!b.full && a.full) gains.push(item);
    if (b.full && !a.full) losses.push(item);
    if (!b.selectedFull && a.selectedFull) selectedGains.push(item);
    if (b.selectedFull && !a.selectedFull) selectedLosses.push(item);
    for (const selection of ['all', b.category]) {
      const oldSpans = selection === 'all' ? before.predictions : before.selectedPredictions[selection];
      const newSpans = selection === 'all' ? after.predictions : after.selectedPredictions[selection];
      const lost = [];
      for (let p = b.start; p < b.end; p++) if (!/\s/u.test(fixture.text[p]) && oldSpans.some(s => s.start <= p && p < s.end) && !newSpans.some(s => s.start <= p && p < s.end)) lost.push(p);
      if (lost.length) positionLosses.push({ ...item, selection, lost });
    }
  }
  const extraOrdinary = [];
  for (let p = 0; p < fixture.text.length; p++) {
    if (/[\p{L}\p{M}\p{N}]/u.test(fixture.text[p]) && !fixture.entities.some(e => e.start <= p && p < e.end)
      && after.predictions.some(s => s.start <= p && p < s.end) && !before.predictions.some(s => s.start <= p && p < s.end)) extraOrdinary.push(p);
  }
  return { gains, losses, selectedGains, selectedLosses, positionLosses,
    addedOrdinary: extraOrdinary.length ? [{ id: fixture.id, file: fixture.file, positions: extraOrdinary }] : [] };
}
