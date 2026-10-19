import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verify } from '../model-recheck/common.mjs';
const root = new URL('../../', import.meta.url), work = new URL('artifacts/minilm-admission/', root);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async p => JSON.parse(await readFile(new URL(p, work), 'utf8'));
await verify();
const prototype = await read('prototype-evidence.json'), tokenizer = await read('tokenizer-evidence.json'), chunks = await read('chunk-evidence.json');
const runtimes = Object.fromEntries(await Promise.all(['cpu', 'wasm', 'wasm-fp32'].map(async name => [name, await read(`runtime-${name}.json`)])));
const pack = {};
for (const file of await readdir(new URL('pack/', work))) {
  const bytes = await readFile(new URL(`pack/${file}`, work));
  pack[file] = { bytes: bytes.length, sha256: digest(bytes) };
  if (prototype.files[file]) assert.equal(pack[file].sha256, prototype.files[file].sha256);
}
const packBytes = Object.values(pack).reduce((n, f) => n + f.bytes, 0);
const rawHashes = {};
for (const file of ['corpus.json', 'tokenizer-reference.json', 'runtime-reference.json', 'prototype-evidence.json',
  'tokenizer-evidence.json', 'chunks.json', 'chunk-evidence.json', 'runtime-cpu.json', 'runtime-wasm.json', 'runtime-wasm-fp32.json',
  'prototype-initial.py', 'prototype-initial.log', 'tokenizer-initial.mjs', 'runtime-int8-only.mjs']) rawHashes[file] = digest(await readFile(new URL(file, work)));
const sourceHashes = {};
for (const file of await readdir(new URL('scripts/minilm-admission/', root))) sourceHashes[`scripts/minilm-admission/${file}`] = digest(await readFile(new URL(`scripts/minilm-admission/${file}`, root)));
for (const file of ['spec.md', 'source-manifest.json', 'download-evidence.json', 'python-requirements.txt', 'license-source.json'])
  sourceHashes[`docs/evaluations/minilm-admission/${file}`] = digest(await readFile(new URL(`docs/evaluations/minilm-admission/${file}`, root)));
assert.equal(prototype.randomHead, true); assert.equal(prototype.trainingSteps, 0);
const gates = { size: packBytes <= 300000000,
  tokenizerParity: tokenizer.slowFastIdMismatches.length === 0 && tokenizer.summary.jsIdMismatches === 0 && chunks.jsSlowMismatches === 0,
  currentSourceMapping: tokenizer.summary.currentAlignerFailures === 0 && tokenizer.summary.referenceOffsetGapCases === 0,
  fp32Export: prototype.comparisons.every(c => c.fp32MaxAbs <= 1e-4),
  compressedNodeParity: runtimes.cpu.pass, compressedWasmParity: runtimes.wasm.pass,
  fp32WasmControl: runtimes['wasm-fp32'].pass, packagedRuntime: false, privacyQuality: false };
await writeFile(new URL('docs/evaluations/minilm-admission/results.json', root), JSON.stringify({ createdAt: new Date().toISOString(),
  decision: 'Hold before training admission: tokenizer/source-position and compressed WASM parity gates fail.',
  gates, packBytes, pack, prototype, tokenizer, chunks, runtimes, rawHashes, sourceHashes,
  limits: 'Random 39-label head, zero training. CPU and Node-hosted WASM only; no packaged WebKit, performance, cancellation, memory or privacy-quality qualification. Metadata/source inspection and explicit developer downloads used Internet; inference blocks fetch or uses offline library flags. Production fingerprint unchanged.'
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ packBytes, gates, tokenizer: tokenizer.summary, chunks: { count:chunks.count, jsSlowMismatches:chunks.jsSlowMismatches, jsFastMismatches:chunks.jsFastMismatches, overBudget:chunks.overBudget } }));
