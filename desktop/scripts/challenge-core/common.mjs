import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFixture, categories } from '../model-comparison-metrics.mjs';
import { summarizeStage } from '../shared-core/metrics.mjs';
import { verify as verifyNative, root, hash, readJson } from '../native-preprocessing/evidence.mjs';
export { root, hash, readJson };
export const fixturePath = 'tests/fixtures/release-challenge-v1.json';
export const protocolPath = join(root, 'docs/evaluations/release-challenge-v1-protocol.json');
export const outputRoot = join(root, 'artifacts/release-challenge-v1');
export const variants = ['small', 'large', 'combined', 'bigmed-native', 'underthesea'];
export const typeCategories = {
  person: 'name', address: 'address', email: 'email', phone: 'phone', account: 'banking',
  identity: 'banking', passport: 'banking', transaction: 'banking', tax: 'banking', card: 'banking',
  customer: 'banking', birthdate: 'other', organization: 'other', username: 'other', password: 'other', apikey: 'other', ip: 'other',
};
export const criticalTypes = ['email', 'phone', 'account', 'identity', 'passport', 'transaction', 'tax', 'card', 'customer', 'password', 'apikey'];
export function parseRows(rows) {
  const ids = new Set();
  return rows.map(row => {
    assert.ok(typeof row.id === 'string' && !ids.has(row.id), 'Duplicate or missing case id'); ids.add(row.id);
    assert.ok(row.recordId && row.representation, 'Missing provenance');
    const f = parseFixture(row);
    assert.equal(f.entities.length, row.entityTypes.length, `Type annotation count: ${row.id}`);
    return { ...f, recordId: row.recordId, representation: row.representation, entities: f.entities.map((e, i) => {
      const type = row.entityTypes[i]; assert.equal(typeCategories[type], e.category, `Type/category: ${row.id}`);
      return { ...e, type, critical: criticalTypes.includes(type) };
    }) };
  });
}
export async function fixtures() { return parseRows(await readJson(join(root, fixturePath))); }
export function describe(fixtures) {
  const entities = fixtures.flatMap(f => f.entities);
  return { cases: fixtures.length, families: new Set(fixtures.map(f => f.recordId)).size,
    negativeCases: fixtures.filter(f => !f.entities.length).length, values: entities.length,
    criticalValues: entities.filter(e => e.critical).length,
    representations: Object.fromEntries([...new Set(fixtures.map(f => f.representation))].map(r => [r, fixtures.filter(f => f.representation === r).length])),
    types: Object.fromEntries(Object.keys(typeCategories).map(t => [t, entities.filter(e => e.type === t).length])),
  };
}
export function summarizeChallenge(rows) {
  const stage = summarizeStage(rows);
  const entities = rows.flatMap(r => r.entities);
  const byType = Object.fromEntries(Object.entries(typeCategories).map(([type, category]) => {
    const es = entities.filter(e => e.type === type);
    const threshold = ['email', 'phone', 'banking'].includes(category) ? .99 : .95;
    return [type, { total: es.length, full: es.filter(e => e.full).length, selectedFull: es.filter(e => e.selectedFull).length,
      threshold, pass: es.length > 0 && es.filter(e => e.selectedFull).length / es.length >= threshold }];
  }));
  const criticalFailures = rows.flatMap(r => r.entities.filter(e => e.critical && (!e.full || !e.selectedFull)).map(e => ({ id: r.id, ...e })));
  const byRepresentation = Object.fromEntries([...new Set(rows.map(r => r.representation))].map(rep => {
    const subset = rows.filter(r => r.representation === rep);
    return [rep, summarizeStage(subset).summary];
  }));
  const families = [...new Set(rows.map(r => r.recordId))];
  const completeFamilies = families.filter(id => rows.filter(r => r.recordId === id).every(r => !r.error && r.falsePositiveChars === 0 && r.entities.every(e => e.full && e.selectedFull))).length;
  return { ...stage, byType, byRepresentation, families: { total: families.length, completeWithoutExcessMasking: completeFamilies },
    criticalFailures, challengePass: stage.screeningPass && Object.values(byType).every(t => t.pass) && criticalFailures.length === 0 };
}
export async function verify() {
  const parent = await verifyNative();
  const protocol = await readJson(protocolPath);
  assert.equal(hash(await readFile(join(root, 'docs/evaluations/native-preprocessing-protocol.json'))), protocol.parentProtocolSha256);
  for (const [file, expected] of Object.entries(protocol.files)) assert.equal(hash(await readFile(join(root, file))), expected, `Frozen challenge changed: ${file}`);
  assert.equal(process.version, protocol.node, 'Node runtime changed');
  assert.deepEqual(describe(await fixtures()), protocol.composition, 'Composition changed');
  return { ...parent, protocol };
}
