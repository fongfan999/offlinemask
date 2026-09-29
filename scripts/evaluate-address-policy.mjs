import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { completeAddressBoundaries } from '../src/core/detection/address-boundaries.ts';
import { analyzeText } from '../src/core/text.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { parseFixture, scoreFixture, summarize, categories } from './model-comparison-metrics.mjs';
const variant=process.argv[2] ?? 'combined';
const variants={combined:['vietnamese-pii','vietnamese-pii-multilingual'],small:['vietnamese-pii'],large:['vietnamese-pii-multilingual']};
if(!Object.hasOwn(variants,variant)&&variant!=='bigmed') throw Error('Unknown evaluation variant');
globalThis.fetch=async()=>{throw Error('Network forbidden during evaluation')};
const root=new URL('../',import.meta.url).pathname;
const detector=variant==='bigmed' ? await (await import('./alternative-detector.mjs')).loadAlternative(root+'artifacts/alternative-models',variant)
 : await loadDetector(root+'public/models','','cpu',variants[variant]);
const reports=[];
try {
for(const file of ['model-comparison.json','model-reliability.json','address-holdout.json','address-validation.json','address-final-check.json']) {
 const source=await readFile(root+'tests/fixtures/'+file,'utf8');
 const before=[],after=[];
 for(const fixture of JSON.parse(source).map(parseFixture)) {
  let error=null,raw=[];
  try {raw=(await detector.detect(fixture.text,()=>{})).filter(d=>d.source!=='Gói nhận diện · địa chỉ');}catch(e){error=e.message;}
  for(const [target,ds] of [[before,raw],[after,completeAddressBoundaries(fixture.text,raw)]]) {
   const spans=analyzeText(fixture.text,'12345678',ds).spans;
   const selected=Object.fromEntries(categories.map(c=>[c,analyzeText(fixture.text,'12345678',filterDetections(ds,[c])).spans]));
   target.push({...scoreFixture(fixture,spans,selected),error});
  }
 }
 reports.push({file,sha256:createHash('sha256').update(source).digest('hex'),before:{summary:summarize(before),cases:before},after:{summary:summarize(after),cases:after}});
 console.log(variant,file,JSON.stringify({before:summarize(before).byCategory.address,after:summarize(after).byCategory.address,extraOrdinary:summarize(after).falsePositiveChars-summarize(before).falsePositiveChars,errors:after.filter(c=>c.error).length}));
}
} finally {await detector.dispose();}
await mkdir(root+'artifacts/address-policy',{recursive:true});
await writeFile(root+`artifacts/address-policy/${variant}.json`,JSON.stringify({variant,reports},null,2)+'\n');
