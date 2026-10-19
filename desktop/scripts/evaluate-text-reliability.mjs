// Local synthetic evaluation; intentionally excluded from the shipped app.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeText} from '../src/core/text.ts';
import {filterDetections} from '../src/core/detection/options.ts';
import {parseFixture,scoreFixture,summarize,categories,meetsScreeningFloor} from './model-comparison-metrics.mjs';
import {createNativeProvider} from './native-prototype/provider.mjs';
import {createWasmProvider} from './native-prototype/wasm-provider.mjs';
const [phase,runtime,variant]=process.argv.slice(2);
assert.ok(['before','after','revised','final-before','final-after'].includes(phase));assert.ok(['native','wasm'].includes(runtime));assert.ok(['single','combined'].includes(variant));
const root=new URL('../',import.meta.url).pathname;
const out=root+'artifacts/text-reliability-20260914/';
const protocol=JSON.parse(await readFile(root+'docs/evaluations/2026-09-14-text-reliability-protocol.json'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceRoot=['before','final-before'].includes(phase) ? out+'baseline/' : root;
const {loadDetector}=await import(sourceRoot+'src/core/detection/openmed.ts');
const sources={};
for(const file of protocol.implementationFiles){try{sources[file]=hash(await readFile(sourceRoot+file));}catch(e){if(e.code!=='ENOENT')throw e;}}
const files=phase.startsWith('final-') ? ['text-reliability-final.json'] : ['model-comparison.json','model-reliability.json','address-holdout.json','address-validation.json','address-final-check.json','model-decision.json','text-reliability-holdout.json'];
const rows=[];let native,detector;
globalThis.fetch=async()=>{throw Error('Network forbidden');};
try{
 if(runtime==='native')native=await createNativeProvider(root+'public/models');
 const provider=native?.provider??await createWasmProvider(root+'public/models');
 detector=await loadDetector(root+'public/models',root+'public/runtime/',runtime==='native'?'cpu':'wasm',variant==='single'?['vietnamese-pii-multilingual']:undefined,provider);
 for(const file of files){
  const source=await readFile(root+'tests/fixtures/'+file);
  const expected = phase.startsWith('final-') ? JSON.parse(await readFile(root+'docs/evaluations/2026-09-14-text-reliability-final-protocol.json')).fixtureHash : protocol.fixtureHashes[file];
  assert.equal(hash(source),expected);
  const cases=[];
  for(const fixture of JSON.parse(source).map(parseFixture)){
   let detections=[],error=null;const start=performance.now();
   try{detections=await detector.detect(fixture.text,()=>{});}catch{error='Detection failed';}
   const ms=performance.now()-start;
   const spans=analyzeText(fixture.text,'12345678',detections).spans;
   const selected=Object.fromEntries(categories.map(c=>[c,analyzeText(fixture.text,'12345678',filterDetections(detections,[c])).spans]));
   cases.push({...scoreFixture(fixture,spans,selected),error,ms,predictions:spans.map(s=>({...s,value:fixture.text.slice(s.start,s.end)}))});
  }
  const summary=summarize(cases),shortSummary=summarize(cases.filter(c=>c.group!=='long'));
  rows.push({file,summary,shortSummary,screeningPass:meetsScreeningFloor({summary,shortSummary}),cases});
  console.log(phase,runtime,variant,file,'finished');
 }
 await mkdir(out,{recursive:true});await writeFile(out+`${phase}-${runtime}-${variant}.json`,JSON.stringify({phase,runtime,variant,sources,protocol,rows},null,2)+'\n');
}finally{await detector?.dispose();await native?.dispose();}
