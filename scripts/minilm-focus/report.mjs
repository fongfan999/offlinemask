import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await readFile(new URL(path, root)));
const profile = await read('docs/evaluations/minilm-profile/results.json');
for (const [path, expected] of Object.entries(profile.sourceHashes)) {
  assert.equal(hash(await readFile(new URL(path, root))), expected, `Changed profile source: ${path}`);
}
for (const [path, expected] of Object.entries(profile.rawHashes)) {
  assert.equal(hash(await readFile(new URL(`artifacts/minilm-profile/${path}`, root))), expected, `Changed profile evidence: ${path}`);
}
const report = await read('artifacts/minilm-focus/foreground-report.json');
const failedLaunch = await read('artifacts/minilm-focus/launch.json');
const one = kind => {
  const entries = report.metrics.filter(metric => metric.kind === kind);
  assert.equal(entries.length, 1, `Expected one ${kind}`);
  return entries[0];
};
assert.equal(report.completed, true);
assert.ok(report.metrics.every(metric => metric.passed && Number.isFinite(metric.durationMs)));
const warm = report.metrics.filter(metric => metric.kind === 'warm').map(metric => metric.durationMs).sort((a, b) => a - b);
assert.equal(warm.length, 10);
assert.equal(one('parity').count, 20);
assert.equal(one('heartbeat').maxError, 0);
assert.equal(one('phase_heartbeat').maxError, 0);
assert.ok(one('heartbeat').count > 0 && one('phase_heartbeat').count > 0);
assert.equal(failedLaunch.timeout, true);
const sourceHashes = {}, rawHashes = {};
for (const path of [
  'scripts/minilm-focus/build.mjs', 'scripts/minilm-focus/run.py',
  'scripts/minilm-focus/report.mjs', 'scripts/minilm-focus/frontend/main.mjs',
  'scripts/minilm-focus/frontend/index.html', 'docs/evaluations/minilm-focus/spec.md',
  'docs/evaluations/minilm-profile/results.json',
]) sourceHashes[path] = hash(await readFile(new URL(path, root)));
for (const path of ['foreground-report.json', 'launch.json', 'build.log', 'frontend-build.log', 'fixtures.json', 'tauri.conf.json']) {
  rawHashes[path] = hash(await readFile(new URL(`artifacts/minilm-focus/${path}`, root)));
}
const result = {
  createdAt: new Date().toISOString(),
  configuration: { threads: 2, requestLocalCache: true, platform: 'macOS arm64', cpu: 'Apple M1 Pro', ramGiB: 16 },
  launch: { method: 'Native UI launch, then visible Run focused check button', networkDenyProfile: false, memorySampled: false },
  unsuccessfulLaunch: { timeout: failedLaunch.timeout, exitCode: failedLaunch.exitCode, reason: 'UI automation could not attach to the shell-launched window; processing was not started.', qualifiesProcessingMemory: false },
  measurements: {
    coldMs: one('cold').durationMs, warmP95Ms: warm[Math.ceil(warm.length * .95) - 1],
    warmSortedMs: warm, longMs: one('long').durationMs, longWindows: one('long').count,
    timerDelayMs: one('heartbeat').durationMs, timerTicks: one('heartbeat').count,
    frameIntervalMs: one('phase_heartbeat').durationMs, frames: one('phase_heartbeat').count,
    focusVisibilityLosses: one('heartbeat').maxError,
    parityCases: one('parity').count, parityMaxError: one('parity').maxError,
  },
  gates: {
    focusedRunCompleted: true, cpuReferenceParity: one('parity').passed,
    measuredWarmBudget: warm.at(-1) <= 300, measuredLongBudget: one('long').durationMs <= 8000,
    fullMaskingPipelineQualified: false, privacyQualityQualified: false, normalUiEnabled: false,
  },
  report, sourceHashes, rawHashes,
  limits: 'One focused synthetic run; same untrained graph. Timings include native tokenization, planning, IPC and inference, not final entity decoding/shared masking policy. Cold excludes OS launch and page load. No memory sampling or network-deny launch in this successful run; those are separate profile evidence. Earlier one-second background gaps remain unexplained, though consistent with background scheduling. No cross-platform or repeated-use qualification.',
};
await writeFile(new URL('docs/evaluations/minilm-focus/results.json', root), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ measurements: result.measurements, gates: result.gates }));
