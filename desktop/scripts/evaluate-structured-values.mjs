// Local synthetic developer evaluation only; no app import or user-data collection.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeText} from '../src/core/text.ts';
import {filterDetections} from '../src/core/detection/options.ts';
import {parseFixture,scoreFixture,summarize,categories,meetsScreeningFloor} from './model-comparison-metrics.mjs';
import {createNativeProvider} from './native-prototype/provider.mjs';
import {createWasmProvider} from './native-prototype/wasm-provider.mjs';
const [phase,runtime,variant]=process.argv.slice(2);
assert.ok(['before','after'].includes(phase));assert.ok(['native','wasm'].includes(runtime));assert.ok(['single','combined'].includes(variant));
const root=new URL('../',import.meta.url).pathname,out=root+'artifacts/structured-values/';
const protocol=JSON.parse(await readFile(root+'docs/evaluations/2026-09-14-structured-values-protocol.json'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const implementation=phase==='before'?out+'baseline/':root;
for(const [file,expected] of Object.entries(protocol[phase+'Hashes']))assert.equal(hash(await readFile(implementation+file)),expected,file);
const {loadDetector}=await import(implementation+'src/core/detection/openmed.ts');
globalThis.fetch=async()=>{throw Error('Network forbidden');};
let native,detector;const rows=[];
try{
 if(runtime==='native')native=await createNativeProvider(root+'public/models');
 const provider=native?.provider??await createWasmProvider(root+'public/models');
 detector=await loadDetector(root+'public/models',root+'public/runtime/',runtime==='native'?'cpu':'wasm',variant==='single'?['vietnamese-pii-multilingual']:undefined,provider);
 // Previous unchanged-code baseline runs supply the old suites; fresh set runs on both versions.
 const files=phase==='before'?['structured-values-holdout.json']:Object.keys(protocol.fixtureHashes);
 for(const file of files){
  const source=await readFile(root+'tests/fixtures/'+file);assert.equal(hash(source),protocol.fixtureHashes[file]);
  const cases=[];
  for(const f of JSON.parse(source).map(parseFixture)){
   let detections=[],error=null;
   try{detections=await detector.detect(f.text,()=>{});}catch{error='Detection failed';}
   const spans=analyzeText(f.text,'12345678',detections).spans;
   const selected=Object.fromEntries(categories.map(c=>[c,analyzeText(f.text,'12345678',filterDetections(detections,[c])).spans]));
   cases.push({...scoreFixture(f,spans,selected),error,predictions:spans.map(s=>({...s,value:f.text.slice(s.start,s.end)}))});
  }
  const summary=summarize(cases),shortSummary=summarize(cases.filter(c=>c.group!=='long'));
  rows.push({file,summary,screeningPass:meetsScreeningFloor({summary,shortSummary}),cases});
  console.log(phase,runtime,variant,file,'finished');
 }
 await writeFile(out+`${phase}-${runtime}-${variant}.json`,JSON.stringify({phase,runtime,variant,protocol,rows},null,2)+'\n');
}finally{await detector?.dispose();await native?.dispose();}
