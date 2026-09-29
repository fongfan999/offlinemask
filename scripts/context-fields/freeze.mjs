import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, hash, readJson, changedPaths, protocolPath } from './common.mjs';

const baseline = await readJson(join(root, 'docs/evaluations/policy-hardening-v2-protocol.json'));
const before = await readJson(join(root, 'artifacts/context-fields/before.json'));
const files = {}, beforeSources = {};
for (const [file, expected] of Object.entries(baseline.files)) {
  assert.equal(hash(before.files[file]), expected, `Baseline snapshot: ${file}`);
  const content = await readFile(join(root, file));
  if (changedPaths.includes(file)) beforeSources[file] = before.files[file];
  else assert.equal(hash(content), expected, `Unrelated change: ${file}`);
  files[file] = hash(content);
}
const extra = ['src/core/detection/context-fields.ts', 'tests/context-fields.test.mjs',
  'docs/licenses/ipaddr.js-MIT.txt', 'docs/evaluations/policy-hardening-v2-protocol.json',
  'docs/evaluations/policy-hardening-v2-results.json',
  ...(await readdir(join(root, 'scripts/context-fields'))).filter(p => p.endsWith('.mjs')).map(p => `scripts/context-fields/${p}`)];
for (const file of extra) files[file] = hash(await readFile(join(root, file)));
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(), node: process.version,
  files, beforeSources,
  changes: 'ipaddr.js 2.5.0 IPv6 validation; explicitly labelled calendar dates and operational facts; bounded legal organization completion with label or model support. Same contextual category and model requirements.',
  method: 'Same pinned pair, twice on 362 previously observed synthetic cases, fetch forbidden. Compare against policy-hardening-v2 including exact category-selected coverage and newly masked ordinary positions. Actual no-pack path repeated separately.',
  gates: 'Identical repeats, zero failed requests; investigate each lost private position, complete or selected value, and newly masked ordinary position. No fresh-validation or release qualification claim.',
  limits: 'Developer-authored, observed synthetic examples. Only the incumbent pair rerun; not a model ranking, independent final validation, or packaged-runtime qualification.'
}, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen contextual-field experiment');
