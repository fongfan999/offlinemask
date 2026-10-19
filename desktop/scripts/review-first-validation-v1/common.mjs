import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,hash,readJson,verify as verifyCore} from '../single-model-decision-v1/common.mjs';
export {root,hash,readJson};
export const directory=join(root,'docs/evaluations/review-first-validation-v1');
export const output=join(root,'artifacts/review-first-validation-v1');
export const approvalFiles=['01-examples-01-06.json','02-examples-07-12.json','03-examples-13-18.json','04-examples-19-24.json'];
export async function verifyApproved(){
 await verifyCore();
 const p=await readJson(join(directory,'protocol.json'));
 for(const[file,digest]of Object.entries(p.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
 const original=await readJson(join(directory,'verification.json'));
 for(const[file,digest]of Object.entries(original.hashes))assert.equal(hash(await readFile(join(directory,file))),digest,file);
 const cases=await readJson(join(directory,'cases.json')),approved=[];
 assert.equal(hash(await readFile(join(directory,'cases.json'))),p.casesSha256);
 let previousBytes;
 for(const file of approvalFiles){
  const bytes=await readFile(join(directory,'approvals',file)),receipt=JSON.parse(bytes);
  assert.equal(receipt.protocolSha256,hash(await readFile(join(directory,'protocol.json'))));
  if(previousBytes)assert.equal(receipt.previousApproval.sha256,hash(previousBytes));
  for(const a of receipt.approvals){
   assert.equal(a.status,'APPROVED');const c=cases.find(c=>c.id===a.id);assert.ok(c);
   assert.equal(c.number,a.number);assert.equal(hash(c.text),a.textSha256);assert.equal(hash(JSON.stringify(c.entities)),a.annotationSha256);
   approved.push(a.number);
  }
  previousBytes=bytes;
 }
 assert.deepEqual(approved,Array.from({length:24},(_,i)=>i+1));
 return cases;
}
export async function verifyExecution(){
 const cases=await verifyApproved(),protocol=await readJson(join(directory,'execution-protocol.json'));
 for(const[file,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
 return {cases,protocol};
}
