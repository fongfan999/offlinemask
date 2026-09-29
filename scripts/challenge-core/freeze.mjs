import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verify as verifyNative } from '../native-preprocessing/evidence.mjs';
import { parseFixture } from '../model-comparison-metrics.mjs';
import { root, hash, readJson, fixtures, describe, fixturePath, protocolPath, variants } from './common.mjs';
const { base } = await verifyNative();
const current = await fixtures();
const previous = [];
for (const file of Object.keys(base.fixtures)) previous.push(...(await readJson(join(root, 'tests/fixtures', file))).map(parseFixture));
const normalize = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
assert.ok(current.every(f => !previous.some(p => normalize(p.text) === normalize(f.text))), 'Previously observed case duplicated');
const previousValues = new Set(previous.flatMap(f => f.entities.map(e => normalize(e.value))));
const reusedValues = [...new Set(current.flatMap(f => f.entities.map(e => normalize(e.value))).filter(v => previousValues.has(v)))];
const paths = [fixturePath, 'tests/challenge-core.test.mjs', 'docs/evaluations/release-challenge-v1-spec.md',
  ...((await readdir(join(root, 'scripts/challenge-core'))).filter(n => n.endsWith('.mjs')).map(n => `scripts/challenge-core/${n}`))];
const files = Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(root, p)))])));
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(), node: process.version, files,
  parentProtocolSha256: hash(await readFile(join(root, 'docs/evaluations/native-preprocessing-protocol.json'))),
  variants, composition: describe(current), reusedAnnotatedValues: reusedValues,
  preflight: { unusedProtocolSha256: hash(await readFile(join(root, 'docs/evaluations/release-challenge-v1-preflight-protocol.json'))), reason: 'Corrected a report-script syntax error before any model inference; preserved the unused preliminary freeze.' },
  partition: 'One new synthetic challenge partition. All representations of a record stay together. The prior 262 cases remain observed regressions. This is not independently authored or representative field data. Once scored, this set is observed and must not be recycled as a fresh holdout.',
  method: 'Two separate sequential Node CPU processes per candidate. Unchanged core, metrics, thresholds and pinned assets. BigMed uses the verified native preprocessing provider. Both model-derived and complete stages; no production changes or candidate tuning. No downloads; fetch blocked during runs.',
  gates: { overall: .95, selectedNameAddressOther: .95, selectedEmailPhoneBanking: .99, perSubtypeUsesCategoryThreshold: true,
    shortOrdinaryMaskingMaximum: .01, affectedNegativeCasesMaximum: 1, requestFailuresMaximum: 0,
    criticalCompleteAndSelectedRequired: true, criticalRegressionAgainstPairAllowed: false, identicalRepeatRequired: true },
  limits: 'No final release selection from this test alone. No independent annotation review, real customer data, extraction/source-region proof, packaged app qualification or resource budgets. Repeated variants and runs are not independent samples.',
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ frozen: protocolPath, composition: describe(current), reusedValues }));
