// Opt-in native failure/cancellation checks, using only synthetic inputs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNativeProvider, nativeRuntimePath } from './provider.mjs';
import { loadNativeRecognition } from './detector.mjs';
import { createInterface } from 'node:readline';
const root = new URL('../../artifacts/recognition-production-v1/models', import.meta.url).pathname;
const binary = new URL('../../src-tauri/target/release/recognition-native-check', import.meta.url).pathname;
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
const tokenizer = spawn(new URL('../../src-tauri/target/release/recognition-tokenizer-check', import.meta.url).pathname, [root], { stdio: ['pipe', 'pipe', 'ignore'] });
const lines = createInterface({ input: tokenizer.stdout });
let pendingEncode;
lines.on('line', line => { const next = pendingEncode; pendingEncode = undefined; next?.resolve(JSON.parse(line)); });
tokenizer.on('exit', () => { pendingEncode?.reject(Error('Tokenizer exited')); pendingEncode = undefined; });
const encode = text => new Promise((resolve, reject) => { assert.ok(!pendingEncode); pendingEncode = { resolve, reject }; tokenizer.stdin.write(JSON.stringify(text) + '\n'); });
let native = await createNativeProvider(root);
try {
  const pending = loadNativeRecognition(native, encode);
  const rejected = assert.rejects(pending, /stopped/);
  native.cancel(); await rejected;
} finally { await native.dispose(); }
native = await createNativeProvider(root);
try {
  const detector = await loadNativeRecognition(native, encode);
  const pending = detector.detect('Khách hàng Trần Minh Bình. '.repeat(200), () => {});
  const rejected = assert.rejects(pending, /stopped/);
  setTimeout(() => native.cancel(), 20);
  await rejected;
} finally { await native.dispose(); }
native = await createNativeProvider(root);
try {
  const detector = await loadNativeRecognition(native, encode);
  assert.ok((await detector.detect('Khách hàng Trần Minh Bình.', () => {})).some(span => span.type === 'TEN'));
  await detector.dispose();
} finally { await native.dispose(); }
tokenizer.stdin.end();
await writeFile('docs/evaluations/recognition-native-v1/lifecycle.json', JSON.stringify({ completedAt: new Date().toISOString(), passed: ['unknown model', 'oversized frame', 'unknown fields', 'missing pack', 'cancel loading', 'cancel processing', 'restart and name recognition'], backend: 'Developer native child; not desktop IPC' }, null, 2) + '\n', { flag: 'wx' });
console.log('PASS unknown model, oversized/malformed frame, missing pack, cancel loading, cancel processing, and restart.');
