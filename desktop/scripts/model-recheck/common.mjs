import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verify as verifyCore, fixtures, root, readJson, hash } from '../context-fields/common.mjs';
import { runtimeVersion } from '../native-preprocessing/evidence.mjs';
export { fixtures, root, readJson, hash };
export const variants = ['small', 'large', 'combined', 'bigmed-native', 'underthesea', 'underthesea-fp32'];
export const outputRoot = join(root, 'artifacts/model-recheck');
export const protocolPath = join(root, 'docs/evaluations/model-recheck-v1-protocol.json');
export async function verify() {
  await verifyCore();
  const protocol = await readJson(protocolPath);
  assert.equal(process.version, protocol.node);
  assert.equal(runtimeVersion(), protocol.onnxruntime);
  for (const [file, expected] of Object.entries(protocol.files))
    assert.equal(hash(await readFile(join(root, file))), expected, `Frozen source changed: ${file}`);
  return protocol;
}
export function summarizeTiming(cases) {
  const values = cases.filter((c, i) => i > 0 && c.complete.group !== 'long' && !c.error).map(c => c.durationMs).sort((a, b) => a - b);
  const at = p => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? null;
  return { shortCount: values.length, shortMedianMs: at(.5), shortP95Ms: at(.95),
    longCases: cases.filter(c => c.complete.group === 'long').map(c => ({ id: c.id, corpus: c.corpus, durationMs: c.durationMs, error: c.error })) };
}
