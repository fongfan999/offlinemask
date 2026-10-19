import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,output,verify,fixtures,readJson} from './common.mjs';
import {loadDiagnostic} from './provider.mjs';
import {normalizedSource} from './normalized-source.mjs';
import {loadCandidate} from '../shared-core/candidates.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {score,productFixture,assertReplay} from '../pretrained-scope/common.mjs';
import {compare} from '../model-recheck/comparison.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
const protocol=await verify(),variant=process.argv[2];
assert.ok(['combined','underthesea'].includes(variant));
for(const file of Object.keys(protocol.beforeFiles))if(file.startsWith('src/core/')){
 const dest=join(output,'reference',file);await mkdir(dirname(dest),{recursive:true});
 await writeFile(dest,protocol.beforeSources[file]??await readFile(join(root,file)));
}
const previous=await import(pathToFileURL(join(output,'reference/src/core/detection/policy.ts')));
const saved=await readJson(join(root,`artifacts/structured-gaps-v1/${variant}.json`));
const all=(await fixtures()).map(productFixture),texts=[...new Set(all.flatMap(f=>[f.text,f.text.normalize('NFC')]))];
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')),variant);
globalThis.fetch=async()=>{throw Error('Network forbidden during contextual diagnosis');};
const detector=variant==='underthesea'?await loadDiagnostic(root,texts):await loadCandidate(root,variant,all.map(f=>f.text));
const cases=[];let rawRuns=0,normalizedRuns=0;
try{
 for(const [i,f] of all.entries()){
  assert.deepEqual([f.id,f.file],[saved.cases[i].id,saved.cases[i].file]);
  const raw=await detector.inspect(f.text);rawRuns++;
  const before=score(f,previous.applyDetectionPolicy(f.text,raw.modelOnly).complete);
  assertReplay(before,saved.cases[i].routes.full.after,f.id);
  const address=score(f,applyDetectionPolicy(f.text,raw.modelOnly).complete);
  const row={id:f.id,file:f.file,corpus:f.corpus,before,address,changes:{address:compare(f,before,address)},modelOnly:raw.modelOnly};
  if(variant==='underthesea'){
   const mapped=normalizedSource(f.text);
   assert.equal(mapped.text,f.text.normalize('NFC'));
   let canonical=raw;
   if(mapped.text!==f.text){canonical=await detector.inspect(mapped.text);normalizedRuns++;}
   const restored=mapped.restore(canonical.modelOnly);
   const nfc=score(f,previous.applyDetectionPolicy(f.text,restored).complete);
   const both=score(f,applyDetectionPolicy(f.text,restored).complete);
   if(mapped.text===f.text)assertReplay(both,address,`NFC identity: ${f.id}`);
   Object.assign(row,{nfc,both,normalizedModelOnly:restored,normalizedInput:mapped.text!==f.text});
   row.changes.nfc=compare(f,before,nfc);row.changes.both=compare(f,before,both);
   if(before.entities.some(e=>!e.selectedFull)||before.falsePositiveChars||row.normalizedInput){
    row.diagnostics={text:f.text,normalizedText:mapped.text,traces:[...detector.traces.values()].filter(t=>f.text.includes(t.text)||mapped.text.includes(t.text))};
   }
  }
  cases.push(row);if((i+1)%60===0)console.log(variant,i+1,'/',all.length);
 }
 await verify();
 await writeFile(join(output,`${variant}.json`),JSON.stringify({variant,protocol,rawRuns,normalizedRuns,cases},null,2)+'\n',{flag:'wx'});
 console.log(variant,'completed',JSON.stringify({rawRuns,normalizedRuns}));
}finally{await detector.dispose();}
