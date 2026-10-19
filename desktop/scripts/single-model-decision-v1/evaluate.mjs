import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,output,readJson,fixtures,verify} from './common.mjs';
import {loadNativeBigMed} from '../native-preprocessing/provider.mjs';
import {verifyAssets} from '../shared-core/evidence.mjs';
import {normalizedSource} from '../contextual-repair-v1/normalized-source.mjs';
import {score,productFixture,contextual,assertReplay} from '../pretrained-scope/common.mjs';
import {applyDetectionPolicy} from '../../src/core/detection/policy.ts';
const protocol=await verify(),all=(await fixtures()).map(productFixture),cases=[];
for(const file of Object.keys(protocol.beforeFiles))if(file.startsWith('src/core/')){
 const destination=join(output,'reference',file);await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,protocol.beforeSources[file]??await readFile(join(root,file)));
}
const previous=await import(pathToFileURL(join(output,'reference/src/core/detection/policy.ts')));
const saved=await readJson(join(root,'artifacts/pretrained-scope/bigmed-native.json'));
await verifyAssets(await readJson(join(root,'docs/evaluations/shared-core-protocol-v2.json')),'bigmed');
globalThis.fetch=async()=>{throw Error('Network forbidden during comparison');};
const detector=await loadNativeBigMed(root,[...new Set(all.flatMap(f=>[f.text,f.text.normalize('NFC')]))]);
let canonicalRuns=0;
try{
 for(const[i,f]of all.entries()){
  const raw=await detector.inspect(f.text);
  assert.deepEqual([f.id,f.file],[saved.cases[i].id,saved.cases[i].file]);
  assertReplay(score(f,previous.applyDetectionPolicy(f.text,raw.modelOnly).complete),saved.cases[i].full,f.id);
  const mapped=normalizedSource(f.text);let composed=raw;
  if(mapped.text!==f.text){composed=await detector.inspect(mapped.text);canonicalRuns++;}
  const modelOnly=mapped.restore(composed.modelOnly);
  const canonical=score(f,applyDetectionPolicy(f.text,modelOnly).complete);
  cases.push({id:f.id,file:f.file,corpus:f.corpus,raw:score(f,raw.complete),canonical,
   contextual:score(f,applyDetectionPolicy(f.text,contextual(modelOnly)).complete),modelOnly});
  if((i+1)%60===0)console.log('bigmed',i+1,'/',all.length);
 }
 await verify();
 await writeFile(join(output,'bigmed.json'),JSON.stringify({protocol,rawRuns:all.length,canonicalRuns,cases},null,2)+'\n',{flag:'wx'});
 console.log('bigmed complete',all.length,canonicalRuns);
}finally{await detector.dispose();}
