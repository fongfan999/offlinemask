// Explicit local synthetic replay of the exact shipping adapter + Rust tokenizer.
import assert from 'node:assert/strict';
import { readFile, mkdir, link, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { loadRecognition } from '../../src/core/detection/recognition.ts';
import { score } from '../pretrained-scope/common.mjs';
const root = resolve('artifacts/recognition-production-v1/models');
const catalog = JSON.parse(await readFile('scripts/release-pack-v1.json'));
for (const a of catalog.assets) {
  const source = a.directory === 'underthesea' ? join('artifacts/alternative-models/underthesea', a.name) : join('public/models', a.directory, a.name);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(source)) { hash.update(chunk); bytes += chunk.length; }
  assert.equal(hash.digest('hex'), a.sha256); assert.equal(bytes, a.bytes);
  await mkdir(join(root, a.directory), { recursive: true });
  await link(source, join(root, a.directory, a.name)).catch(e => { if (e.code !== 'EEXIST') throw e; });
}
const child = spawn(resolve('src-tauri/target/release/recognition-tokenizer-check'), [root], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: child.stdout });
let pending;
lines.on('line', line => { const next = pending; pending = undefined; if (next) { try { next.resolve(JSON.parse(line)); } catch (e) { next.reject(e); } } });
child.on('exit', () => { pending?.reject(Error('Native tokenizer exited')); pending = undefined; });
const encode = text => new Promise((resolve, reject) => { assert.ok(!pending); pending = { resolve, reject }; child.stdin.write(JSON.stringify(text) + '\n'); });
const casesBytes = await readFile('artifacts/quality-first-v1/cases.json');
assert.equal(createHash('sha256').update(casesBytes).digest('hex'), '347c8eff304b2520d88e0f4019fc44d7829fa3f894ac5ba7db6b65428f5b579d');
const cases = JSON.parse(casesBytes);
const summary = JSON.parse(await readFile('docs/evaluations/quality-first-v1/results.json'));
const fullBytes = await readFile(summary.fullResults.path);
assert.equal(createHash('sha256').update(fullBytes).digest('hex'), summary.fullResults.sha256);
const old = JSON.parse(fullBytes);
assert.deepEqual(old.rawHashes, summary.rawHashes);
const expected = old.recipes.find(r => r.id === 'underthesea+large:contextual'); assert.ok(expected);
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('Network forbidden'); };
const started = performance.now();
const detector = await loadRecognition(root, encode, 'cpu');
const outcomes = [], mismatches = [], cache = new Map();
const comparable = v => JSON.stringify(v, (key, value) => key === 'source' ? undefined : value);
try {
  for (const [index, fixture] of cases.entries()) {
    if (!cache.has(fixture.text)) cache.set(fixture.text, await detector.detect(fixture.text));
    const result = score(fixture, cache.get(fixture.text));
    const prior = expected.outcomes[index]; assert.equal(prior.id, fixture.id);
    const matches = comparable(result.predictions) === comparable(prior.result.predictions)
      && comparable(result.selectedPredictions) === comparable(prior.result.selectedPredictions);
    if (!matches) mismatches.push({ index, id: fixture.id, corpus: fixture.corpus });
    outcomes.push({ id: fixture.id, corpus: fixture.corpus, result, matches });
    if ((index + 1) % 25 === 0) console.log(`Production replay ${index + 1}/${cases.length}; differences: ${mismatches.length}`);
  }
  assert.equal(networkAttempts, 0);
  const ranked = outcomes.filter(o => o.corpus !== 'owner12');
  const report = { completedAt: new Date().toISOString(), backend: 'Production TypeScript adapter on CPU + shipping Rust tokenizers 0.22.2; desktop WASM parity is a separate check',
    caseSha256: createHash('sha256').update(casesBytes).digest('hex'), recipe: expected.id, cases: cases.length, networkAttempts, durationSeconds: (performance.now() - started) / 1000,
    own: ranked.flatMap(o => o.result.entities).filter(e => e.selectedFull).length, total: ranked.flatMap(o => o.result.entities).length,
    ordinary: ranked.reduce((n, o) => n + o.result.falsePositiveChars, 0), mismatches, outcomes };
  await writeFile(process.argv[2] ?? 'docs/evaluations/recognition-production-v1/results.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(mismatches, [], 'Production differs from selected evaluation recipe');
  console.log('PASS', cases.length, 'cases match; no network attempts');
} finally { await detector.dispose(); child.stdin.end(); }
