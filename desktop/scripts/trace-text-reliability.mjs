// Synthetic development fixtures only. Never imported into the application.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { alignSourceTokens } from '../src/core/detection/source-offsets.ts';
import { decodeBioTokenSpans } from 'openmed';
import { modelDetections } from '../src/core/detection/model-policy.ts';
import { analyzeText } from '../src/core/text.ts';
import { parseFixture } from './model-comparison-metrics.mjs';
import { createNativeProvider } from './native-prototype/provider.mjs';
import { createWasmProvider } from './native-prototype/wasm-provider.mjs';
const root = new URL('../', import.meta.url).pathname;
const runtime = process.argv[2];
if (!['native','wasm'].includes(runtime)) throw Error('Specify native or wasm');
globalThis.fetch = async () => { throw Error('Network disabled'); };
const selected = ['mixed-uppercase','address-slash','address-nbsp','negative-empty-labels','negative-workflow','name-hyphen'];
const fixtures = JSON.parse(await readFile(root+'tests/fixtures/model-decision.json')).map(parseFixture).filter(f=>selected.includes(f.id));
const native = runtime==='native' ? await createNativeProvider(root+'public/models') : undefined;
const provider = native?.provider ?? await createWasmProvider(root+'public/models');
let trace;
const wrapped = async directory => {
 const loaded = await provider(directory);
 return {...loaded, async predict(text) {
  const tokens = await loaded.predict(text);
  const aligned = alignSourceTokens(text,tokens);
  const decoded = decodeBioTokenSpans(text,aligned,{threshold:0});
  trace.push({directory,chunk:text,aligned,decoded,policy:modelDetections(text,decoded)});
  return tokens;
 }};
};
let detector;
try {
 detector=await loadDetector(root+'public/models',root+'public/runtime/',runtime==='native'?'cpu':'wasm',undefined,wrapped);
 const results=[];
 for(const fixture of fixtures) {
  trace=[];
  const detections=await detector.detect(fixture.text,()=>{});
  results.push({id:fixture.id,text:fixture.text,trace,detections,analysis:analyzeText(fixture.text,'12345678',detections)});
 }
 await mkdir(root+'artifacts/text-reliability-20260914',{recursive:true});
 await writeFile(root+`artifacts/text-reliability-20260914/trace-${runtime}.json`,JSON.stringify(results,null,2)+'\n');
 console.log(runtime,results.map(r=>({id:r.id,findings:r.analysis.findings.map(f=>({type:f.id,value:f.value}))})));
} finally {await detector?.dispose();await native?.dispose();}
