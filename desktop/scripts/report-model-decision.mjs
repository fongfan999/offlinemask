import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, totalmem, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseFixture } from './model-comparison-metrics.mjs';
import manifest from './model-manifest.json' with { type: 'json' };
import runtimeManifest from './native-prototype/runtime-manifest.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'artifacts/model-decision/';
const protocol = JSON.parse(await readFile(root + 'docs/evaluations/2026-09-11-model-decision-protocol.json'));
const source = await readFile(root + 'tests/fixtures/model-decision.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(source), protocol.fixtureSha256);
const fixtures = JSON.parse(source).map(parseFixture);
const variants = ['superclinical', 'msuperclinical', 'combined'];
const results = [];
const quality = report => [...report.cases, ...report.lengths].map(({ inferenceMs, ...row }) => row);
const contextCoverage = report => ['name', 'address'].reduce((sum, category) => sum + report.summary.byCategory[category].selectedFull, 0);
const lengthPass = report => report.lengths.every(row => !row.error && row.entities.every(entity => entity.full && entity.selectedFull));
for (const runtime of ['native', 'wasm']) {
  for (const variant of variants) {
    const runs = [];
    for (const round of (runtime === 'native' ? [1, 2] : [1])) {
      const key = `${runtime}-${variant}-${round}`;
      const report = JSON.parse(await readFile(out + key + '.json'));
      assert.equal(report.fixtureSha256, protocol.fixtureSha256);
      assert.deepEqual(report.sourceHashes, protocol.sourceHashes);
      assert.deepEqual(report.cases.map(row => row.id), fixtures.map(row => row.id));
      runs.push({ ...report, memory: JSON.parse(await readFile(out + key + '-memory.json')) });
    }
    if (runs.length === 2) assert.deepEqual(quality(runs[0]), quality(runs[1]), `${variant}: native predictions changed on repeat`);
    const first = runs[0];
    // Sensitivity analysis: the frozen full metric counts punctuation in an entity.
    // Also report lexical-only coverage so punctuation gaps cannot explain a rejection.
    const lexical = Object.fromEntries(['name', 'address', 'email', 'phone', 'banking', 'other'].map(category => [category, { total: 0, full: 0 }]));
    for (const [index, row] of first.cases.entries()) {
      const text = fixtures[index].text;
      for (const entity of row.entities) {
        lexical[entity.category].total++;
        let full = true;
        for (let position = entity.start; position < entity.end; position++) {
          if (/[\p{L}\p{M}\p{N}]/u.test(text[position]) && !row.predictions.some(span => span.start <= position && span.end > position)) full = false;
        }
        if (full) lexical[entity.category].full++;
      }
    }
    results.push({ runtime, variant, downloadBytes: first.downloadBytes, summary: first.summary,
      screeningPass: first.screeningPass, lengthPass: lengthPass(first), lexicalAllOptions: lexical,
      repeatedQualityIdentical: runs.length === 2 ? true : null,
      measurements: runs.map(run => ({ round: run.round, loadMs: run.loadMs, warmupMs: run.warmupMs,
        medianMs: run.medianMs, p95Ms: run.p95Ms, memory: run.memory,
        lengths: run.lengths.map(row => ({ length: Number(row.id), inferenceMs: row.inferenceMs })) })),
      cases: first.cases, lengths: first.lengths });
  }
}
const runtimeResults = runtime => results.filter(row => row.runtime === runtime);
const ensembleEvidence = ['native', 'wasm'].map(runtime => {
  const rows = runtimeResults(runtime), combined = rows.find(row => row.variant === 'combined');
  const singles = rows.filter(row => row.variant !== 'combined');
  const best = [...singles].sort((a, b) => contextCoverage(b) - contextCoverage(a) || a.summary.falsePositiveChars - b.summary.falsePositiveChars)[0];
  const total = combined.summary.byCategory.name.total + combined.summary.byCategory.address.total;
  const gain = (contextCoverage(combined) - contextCoverage(best)) / total;
  return { runtime, betterSingle: best.variant, additionalCompleteNamesAndAddresses: contextCoverage(combined) - contextCoverage(best),
    totalNamesAndAddresses: total, gainPercentagePoints: gain * 100,
    extraOrdinaryCharactersHidden: combined.summary.falsePositiveChars - best.summary.falsePositiveChars,
    marginalGainPass: gain >= .05 && combined.summary.falsePositiveChars <= best.summary.falsePositiveChars };
});
const qualifiedSingles = variants.filter(variant => variant !== 'combined' && results.filter(row => row.variant === variant).every(row => row.screeningPass && row.lengthPass));
const qualifiedEnsemble = results.filter(row => row.variant === 'combined').every(row => row.screeningPass && row.lengthPass)
  && ensembleEvidence.every(row => row.marginalGainPass);
const differences = variants.map(variant => {
  const native = results.find(row => row.variant === variant && row.runtime === 'native');
  const wasm = results.find(row => row.variant === variant && row.runtime === 'wasm');
  return { variant, ids: native.cases.filter((row, index) => JSON.stringify(row.predictions) !== JSON.stringify(wasm.cases[index].predictions)).map(row => row.id) };
});
const report = {
  createdAt: new Date().toISOString(), protocol,
  environment: { platform: process.platform, arch: process.arch, osRelease: release(), node: process.version, cpu: cpus()[0].model, totalMemoryBytes: totalmem() },
  models: manifest.models, runtimeManifest,
  runtimeVersions: { native: '1.24.3', wasm: '1.26.0-dev.20260416-b7804b056c', nativeThreads: 4, wasmThreads: 1 },
  dependencyLockSha256: sha(await readFile(root + 'pnpm-lock.yaml')),
  wasmAssetSha256: sha(await readFile(root + 'public/runtime/ort-wasm-simd-threaded.asyncify.wasm')),
  reportingScriptSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  nativeBinarySha256: sha(await readFile(root + 'src-tauri/target/release/offlinemask-native-prototype')),
  qualifiedSingles, qualifiedEnsemble, decision: qualifiedSingles.length || qualifiedEnsemble ? 'Qualifying candidate requires documented ranking' : 'Reject all three configurations as the final release solution',
  ensembleEvidence, runtimeDifferences: differences, results,
};
await writeFile(root + 'docs/evaluations/2026-09-11-model-decision.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ decision: report.decision, qualifiedSingles, qualifiedEnsemble, ensembleEvidence,
  rows: results.map(row => ({runtime: row.runtime, variant: row.variant, pass: row.screeningPass,
    lengthPass: row.lengthPass, summary: row.summary, lexical: row.lexicalAllOptions,
    timings: row.measurements})), runtimeDifferences: differences }, null, 2));
