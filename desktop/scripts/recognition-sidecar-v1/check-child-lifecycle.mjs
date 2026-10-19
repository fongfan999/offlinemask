// Synthetic protocol checks; never reads user input. Local pinned assets only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { nativeRuntimePath } from '../recognition-native-v1/provider.mjs';
const runtime = await nativeRuntimePath();
const report = { cases: [], network: 'Run under OS outbound network denial' };
for (const phase of ['loading', 'inference']) {
  const child = spawn(resolve('src-tauri/target/release/recognition-sidecar'), [runtime, resolve('artifacts/recognition-production-v1/models'), '4'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const exited = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  let pending;
  lines.on('line', line => { pending?.(JSON.parse(line)); pending = undefined; });
  const watchdog = setTimeout(() => child.kill(), 20000);
  try {
    if (phase === 'inference') {
      const loaded = new Promise(resolve => { pending = resolve; });
      child.stdin.write(JSON.stringify({ id: 1, model: 1 }) + '\n');
      const ready = await loaded;
      assert.equal(ready.result.ready, true);
      assert.ok(Object.keys(ready.result.labels).length > 0);
    }
    child.stdin.write(JSON.stringify(phase === 'loading' ? { id: 1, model: 1 } : { id: 2, model: 1, input_ids: Array(384).fill(1) }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 50));
    const start = performance.now();
    child.stdin.end(); // Simulates the app disappearing; helper must not linger.
    const [code, signal] = await exited;
    const exitMs = Math.round(performance.now() - start);
    assert.equal(code, 0); assert.equal(signal, null); assert.ok(exitMs < 2000);
    report.cases.push({ phase, exitMs, passed: true });
  } finally { clearTimeout(watchdog); child.kill(); lines.close(); }
}
await writeFile(process.argv[2] ?? 'docs/evaluations/recognition-sidecar-v1/child-lifecycle.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(report);
