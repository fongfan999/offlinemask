import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { records } from './records.mjs';
import { auditReadiness, reviewTemplate } from './audit.mjs';
import { parseRecord } from '../detector-feasibility/corpus.mjs';
import { fixtures } from '../context-fields/common.mjs';
import { verify } from '../model-recheck/common.mjs';

const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Preserve the original preparation and the current production fingerprint.
const previous = await read('docs/evaluations/detector-feasibility/preparation-evidence.json');
for (const [path, expected] of Object.entries(previous.files)) {
  assert.equal(hash(await readFile(new URL(path, root))), expected, `Changed historical preparation: ${path}`);
}
await verify();
const capabilities = await read('docs/evaluations/detector-feasibility/capabilities.json');
const seed = await read('tests/fixtures/detector-feasibility/development-seed.json');
const rows = [...seed, ...records];
const regressions = await fixtures();
const ledger = process.argv[3] ? JSON.parse(await readFile(resolve(process.argv[3]))) : reviewTemplate(rows, capabilities);
const audit = auditReadiness(rows, capabilities, regressions, ledger);
const output = resolve(process.argv[2] ?? fileURLToPath(new URL('artifacts/detector-corpus-v1', root)));
await mkdir(output, { recursive: false }); // Every preparation goes to a new directory.
const put = (name, value) => writeFile(resolve(output, name), value, { flag: 'wx' });
await put('corpus.json', JSON.stringify(rows, null, 2) + '\n');
await put('review-ledger.json', JSON.stringify(ledger, null, 2) + '\n');
await put('audit.json', JSON.stringify(audit, null, 2) + '\n');
const notes = [
  '# Synthetic corpus annotation review',
  'All examples are authored development material. No model predictions are used as labels. The historical seed has author review only; new records await review. Nothing here is a final holdout.',
  'Review every complete private value, type/category, source boundary and ordinary unmarked text. Independently inspect scenario/template/value separation across partitions. Record issues first; edit the source and generate a new review pack when correcting it. Digests bind approval to exact source, provenance and capability contract. Never copy an approval onto a changed record.',
  'Review ledger: leave pending until a separate human reviewer has actually reviewed it. For approval, supply reviewer {"kind":"human","id":"actual reviewer identifier"}, reviewedAt, each completed check and a meaningful note. Rejected or pending entries never qualify. The tool checks declarations, not reviewer identity. Do not enter customer data.',
];
for (const row of rows) {
  const parsed = parseRecord(row, capabilities);
  notes.push(`## ${row.id}`, `Partition: ${row.split} · Family: ${row.familyId} · Representation: ${row.representation}`,
    `Rationale: ${row.rationale ?? 'Historical development seed; independently review under the current capability contract.'}`,
    'Annotated source (unmarked text must remain ordinary):', '```text\n' + row.annotated + '\n```',
    parsed.entities.length ? parsed.entities.map(entity => `- ${entity.type} → ${entity.category}, UTF-16 [${entity.start}, ${entity.end}): ${JSON.stringify(entity.value)}`).join('\n') : 'No private entities annotated.',
    'Review: pending independent review.');
}
await put('review.md', notes.join('\n\n') + '\n');
const sourcePaths = [
  'scripts/detector-corpus-v1/records.mjs', 'scripts/detector-corpus-v1/audit.mjs', 'scripts/detector-corpus-v1/prepare.mjs',
  'tests/detector-corpus-v1.test.mjs', 'docs/evaluations/detector-feasibility/preparation-evidence.json',
  'docs/evaluations/detector-feasibility/capabilities.json', 'tests/fixtures/detector-feasibility/development-seed.json',
  'scripts/detector-feasibility/corpus.mjs', 'scripts/context-fields/common.mjs',
];
const sourceHashes = {};
for (const path of sourcePaths) sourceHashes[path] = hash(await readFile(new URL(path, root)));
const outputHashes = {};
for (const name of ['corpus.json', 'review-ledger.json', 'audit.json', 'review.md']) outputHashes[name] = hash(await readFile(resolve(output, name)));
await put('evidence.json', JSON.stringify({ createdAt: new Date().toISOString(), node: process.version, addedRecords: records.length,
  addedFamilies: new Set(records.map(row => row.familyId)).size, observedRegressionsChecked: regressions.length,
  regressionFingerprint: hash(Buffer.from(JSON.stringify(regressions))), sourceHashes, outputHashes, audit,
  trainingRun: false, modelInferenceRun: false, privateInputUsed: false, networkAccessNeeded: false }, null, 2) + '\n');
console.log(JSON.stringify({ output, records: rows.length, composition: audit.composition, review: audit.independentReview, pilotReady: audit.pilotReady }, null, 2));
