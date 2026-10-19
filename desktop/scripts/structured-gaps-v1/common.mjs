import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, hash, readJson, fixtures } from '../model-recheck/common.mjs';
import { runtimeVersion } from '../native-preprocessing/evidence.mjs';
export { root, hash, readJson, fixtures };
export const output = join(root, 'artifacts/structured-gaps-v1');
export const protocolPath = join(root, 'docs/evaluations/structured-gaps-v1/protocol.json');
export const variants = ['combined', 'underthesea'];
export const routes = ['full', 'contextual', 'rules', 'local'];
export async function verify() {
  const protocol = await readJson(protocolPath);
  assert.equal(process.version, protocol.node);
  assert.equal(runtimeVersion(), protocol.onnxruntime);
  for (const [file, digest] of Object.entries(protocol.files)) assert.equal(hash(await readFile(join(root, file))), digest, file);
  for (const [file, source] of Object.entries(protocol.beforeSources)) assert.equal(hash(source), protocol.beforeFiles[file], file);
  for (const [file, digest] of Object.entries(protocol.beforeFiles)) if (!(file in protocol.beforeSources)) assert.equal(hash(await readFile(join(root, file))), digest, file);
  return protocol;
}
