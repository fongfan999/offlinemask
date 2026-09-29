// Explicit developer action. Historical protocols are never overwritten.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, protocolPath, hash, readJson } from './evidence.mjs';
const previous = await readJson(join(root, 'docs/evaluations/2026-09-14-structured-values-protocol.json'));
const files = {};
async function collect(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(file);
    else files[file] = hash(await readFile(join(root, file)));
  }
}
await collect('src/core');
await collect('scripts/shared-core');
for (const file of ['package.json', 'pnpm-lock.yaml', 'scripts/model-manifest.json', 'scripts/model-comparison-metrics.mjs',
  'scripts/native-prototype/wasm-provider.mjs']) files[file] = hash(await readFile(join(root, file)));
const current = await readJson(join(root, 'scripts/model-manifest.json'));
const alternatives = await readJson(join(root, 'artifacts/alternative-models/evaluation-manifest.json'));
const asset = m => ({ directory: `public/models/${m.directory}`, repository: m.repository, revision: m.revision,
  files: Object.fromEntries(Object.entries(m.files).map(([file, sha256]) => [file, { sha256, size: m.sizes[file] }])) });
const assets = { small: [asset(current.models[0])], large: [asset(current.models[1])], combined: current.models.map(asset) };
for (const [name, candidate] of Object.entries(alternatives.variants)) assets[name] = [{ ...candidate, directory: `artifacts/alternative-models/${candidate.directory}` }];
const baselineSources = {}, baselineHashes = {};
for (const file of Object.keys(files).filter(f => f.startsWith('src/core/'))) {
  let original;
  try { original = await readFile(join(root, 'artifacts/shared-core/baseline', file), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  baselineHashes[file] = hash(original);
  if (baselineHashes[file] !== files[file]) baselineSources[file] = original;
}
for (const [file, expected] of Object.entries(previous.afterHashes)) assert.equal(baselineHashes[file], expected, 'Wrong pre-refactor baseline');
for (const [file, expected] of Object.entries(previous.fixtureHashes)) assert.equal(hash(await readFile(join(root, 'tests/fixtures', file))), expected);
await writeFile(protocolPath, JSON.stringify({ createdAt: new Date().toISOString(), kind: 'Observed-corpus integration comparison; not held-out model selection',
  previousProtocol: 'shared-core-protocol.json',
  revisionReason: 'Initial BigMed Metaspace alignment failed on fresh-emoji and fresh-negative-unicode (observed historical fixture IDs). Apply native tokenizer offsets with exact JS token-ID equality to BigMed as well as Underthesea. Preserve original run and sources; no detector policy or annotation changes.',
  fixtures: previous.fixtureHashes, files, assets, alternativeProvenance: alternatives,
  baselineHashes, baselineSources,
  method: 'Same Node CPU runtime and common windows/policy; modelOnly and complete stages scored independently. BigMed and Underthesea native tokenizer IDs must match JS inference IDs; native offsets converted to UTF-16. No input uploads, fetch blocked.',
  parity: 'Original and refactored pair on identical real WASM token predictions, comparing full Detection arrays, progress, all-category and category-only spans on every fixture.',
  criteria: 'Existing screening floor plus own-category completeness for every category: 99% email/phone/banking, 95% name/address/other. Observed-set pass cannot qualify a release.',
  limits: 'All cases already observed, synthetic and developer authored. No Excel parser, OCR, PDF output or packaged-runtime qualification. No performance ranking: reference tokenization is prepared separately.',
}, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen shared-core integration protocol');
