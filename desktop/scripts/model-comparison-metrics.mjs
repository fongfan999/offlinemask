import assert from 'node:assert/strict';

export const categories = ['name', 'address', 'email', 'phone', 'banking', 'other'];

/** Exhaustive synthetic annotations: every unmarked letter/number is expected to remain. */
export function parseFixture(fixture) {
  let text = fixture.prefixRepeat ? 'Nội dung tổng hợp đã được kiểm tra. '.repeat(fixture.prefixRepeat) : '';
  const entities = [];
  let cursor = 0;
  for (const match of fixture.annotated.matchAll(/\[\[([a-z]+)\|([^\]]+)\]\]/gu)) {
    assert.ok(categories.includes(match[1]), `Unknown category in ${fixture.id}`);
    text += fixture.annotated.slice(cursor, match.index);
    const start = text.length;
    text += match[2];
    assert.ok(match[2].trim(), `Empty entity in ${fixture.id}`);
    entities.push({ category: match[1], start, end: text.length, value: match[2] });
    cursor = match.index + match[0].length;
  }
  text += fixture.annotated.slice(cursor);
  assert.ok(!text.includes('[[') && !text.includes(']]'), `Invalid annotation in ${fixture.id}`);
  return { id: fixture.id, group: fixture.group, text, entities };
}

const bitmap = (length, spans) => {
  const result = new Uint8Array(length);
  for (const { start, end } of spans) {
    assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= length);
    result.fill(1, start, end);
  }
  return result;
};

export function scoreFixture(fixture, spans, selectedSpans = {}) {
  const predicted = bitmap(fixture.text.length, spans);
  const expected = bitmap(fixture.text.length, fixture.entities);
  const outcomes = fixture.entities.map(entity => {
    const selected = bitmap(fixture.text.length, selectedSpans[entity.category] ?? []);
    let total = 0, covered = 0, selectedCovered = 0;
    for (let i = entity.start; i < entity.end; i++) {
      if (/\s/u.test(fixture.text[i])) continue;
      total++;
      covered += predicted[i];
      selectedCovered += selected[i];
    }
    return { ...entity, total, covered, full: covered === total, selectedFull: selectedCovered === total };
  });
  let sensitiveChars = 0, coveredChars = 0, ordinaryChars = 0, falsePositiveChars = 0;
  const falsePositives = [];
  let segment = null;
  for (let i = 0; i < fixture.text.length; i++) {
    // Ignore whitespace/punctuation for excess-masking metrics, including address separators.
    const lexical = /[\p{L}\p{M}\p{N}]/u.test(fixture.text[i]);
    if (lexical) {
      if (expected[i]) { sensitiveChars++; coveredChars += predicted[i]; }
      else { ordinaryChars++; falsePositiveChars += predicted[i]; }
    }
    if (lexical && predicted[i] && !expected[i]) {
      if (segment === null) segment = i;
    } else if (segment !== null && (!predicted[i] || expected[i])) {
      falsePositives.push({ start: segment, end: i, value: fixture.text.slice(segment, i) });
      segment = null;
    }
  }
  if (segment !== null) falsePositives.push({ start: segment, end: fixture.text.length, value: fixture.text.slice(segment) });
  return { id: fixture.id, group: fixture.group, entities: outcomes, sensitiveChars, coveredChars,
    ordinaryChars, falsePositiveChars, falsePositives };
}

export function summarize(cases) {
  const entities = cases.flatMap(value => value.entities);
  const sum = field => cases.reduce((total, value) => total + value[field], 0);
  const coveredChars = sum('coveredChars'), falsePositiveChars = sum('falsePositiveChars');
  return {
    cases: cases.length, failedCases: cases.filter(value => value.error).length, entities: entities.length,
    fullyCovered: entities.filter(value => value.full).length,
    partial: entities.filter(value => !value.full && value.covered > 0).length,
    missed: entities.filter(value => !value.covered).length,
    sensitiveChars: sum('sensitiveChars'), coveredChars,
    ordinaryChars: sum('ordinaryChars'), falsePositiveChars,
    characterPrecision: coveredChars / (coveredChars + falsePositiveChars || 1),
    excessMaskingRate: falsePositiveChars / (sum('ordinaryChars') || 1),
    negativeCases: cases.filter(value => !value.entities.length).length,
    falsePositiveNegativeCases: cases.filter(value => !value.entities.length && value.falsePositiveChars > 0).length,
    byCategory: Object.fromEntries(categories.map(category => {
      const values = entities.filter(value => value.category === category);
      return [category, { total: values.length, full: values.filter(value => value.full).length,
        selectedFull: values.filter(value => value.selectedFull).length }];
    })),
  };
}

export function meetsScreeningFloor(result) {
  const s = result.summary;
  const ratio = (n, d) => d > 0 ? n / d : 0;
  return s.failedCases === 0 && ratio(s.fullyCovered, s.entities) >= .95
    && ['name', 'address'].every(category => {
      const value = s.byCategory[category];
      return ratio(value.full, value.total) >= .95 && ratio(value.selectedFull, value.total) >= .95;
    })
    && ['email', 'phone', 'banking'].every(category => {
      const value = s.byCategory[category];
      return ratio(value.full, value.total) >= .99;
    })
    && result.shortSummary.excessMaskingRate <= .01 && s.falsePositiveNegativeCases <= 1;
}
