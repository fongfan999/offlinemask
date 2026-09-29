// Opt-in native failure/cancellation checks, using only synthetic inputs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNativeProvider, nativeRuntimePath } from './provider.mjs';
import { loadDetector } from '../../src/core/detection/openmed.ts';
const root = new URL('../../public/models', import.meta.url).pathname;
const binary = new URL('../../src-tauri/target/release/offlinemask-native-prototype', import.meta.url).pathname;
const runtime = await nativeRuntimePath();
globalThis.fetch = async () => { throw Error('Network forbidden'); };
async function frames(input, modelRoot = root) {
  const child = spawn(binary, [runtime, modelRoot, '1'], { stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', data => { output += data; });
  const exited = once(child, 'exit');
  child.stdin.end(input);
  const [code] = await exited;
  return { code, output };
}
assert.deepEqual(await frames('{"id":1,"model":999}\n'), { code: 0, output: '{"error":"Native inference failed","id":1}\n' });
assert.equal((await frames('x'.repeat(17000) + '\n')).code, 1);
assert.equal((await frames('{"id":1,"model":0,"path":"elsewhere"}\n')).code, 1);
const empty = await mkdtemp(join(tmpdir(), 'offlinemask-native-fixture-'));
try { assert.match((await frames('{"id":1,"model":0}\n', empty)).output, /Native inference failed/); }
finally { await rm(empty, { recursive: true, force: true }); }
let native = await createNativeProvider(root);
try {
  const pending = loadDetector(root, '', 'cpu', undefined, native.provider);
  const rejected = assert.rejects(pending, /stopped/);
  native.cancel(); await rejected;
} finally { await native.dispose(); }
native = await createNativeProvider(root);
try {
  const detector = await loadDetector(root, '', 'cpu', undefined, native.provider);
  const pending = detector.detect('Khách hàng Trần Minh Bình. '.repeat(200), () => {});
  const rejected = assert.rejects(pending, /stopped/);
  setTimeout(() => native.cancel(), 20);
  await rejected;
} finally { await native.dispose(); }
native = await createNativeProvider(root);
try {
  const detector = await loadDetector(root, '', 'cpu', undefined, native.provider);
  assert.ok((await detector.detect('Khách hàng Trần Minh Bình.', () => {})).some(span => span.type === 'TEN'));
  await detector.dispose();
} finally { await native.dispose(); }
console.log('PASS unknown model, oversized/malformed frame, missing pack, cancel loading, cancel processing, and restart.');
