import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {root,hash,verify} from '../single-model-decision-v1/common.mjs';
import {verifyExecution} from '../review-first-validation-v1/common.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {loadDiagnostic} from '../contextual-repair-v1/provider.mjs';
import {loadNativeBigMed} from '../native-preprocessing/provider.mjs';
import {loadCandidate} from '../shared-core/candidates.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
await verify();await verifyExecution();
const read=async p=>JSON.parse(await readFile(p));
const protocol=await read('docs/evaluations/quality-first-v1/protocol.json');
for(const[f,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),digest,f);
const variant=process.argv[2];assert.ok(protocol.variants.includes(variant));
await verifyAssets(await read('docs/evaluations/shared-core-protocol-v2.json'),variant);
globalThis.fetch=async()=>{throw Error('Network forbidden during quality-first evaluation');};
const cases=await read('artifacts/quality-first-v1/cases.json'),texts=[...new Set(cases.map(f=>f.text.normalize('NFC')))];
const detector=variant==='underthesea'?await loadDiagnostic(root,texts):variant==='bigmed'?await loadNativeBigMed(root,texts):await loadCandidate(root,variant,texts);
const cache=new Map(),outcomes=[];
try{
 for(const[index,f]of cases.entries()){
  const mapped=normalizedSource(f.text),started=performance.now();let modelOnly=[],error=null;
  try{
   if(!cache.has(mapped.text))cache.set(mapped.text,(await detector.inspect(mapped.text)).modelOnly);
   modelOnly=mapped.restore(cache.get(mapped.text));
  }catch(e){error=String(e?.message??e);}
  const result=score(f,applyDetectionPolicy(f.text,modelOnly).complete);result.error=error;
  outcomes.push({index,id:f.id,corpus:f.corpus,modelOnly,result,durationMs:performance.now()-started});
  if(error||(index+1)%40===0)console.log(variant,index+1,error||'completed');
 }
 await verify();await verifyExecution();
 for(const[f,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),digest,f);
 await writeFile(`artifacts/quality-first-v1/${variant}.json`,JSON.stringify({completedAt:new Date().toISOString(),variant,protocol,
  cache:'Identical normalized text reused; not a latency benchmark',uniqueInputs:cache.size,outcomes},null,2)+'\n',{flag:'wx'});
}finally{await detector.dispose();}
