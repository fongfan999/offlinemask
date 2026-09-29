import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, output, hash, readJson, fixtures, protocolPath } from './common.mjs';
import { runtimeVersion } from '../native-preprocessing/evidence.mjs';
const { beforeSources } = await readJson(join(output, 'before.json'));
const old = await readJson(join(root, 'docs/evaluations/model-recheck-v1-protocol.json'));
const core = await readJson(join(root, 'docs/evaluations/context-fields-v1-protocol.json'));
const scope = await readJson(join(root, 'docs/evaluations/pretrained-scope/protocol.json'));
const beforeFiles = { ...core.files, ...old.files, ...scope.sourceHashes };
assert.equal(process.version, old.node); assert.equal(runtimeVersion(), old.onnxruntime);
for (const [file, expected] of Object.entries(beforeFiles)) assert.equal(hash(beforeSources[file] ?? await readFile(join(root, file))), expected, `Before source ${file}`);
const files = {};
const extra = ['docs/evaluations/structured-gaps-v1/spec.md', 'tests/structured-gaps.test.mjs',
  ...['common','freeze','evaluate','report'].map(name => `scripts/structured-gaps-v1/${name}.mjs`),
  'docs/evaluations/model-recheck-v1-protocol.json', 'docs/evaluations/context-fields-v1-protocol.json',
  'docs/evaluations/pretrained-scope/protocol.json', 'docs/evaluations/shared-core-protocol-v2.json',
  'artifacts/pretrained-scope/combined.json', 'artifacts/pretrained-scope/underthesea.json'];
for (const file of new Set([...Object.keys(beforeFiles), ...extra])) files[file] = hash(await readFile(join(root, file)));
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(), node: process.version,
  onnxruntime: runtimeVersion(), cases: (await fixtures()).length, beforeFiles, beforeSources, files }, null, 2)+'\n', {flag:'wx'});
console.log('Frozen before inference.');
