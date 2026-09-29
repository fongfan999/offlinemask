import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,hash,readJson,fixtures,protocolPath} from './common.mjs';
import {runtimeVersion} from '../native-preprocessing/evidence.mjs';
const prior=await readJson(join(root,'docs/evaluations/structured-gaps-v1/protocol.json'));
const {beforeSources}=await readJson(join(output,'before.json'));
const beforeFiles=prior.files;
for(const [file,digest] of Object.entries(beforeFiles))assert.equal(hash(beforeSources[file]??await readFile(join(root,file))),digest,file);
const files={};
const extra=['docs/evaluations/contextual-repair-v1/spec.md','tests/contextual-repair.test.mjs',
  'docs/evaluations/structured-gaps-v1/protocol.json',
  ...['normalized-source','provider','common','freeze','evaluate','report'].map(name=>`scripts/contextual-repair-v1/${name}.mjs`),
  'artifacts/structured-gaps-v1/underthesea.json','artifacts/structured-gaps-v1/combined.json'];
for(const file of new Set([...Object.keys(beforeFiles),...extra]))files[file]=hash(await readFile(join(root,file)));
assert.equal(process.version,prior.node);assert.equal(runtimeVersion(),prior.onnxruntime);
await writeFile(protocolPath,JSON.stringify({createdAt:new Date().toISOString(),node:process.version,onnxruntime:runtimeVersion(),
  cases:(await fixtures()).length,beforeSources,beforeFiles,files},null,2)+'\n',{flag:'wx'});
console.log('Contextual diagnosis frozen before inference.');
