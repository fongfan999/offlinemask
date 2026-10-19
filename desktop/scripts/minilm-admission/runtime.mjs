import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const work = fileURLToPath(new URL('../../artifacts/minilm-admission/', import.meta.url));
const require = createRequire(import.meta.resolve('@huggingface/transformers'));
const precision = process.argv[3] ?? 'int8'; assert.ok(['int8', 'fp32'].includes(precision));
const backend = process.argv[2]; assert.ok(['cpu', 'wasm'].includes(backend));
const ort = backend === 'cpu' ? require('onnxruntime-node') : require('onnxruntime-web');
if (backend === 'wasm') {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = dirname(require.resolve('onnxruntime-web')) + '/';
}
globalThis.fetch = async () => { throw Error('Network forbidden in runtime admission'); };
const rows = JSON.parse(await readFile(join(work, 'runtime-reference.json')));
const session = await ort.InferenceSession.create(new Uint8Array(await readFile(join(work, precision === 'int8' ? 'pack/model_quantized.onnx' : 'model-fp32.onnx'))), { executionProviders: [backend] });
const results = [];
try {
  for (const row of rows) {
    const inputs = Object.fromEntries(Object.entries(row.inputs).map(([key, value]) => [key, new ort.Tensor('int64', BigInt64Array.from(value.flat(), BigInt), [value.length, value[0].length])]));
    let outputs;
    try {
      outputs = await session.run(inputs);
      const expected = row[precision].flat(2), actual = outputs.logits.data;
      assert.equal(actual.length, expected.length);
      let maxAbs = 0, errors = 0;
      for (let i = 0; i < expected.length; i++) {
        const d = Math.abs(actual[i] - expected[i]); maxAbs = Math.max(d, maxAbs);
        if (!Number.isFinite(actual[i]) || d > 1e-4 + 1e-4 * Math.abs(expected[i])) errors++;
      }
      results.push({ id: row.id, maxAbs, errors, dims: outputs.logits.dims });
    } finally { for (const t of [...Object.values(inputs), ...Object.values(outputs ?? {})]) t.dispose(); }
  }
} finally { await session.release(); }
await writeFile(join(work, `runtime-${backend}${precision === 'fp32' ? '-fp32' : ''}.json`), JSON.stringify({ backend, precision, results, pass: results.every(r => r.errors === 0) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ backend, cases: results.length, maxAbs: Math.max(...results.map(r => r.maxAbs)), failed: results.filter(r => r.errors > 0) }));
