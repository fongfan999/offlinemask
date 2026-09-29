import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verify as verifyPrior,root,hash,readJson,fixtures} from '../contextual-repair-v1/common.mjs';
export {root,hash,readJson,fixtures};
export const output=join(root,'artifacts/single-model-decision-v1');
export const protocolPath=join(root,'docs/evaluations/single-model-decision-v1/protocol.json');
export async function verify(){
 await verifyPrior();const p=await readJson(protocolPath);
 for(const[file,digest]of Object.entries(p.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
 return p;
}
