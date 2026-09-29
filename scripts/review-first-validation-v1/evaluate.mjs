import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,readJson,verifyExecution} from './common.mjs';
import {loadDiagnostic} from '../contextual-repair-v1/provider.mjs';
import {loadNativeBigMed} from '../native-preprocessing/provider.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
const {cases,protocol}=await verifyExecution(),variant=process.argv[2];
assert.ok(protocol.variants.includes(variant));
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')),variant);
globalThis.fetch=async()=>{throw Error('Network forbidden during approved validation');};
const texts=cases.map(f=>f.text.normalize('NFC'));
const detector=variant==='underthesea'?await loadDiagnostic(root,texts):await loadNativeBigMed(root,texts);
const results=[];
try{
 for(const f of cases){
  const mapped=normalizedSource(f.text);
  try{
   const ds=await detector.inspect(mapped.text),modelOnly=mapped.restore(ds.modelOnly);
   const result=score(f,applyDetectionPolicy(f.text,modelOnly).complete);
   results.push({id:f.id,number:f.number,scenario:f.scenario,result,modelOnly});
  }catch(error){
   const result=score(f,[]);result.error=String(error?.message??error);
   results.push({id:f.id,number:f.number,scenario:f.scenario,result,modelOnly:[]});
  }
  console.log(variant,'case',f.number,results.at(-1).result.error?'ERROR':'completed');
 }
 await verifyExecution();
 await writeFile(join(output,`${variant}.json`),JSON.stringify({completedAt:new Date().toISOString(),variant,protocol,cases:results},null,2)+'\n',{flag:'wx'});
}finally{await detector.dispose();}
