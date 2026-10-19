import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verify as verifyPrior} from '../contextual-repair-v1/common.mjs';
import {root,hash,readJson,protocolPath} from './common.mjs';
await verifyPrior();
const context=await readJson(join(root,'docs/evaluations/context-fields-v1-protocol.json'));
const recheck=await readJson(join(root,'docs/evaluations/model-recheck-v1-protocol.json'));
const structured=await readJson(join(root,'docs/evaluations/structured-gaps-v1/protocol.json'));
const repaired=await readJson(join(root,'docs/evaluations/contextual-repair-v1/protocol.json'));
const beforeSources={...structured.beforeSources,...repaired.beforeSources};
const beforeFiles={...context.files,...recheck.files};
for(const[file,digest]of Object.entries(beforeFiles))assert.equal(hash(beforeSources[file]??await readFile(join(root,file))),digest,file);
const files={};
for(const file of ['docs/evaluations/single-model-decision-v1/spec.md',
 ...['common','freeze','evaluate','report','review'].map(n=>`scripts/single-model-decision-v1/${n}.mjs`),
 'artifacts/contextual-repair-v1/underthesea.json','artifacts/pretrained-scope/bigmed-native.json',
 'docs/evaluations/contextual-repair-v1/protocol.json'])files[file]=hash(await readFile(join(root,file)));
await writeFile(protocolPath,JSON.stringify({createdAt:new Date().toISOString(),files,beforeSources,beforeFiles},null,2)+'\n',{flag:'wx'});
console.log('Single-model decision frozen.');
