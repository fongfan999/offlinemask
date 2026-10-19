import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const fingerprint = text => createHash('sha256').update(text).digest('hex');
const normalized = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/gu, 'd')
  .toLowerCase().replace(/\d+/gu, '#').replace(/[^\p{L}\p{N}#]+/gu, ' ').trim();
const splits = ['train', 'development', 'final'];

export function parseRecord(row, capabilities) {
  assert.ok(typeof row.id === 'string' && row.id.length > 0, 'Missing record id');
  assert.ok(splits.includes(row.split), `Invalid split: ${row.id}`);
  for (const key of ['familyId', 'templateId', 'representation']) assert.ok(typeof row[key] === 'string' && row[key], `Missing ${key}: ${row.id}`);
  assert.equal(row.provenance?.kind, 'authored-synthetic', 'Only authored synthetic inputs admitted');
  assert.ok(row.provenance.author && row.provenance.createdAt && row.provenance.sourceId, 'Missing provenance');
  assert.equal(row.provenance.realRecordsUsed, false, 'Real records not admitted');
  assert.ok(['unreviewed', 'author-reviewed', 'independently-reviewed'].includes(row.review?.status), 'Missing review state');
  if (row.review.status !== 'unreviewed') assert.ok(row.review.reviewer, 'Missing reviewer');
  if (row.review.status === 'independently-reviewed') assert.notEqual(row.review.reviewer, row.provenance.author, 'Author cannot independently review own record');
  assert.ok(typeof row.annotated === 'string' && row.annotated.trim() && row.annotated.isWellFormed(), 'Invalid annotated text');
  let text = '', cursor = 0, skeleton = '';
  const entities = [];
  for (const match of row.annotated.matchAll(/\[\[([a-z]+)\|([^\]]+)\]\]/gu)) {
    const spec = capabilities.types[match[1]];
    assert.ok(spec, `Unsupported private type: ${match[1]}`);
    const prefix = row.annotated.slice(cursor, match.index);
    text += prefix; skeleton += prefix + '<private>';
    const start = text.length, value = match[2];
    assert.ok(value.trim() && value === value.trim(), 'Entity boundary contains outer whitespace');
    text += value; entities.push({ start, end: text.length, value, type: match[1], category: spec.category, critical: spec.critical });
    cursor = match.index + match[0].length;
  }
  text += row.annotated.slice(cursor); skeleton += row.annotated.slice(cursor);
  assert.ok(!text.includes('[[') && !text.includes(']]'), 'Malformed or nested annotations');
  const boundaries = new Set([0, text.length]);
  for (const { index, segment } of new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)) {
    boundaries.add(index); boundaries.add(index + segment.length);
  }
  for (const e of entities) assert.ok(boundaries.has(e.start) && boundaries.has(e.end), 'Entity splits a grapheme');
  return { ...row, text, entities, normalizedText: normalized(text), normalizedSkeleton: normalized(skeleton), textSha256: fingerprint(text) };
}

/** Metadata checks are not proof that an author told the truth or annotations are correct. */
export function auditCorpus(rows, capabilities, regressions = []) {
  const parsed = rows.map(r => parseRecord(r, capabilities)), ids = new Set(), owners = new Map();
  const oldText = new Set(regressions.map(r => normalized(r.text)));
  for (const r of parsed) {
    assert.ok(!ids.has(r.id), `Duplicate record id: ${r.id}`); ids.add(r.id);
    assert.ok(!oldText.has(r.normalizedText), `Observed regression reused: ${r.id}`);
    for (const [kind, value] of [['family', r.familyId], ['template', r.templateId], ['text', r.normalizedText], ['skeleton', r.normalizedSkeleton]]) {
      const key = `${kind}/${value}`, previous = owners.get(key);
      assert.ok(!previous || previous === r.split, `Cross-split ${kind} leakage: ${r.id}`);
      owners.set(key, r.split);
    }
  }
  const composition = Object.fromEntries(splits.map(split => {
    const subset = parsed.filter(r => r.split === split);
    const families = new Set(subset.map(r => r.familyId));
    const negativeFamilies = [...families].filter(id => subset.filter(r => r.familyId === id).every(r => r.entities.length === 0)).length;
    return [split, { records: subset.length, families: families.size, negativeFamilies,
      unreviewed: subset.filter(r => r.review.status === 'unreviewed').length,
      independentlyReviewed: subset.filter(r => r.review.status === 'independently-reviewed').length,
      typeFamilies: Object.fromEntries(Object.keys(capabilities.types).map(type => [type, new Set(subset.filter(r => r.entities.some(e => e.type === type)).map(r => r.familyId)).size])) }];
  }));
  const blockers = [], target = capabilities.requiredForPilot;
  for (const split of ['train', 'development']) {
    const c = composition[split], required = split === 'train' ? target.trainFamilies : target.developmentFamilies;
    if (c.families < required) blockers.push(`${split}: requires ${required} families, has ${c.families}`);
    if (c.unreviewed) blockers.push(`${split}: ${c.unreviewed} records need review`);
    if (!c.families || c.negativeFamilies / c.families < target.negativeFractionMin) blockers.push(`${split}: insufficient ordinary-negative families`);
    for (const [type, count] of Object.entries(c.typeFamilies)) if (count < target.perTypeFamilies) blockers.push(`${split}/${type}: requires ${target.perTypeFamilies} families, has ${count}`);
  }
  return { validStructure: true, pilotReady: blockers.length === 0, finalValidationReady: false,
    finalValidationNote: 'Final admission additionally needs independent review, disjoint semantic scenarios/values, frozen provenance, candidate identity and a one-use final evaluation protocol; this audit does not certify these.',
    composition, blockers, fingerprints: parsed.map(r => ({ id: r.id, split: r.split, textSha256: r.textSha256 })) };
}
