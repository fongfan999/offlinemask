import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditCorpus, parseRecord } from '../detector-feasibility/corpus.mjs';

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
export const recordDigest = (row, capabilities) => digest({ row, capabilities });
export const corpusDigest = (rows, capabilities) => digest(rows.map(row => [row.id, recordDigest(row, capabilities)]).sort(([a], [b]) => a.localeCompare(b)));
const valueKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/gu, 'd').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const templateKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/gu, 'd').toLowerCase().replace(/\d+/gu, '#').replace(/[^\p{L}\p{N}#]+/gu, ' ').trim();
function skeleton(row) {
  let result = '', cursor = 0;
  for (const entity of row.entities) { result += row.text.slice(cursor, entity.start) + '<private>'; cursor = entity.end; }
  return templateKey(result + row.text.slice(cursor));
}

export const annotationChecks = ['provenance', 'completeValues', 'boundaries', 'typeAndCategory', 'ordinaryText'];
export const splitChecks = ['scenarioSeparation', 'templateSeparation', 'valueSeparation', 'regressionSeparation'];
function validateApproval(entry, checks, authors) {
  assert.equal(entry.reviewer?.kind, 'human', 'Independent review must declare a human reviewer');
  assert.ok(typeof entry.reviewer.id === 'string' && entry.reviewer.id.trim(), 'Missing independent reviewer identity');
  assert.ok(!authors.has(entry.reviewer.id), 'Author cannot independently approve own work');
  assert.ok(typeof entry.reviewedAt === 'string' && Number.isFinite(Date.parse(entry.reviewedAt)), 'Missing review date');
  assert.ok(typeof entry.note === 'string' && entry.note.trim(), 'Missing review note');
  for (const check of checks) assert.equal(entry.checks?.[check], true, `Unfinished review check: ${check}`);
}

/** This verifies evidence consistency, not human identity or truthful provenance. */
export function auditReadiness(rows, capabilities, regressions, ledger = { records: [], splitReview: null }) {
  const basic = auditCorpus(rows, capabilities, regressions);
  const parsed = rows.map(row => parseRecord(row, capabilities));
  assert.equal(basic.composition.final.records, 0, 'Final holdout must not be authored or exposed by this preparation tool');
  const owners = new Map(), scenarios = new Map();
  const regressionTemplates = new Set(regressions.map(skeleton));
  for (const row of parsed) {
    assert.ok(!regressionTemplates.has(skeleton(row)), `Observed regression template reused: ${row.id}`);
    const scenario = row.scenarioId ?? row.familyId;
    const owner = scenarios.get(scenario);
    assert.ok(!owner || owner === row.split, `Cross-split scenario leakage: ${row.id}`);
    scenarios.set(scenario, row.split);
    for (const entity of row.entities) {
      // Type deliberately excluded: a name copied into a username is still shared vocabulary.
      const key = valueKey(entity.value), previous = owners.get(key);
      assert.ok(!previous || previous.split === row.split, `Cross-split entity value leakage: ${row.id}`);
      owners.set(key, { split: row.split, id: row.id });
    }
  }
  const byId = new Map(rows.map(row => [row.id, row])), seen = new Set(), approved = new Set();
  assert.ok(Array.isArray(ledger.records), 'Review ledger must contain records');
  for (const entry of ledger.records) {
    assert.ok(byId.has(entry.id), 'Unknown review record');
    assert.ok(!seen.has(entry.id), 'Duplicate review record'); seen.add(entry.id);
    const row = byId.get(entry.id);
    assert.equal(entry.digest, recordDigest(row, capabilities), `Stale record review: ${entry.id}`);
    assert.ok(['pending', 'approved', 'rejected'].includes(entry.status), 'Unknown review status');
    if (entry.status === 'approved') {
      validateApproval(entry, annotationChecks, new Set([row.provenance.author])); approved.add(entry.id);
    }
  }
  let splitApproved = false;
  if (ledger.splitReview) {
    assert.equal(ledger.splitReview.digest, corpusDigest(rows, capabilities), 'Stale split review');
    assert.ok(['pending', 'approved', 'rejected'].includes(ledger.splitReview.status), 'Unknown split review status');
    if (ledger.splitReview.status === 'approved') {
      validateApproval(ledger.splitReview, splitChecks, new Set(rows.map(row => row.provenance.author)));
      splitApproved = true;
    }
  }
  const pending = rows.filter(row => !approved.has(row.id));
  // Only a matching ledger approval can satisfy review; inline status is never enough.
  const reviewedRows = rows.map(row => ({ ...row, review: approved.has(row.id)
    ? { status: 'independently-reviewed', reviewer: ledger.records.find(entry => entry.id === row.id).reviewer.id }
    : { status: 'unreviewed' } }));
  const verified = auditCorpus(reviewedRows, capabilities, regressions);
  const blockers = [...verified.blockers];
  if (pending.length) blockers.push(`Independent annotation review pending for ${pending.length} records`);
  if (!splitApproved) blockers.push('Independent semantic split review pending');
  return {
    validStructure: true, composition: verified.composition,
    independentReview: { approved: approved.size, pending: pending.length, splitApproved, identityVerified: false },
    pilotReady: blockers.length === 0, finalValidationReady: false, blockers,
    corpusDigest: corpusDigest(rows, capabilities),
    records: parsed.map(row => ({ id: row.id, split: row.split, familyId: row.familyId, digest: recordDigest(byId.get(row.id), capabilities), textSha256: row.textSha256, entities: row.entities.length })),
    limits: 'Exact normalized text/template/value checks cannot prove semantic split independence. Reviewer identity and provenance are declarations, not authenticated facts. No final holdout or detection accuracy is established.',
  };
}

export function reviewTemplate(rows, capabilities) {
  return {
    version: 1,
    records: rows.map(row => ({ id: row.id, digest: recordDigest(row, capabilities), status: 'pending', reviewer: null, reviewedAt: null,
      checks: Object.fromEntries(annotationChecks.map(check => [check, false])), note: '' })),
    splitReview: { digest: corpusDigest(rows, capabilities), status: 'pending', reviewer: null, reviewedAt: null,
      checks: Object.fromEntries(splitChecks.map(check => [check, false])), note: '' },
  };
}
