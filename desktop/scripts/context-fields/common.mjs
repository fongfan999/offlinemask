import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, hash, readJson } from '../shared-core/evidence.mjs';
import { parseFixture } from '../model-comparison-metrics.mjs';
import { parseRows } from '../challenge-core/common.mjs';
export { root, hash, readJson };
export const protocolPath=join(root,'docs/evaluations/context-fields-v1-protocol.json');
export const outputRoot=join(root,'artifacts/context-fields');
export const changedPaths=['src/core/detection/policy.ts','package.json','pnpm-lock.yaml'];
export async function fixtures() {
  const base=await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json'));
  const rows=[];
  for(const file of Object.keys(base.fixtures)) for(const f of await readJson(join(root,'tests/fixtures',file)))
    rows.push({...parseFixture(f),file,corpus:'regression'});
  rows.push(...parseRows(await readJson(join(root,'tests/fixtures/release-challenge-v1.json'))).map(f=>({...f,file:'release-challenge-v1.json',corpus:'challenge'})));
  return rows;
}
export async function verify() {
  const protocol=await readJson(protocolPath);
  for(const [file,expected] of Object.entries(protocol.files)) assert.equal(hash(await readFile(join(root,file))),expected,`Changed frozen file: ${file}`);
  assert.equal(process.version,protocol.node);
  return protocol;
}
