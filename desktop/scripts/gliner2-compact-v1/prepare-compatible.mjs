// Keep the completed 1.22 diagnostic intact; change only the runtime, not labels,
// thresholds, model, windows or the scoring logic, in a separately frozen run.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {hash} from '../single-model-decision-v1/common.mjs';
const source='docs/evaluations/gliner2-compact-v1';
const protocol=JSON.parse(await readFile(`${source}/protocol.json`));
for(const [f,h]of Object.entries(protocol.files))assert.equal(hash(await readFile(f)),h,f);
const scorer=await readFile('scripts/gliner2-compact-v1/score.mjs','utf8');
// Preserve identical scoring by generating the second entry point mechanically.
const compatible=scorer.replace("evidence='docs/evaluations/gliner2-compact-v1'", "evidence='docs/evaluations/gliner2-compact-v1/compatible'")
 .replaceAll('`${artifact}/raw.jsonl`','`${artifact}/compatible/raw.jsonl`');
await writeFile('scripts/gliner2-compact-v1/score-compatible.mjs',compatible,{flag:'wx'});
await mkdir(`${source}/compatible`,{recursive:true});
protocol.previousProtocolSha256=hash(await readFile(`${source}/protocol.json`));
protocol.frozenAt=new Date().toISOString();
protocol.runtime=protocol.runtime.replace('1.22.1','1.20.1');
protocol.runtimeChange='ONNX Runtime 1.20.1 matches ort rc.9 version family. 1.22.1 run completed predictions but aborted during process shutdown. No inference/model/scoring setting changed.';
for(const f of ['scripts/gliner2-compact-v1/score-compatible.mjs','scripts/gliner2-compact-v1/prepare-compatible.mjs',
 'scripts/gliner2-compact-v1/run.py','artifacts/gliner2-compact-v1/ort120/onnxruntime/capi/libonnxruntime.1.20.1.dylib'])protocol.files[f]=hash(await readFile(f));
await writeFile(`${source}/compatible/protocol.json`,JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
console.log('Frozen runtime-only compatibility rerun; original evidence retained.');
