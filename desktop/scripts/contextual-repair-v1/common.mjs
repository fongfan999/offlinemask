import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,hash,readJson,fixtures} from '../structured-gaps-v1/common.mjs';
import {runtimeVersion} from '../native-preprocessing/evidence.mjs';
export {root,hash,readJson,fixtures};
export const output=join(root,'artifacts/contextual-repair-v1');
export const protocolPath=join(root,'docs/evaluations/contextual-repair-v1/protocol.json');
export async function verify(){
  const p=await readJson(protocolPath);
  assert.equal(process.version,p.node);assert.equal(runtimeVersion(),p.onnxruntime);
  for(const [file,digest] of Object.entries(p.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
  for(const [file,digest] of Object.entries(p.beforeFiles))assert.equal(hash(p.beforeSources[file]??await readFile(join(root,file))),digest,`Before: ${file}`);
  return p;
}
