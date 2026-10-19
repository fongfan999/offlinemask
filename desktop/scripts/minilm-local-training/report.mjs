import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await readFile(new URL(path, root)));
const prefix = 'artifacts/minilm-local-training/';
const protocol = await read(prefix + 'protocol.json');
for (const [path, expected] of Object.entries(protocol.sourceHashes)) {
  assert.equal(hash(await readFile(new URL(path, root))), expected, `Probe source changed: ${path}`);
}
const launch = await read(prefix + 'launch.json');
let report = null;
try { report = await read(prefix + 'report.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const success = !!report?.completed && launch.exitCode === 0 && !launch.timedOut;
if (success) {
  assert.equal(report.optimizerSteps, 0);
  assert.equal(report.parametersUnchanged, true);
  assert.equal(report.passes.length, 6);
  assert.ok(report.passes.every(pass => Number.isFinite(pass.loss) && pass.finiteGradientElements === report.parameters));
}
const sourceHashes = { ...protocol.sourceHashes,
  'scripts/minilm-local-training/report.mjs': hash(await readFile(new URL('scripts/minilm-local-training/report.mjs', root))) };
const rawHashes = {};
for (const file of ['protocol.json', 'launch.json', 'run.log', ...(report ? ['report.json'] : [])]) {
  rawHashes[file] = hash(await readFile(new URL(prefix + file, root)));
}
const result = { createdAt: new Date().toISOString(),
  hardware: { cpu: 'Apple M1 Pro', ramBytes: 17179869184, macOS: '26.6.2', source: 'Local sysctl and sw_vers during this run' },
  success, launch, report,
  memory: report?.memory?.length ? {
    maxObservedDriverBytes: Math.max(...report.memory.map(m => m.driverBytes)),
    maxObservedTensorBytes: Math.max(...report.memory.map(m => m.tensorBytes)),
    processPeakRssBytes: Math.max(...report.memory.map(m => m.processPeakRssBytes)),
    note: 'Phase snapshots, not continuous device peak. RSS/driver/tensor allocations overlap; never sum them.',
  } : null,
  gates: { backwardDiagnostic: success, trainedModelQualified: false, corpusReady: false, cloudNeededEstablished: false },
  sourceHashes, rawHashes,
};
await writeFile(new URL('docs/evaluations/minilm-local-training/results.json', root), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ success, memory: result.memory, passes: report?.passes, failure: report?.failure }));
