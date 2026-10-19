import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,readJson,hash,verify} from './common.mjs';
await verify();
const protocol=await readJson(join(root,'docs/evaluations/single-model-decision-v1/resources-protocol.json'));
for(const[file,digest]of Object.entries(protocol.files))assert.equal(hash(await readFile(join(root,file))),digest,file);
const runs=[],evidence={};
for(const id of ['1','2']){
 const files=[`resources-${id}.json`,`resources-${id}-monitor.json`];
 for(const file of files)evidence[file]=hash(await readFile(join(output,file)));
 const r=await readJson(join(output,files[0])),m=await readJson(join(output,files[1]));
 assert.deepEqual(r.protocol,protocol);assert.equal(m.exitCode,0);assert.equal(m.timeout,false);assert.equal(r.parityCases,12);
 assert.ok(m.samples.length>0&&m.samples.every(s=>s.measuredPids>0),'Memory samples missing');
 runs.push({run:id,coldMs:r.coldMs,warmP95Ms:r.warmP95Ms,longMs:r.longMs,peakFootprintBytes:m.peakFootprintBytes,peakRssBytes:m.peakRssBytes,
  parityCases:r.parityCases,hardware:m.hardware,physicalMemory:m.physicalMemory,platform:m.platform,elapsedSeconds:m.elapsedSeconds,
  targets:{...r.timingTargets,memory:m.peakFootprintBytes<=1024**3},network:m.networkProfile});
}
const result={createdAt:new Date().toISOString(),runs,evidence,
 sourceHash:hash(await readFile(new URL(import.meta.url))),
 allDiagnosticTargetsPassed:runs.every(r=>Object.values(r.targets).every(Boolean)),
 limits:'Two developer-process probes with default CPU threads and online native tokenizer/IPC. Not packaged app, cold OS cache, WebKit, cancellation or cross-platform qualification. Quality rejection remains in force.'};
await writeFile(join(root,'docs/evaluations/single-model-decision-v1/resources-results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
