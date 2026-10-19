import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { join } from 'node:path';
import { verify as verifyCore } from '../context-fields/common.mjs';
import { runtimeVersion } from '../native-preprocessing/evidence.mjs';
import { root, readJson, hash, protocolPath, variants, fixtures } from './common.mjs';
await verifyCore();
const parent = await readJson(join(root, 'docs/evaluations/native-preprocessing-protocol.json'));
for (const [file, expected] of Object.entries(parent.sources)) assert.equal(hash(await readFile(join(root, file))), expected, file);
const paths = ['docs/evaluations/context-fields-v1-protocol.json', 'docs/evaluations/context-fields-v1-results.json',
  'docs/evaluations/model-recheck-v1-spec.md', ...Object.keys(parent.sources),
  ...(await readdir(join(root, 'scripts/model-recheck'))).filter(p => p.endsWith('.mjs')).map(p => `scripts/model-recheck/${p}`)];
const files = Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(root, p)))])));
const all = await fixtures();
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(), node: process.version,
  onnxruntime: runtimeVersion(), variants, files,
  composition: { regression: all.filter(f => f.corpus === 'regression').length, challenge: all.filter(f => f.corpus === 'challenge').length },
  hardware: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), platform: platform(), release: release(), arch: arch() },
  method: 'Twice per candidate in separate sequential CPU processes, fixed variant order. Current common core, pinned assets, original annotations, fetch blocked. Underthesea FP32 is a quantization reference. No candidate-specific changes.',
  performance: 'Exploratory Node CPU measurements only, no pass/fail hardware budget. Per-case inspect latency excludes scoring. Warm short-case statistics exclude the first case and long fixtures. Setup includes provider loading and alternative tokenizer reference preparation for the corpus; it is not cold app startup. Sampled Node RSS excludes Python children and is not whole-app peak memory. Hash checks may warm the OS file cache.'
}, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen candidate recheck');
