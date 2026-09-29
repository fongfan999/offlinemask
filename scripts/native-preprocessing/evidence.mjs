import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { root, hash, readJson, verifyProtocol } from '../shared-core/evidence.mjs';
export { root, hash, readJson };
export const protocolPath = join(root, 'docs/evaluations/native-preprocessing-protocol.json');
export const outputRoot = join(root, 'artifacts/native-preprocessing');
export const runtimeVersion = () => createRequire(import.meta.resolve('@huggingface/transformers'))('onnxruntime-node/package.json').version;
export async function verify() {
  const base = await verifyProtocol();
  const protocol = await readJson(protocolPath);
  assert.equal(hash(await readFile(join(root, 'docs/evaluations/shared-core-protocol-v2.json'))), protocol.baseProtocolSha256);
  assert.equal(hash(await readFile(join(root, 'docs/evaluations/shared-core-comparison.json'))), protocol.baseResultSha256);
  for (const [file, digest] of Object.entries(protocol.sources)) assert.equal(hash(await readFile(join(root, file))), digest, file);
  assert.equal(runtimeVersion(), protocol.runtimeVersion);
  return { base, protocol };
}
