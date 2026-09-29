import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,hash,readJson,verify,fixtures} from './common.mjs';
import {productFixture} from '../pretrained-scope/common.mjs';
await verify();
const decision=await readJson(join(root,'docs/evaluations/single-model-decision-v1/results.json'));
const all=(await fixtures()).map(productFixture),key=await readJson(join(output,'review-key.json'));
const probes=key.cases.map(c=>{const f=all.find(f=>f.file===c.file&&f.id===c.id);return {...f,expected:c.A};});
await writeFile(join(output,'resource-parity.json'),JSON.stringify(probes,null,2)+'\n',{flag:'wx'});
const files={};
for(const file of ['docs/evaluations/single-model-decision-v1/resources-spec.md','docs/evaluations/single-model-decision-v1/results.json',
 'scripts/single-model-decision-v1/resources.mjs','scripts/single-model-decision-v1/run-resources.py',
 'scripts/single-model-decision-v1/freeze-resources.mjs','artifacts/single-model-decision-v1/resource-parity.json'])files[file]=hash(await readFile(join(root,file)));
await writeFile(join(root,'docs/evaluations/single-model-decision-v1/resources-protocol.json'),JSON.stringify({createdAt:new Date().toISOString(),variant:decision.resourceCandidate,files},null,2)+'\n',{flag:'wx'});
console.log('Resources frozen for',decision.resourceCandidate);
