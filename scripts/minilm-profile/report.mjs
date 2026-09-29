import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verify} from '../model-recheck/common.mjs';
const root=new URL('../../',import.meta.url),work=new URL('artifacts/minilm-profile/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(new URL(p,work)));
await verify();
const candidates={
 'src-tauri/src/lib.rs':['artifacts/minilm-profile/lib-before.rs','artifacts/minilm-native-desktop/lib-before.rs','artifacts/minilm-desktop/lib-before.rs'],
 'src-tauri/src/minilm_native_graph.rs':['artifacts/minilm-profile/graph-before.rs'],
 'src-tauri/src/minilm_prototype.rs':['artifacts/minilm-profile/tokenizer-before.rs'],
 'src-tauri/Cargo.toml':['artifacts/minilm-native-desktop/Cargo-before.toml','artifacts/minilm-desktop/Cargo-before.toml'],
 'src-tauri/Cargo.lock':['artifacts/minilm-native-desktop/Cargo-before.lock','artifacts/minilm-desktop/Cargo-before.lock'],
};
const preservedSnapshots=[];
for(const name of ['minilm-admission','minilm-repair','minilm-native','minilm-desktop','minilm-native-desktop']){
 const old=JSON.parse(await readFile(new URL(`docs/evaluations/${name}/results.json`,root)));
 for(const[path,expected]of Object.entries(old.sourceHashes)){
  if(hash(await readFile(new URL(path,root)))===expected)continue;
  let found=false;
  for(const prior of candidates[path]??[])if(hash(await readFile(new URL(prior,root)))===expected){preservedSnapshots.push({evaluation:name,path,snapshot:prior,sha256:expected});found=true;break;}
  assert.ok(found,`Changed frozen source without snapshot: ${path}`);
 }
 for(const[path,expected]of Object.entries(old.rawHashes))assert.equal(hash(await readFile(new URL(`artifacts/${name}/${path}`,root))),expected,`Changed historical output ${path}`);
}
const report=await read('report.json'),launch=await read('launch.json');
const values=(kind,id)=>report.metrics.filter(m=>m.kind===kind&&(id===undefined||m.count===id));
const variants=values('thread_variant').map(({count:id})=>{
 const warm=values('warm',id).map(m=>m.durationMs).sort((a,b)=>a-b);
 const val=kind=>values(kind,id)[0]?.durationMs??null;
 const p95=warm[Math.ceil(warm.length*.95)-1]??null;
 return{id,threads:id===201?2:1,cached:id!==100,warmSamples:warm.length,warmP95Ms:p95,longMs:val('long'),tokenizeMs:val('tokenize'),encodeWallMs:val('encode_wall'),kernelMs:val('kernel'),inferenceWallMs:val('inference_wall'),planningMs:val('planning'),cacheHits:val('cache'),encodeCalls:values('cache',id)[0]?.maxError,heartbeatDelayMs:val('phase_heartbeat'),windowParity:values('window_parity',id).every(m=>m.passed),warmPass:p95!==null&&p95<=300,longPass:val('long')!==null&&val('long')<=8000};
});
const sourceHashes={},rawHashes={};
for(const path of ['src-tauri/src/lib.rs','src-tauri/src/minilm_prototype.rs','src-tauri/src/minilm_native_graph.rs','src-tauri/Cargo.toml','src-tauri/Cargo.lock','scripts/minilm-profile/windows.mjs','scripts/minilm-profile/frontend/main.mjs','scripts/minilm-profile/frontend/index.html','scripts/minilm-profile/build.mjs','scripts/minilm-profile/run.py','scripts/minilm-profile/report.mjs','tests/minilm-profile.test.mjs','docs/evaluations/minilm-profile/spec.md'])sourceHashes[path]=hash(await readFile(new URL(path,root)));
for(const path of ['report.json','launch.json','lib-before.rs','tokenizer-before.rs','graph-before.rs','tests.log','clippy.log','native-default.log','build.log','frontend-build.log','network-deny.sb'])rawHashes[path]=hash(await readFile(new URL(path,work)));
assert.match(await readFile(new URL('tests.log',work),'utf8'),/tests 122/);
assert.match(await readFile(new URL('tests.log',work),'utf8'),/fail 0/);
const result={createdAt:new Date().toISOString(),variants,report,memory:{peakFootprintBytes:launch.peakFootprintBytes,peakRssKiB:launch.peakRssKiB,samplePeriodMs:launch.samplePeriodMs,limits:launch.memoryLimit},
 gates:{completed:report.completed,behavior:report.metrics.every(m=>m.passed),parity:values('parity').length>0&&values('parity').every(m=>m.passed),sampledMemory:launch.peakFootprintBytes<=1073741824,tokenizerActiveCancellation:values('cancel_drain').some(m=>m.passed&&m.durationMs<=250),graphCancellation:values('worker_cancel').some(m=>m.passed&&m.durationMs<=250),normalUiEnabled:false,privacyQuality:false},
 preservedSnapshots,sourceHashes,rawHashes,limits:'Same-process ordered synthetic variants on macOS arm64, no randomization/repeated independent runs. Phase wall residuals include scheduling and IPC; not pure serialization. Network-deny applies main-process launch, not packet capture. Memory conservatively includes new WebKit processes and may miss peaks. Explicitly untrained classifier; no privacy accuracy claim.'};
await writeFile(new URL('docs/evaluations/minilm-profile/results.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({variants,gates:result.gates,memory:result.memory}));
