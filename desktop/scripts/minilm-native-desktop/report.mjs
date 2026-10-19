import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verify } from '../model-recheck/common.mjs';
const root=new URL('../../',import.meta.url),work=new URL('artifacts/minilm-native-desktop/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(new URL(p,work)));
await verify();
const snapshots={'src-tauri/Cargo.toml':'Cargo-before.toml','src-tauri/Cargo.lock':'Cargo-before.lock','src-tauri/src/lib.rs':'lib-before.rs'};
const changes=[];
for(const [file,before] of Object.entries(snapshots))changes.push({file,beforeSha256:hash(await readFile(new URL(before,work))),afterSha256:hash(await readFile(new URL(file,root)))});
for(const name of ['minilm-admission','minilm-repair','minilm-native','minilm-desktop']) {
  const old=JSON.parse(await readFile(new URL(`docs/evaluations/${name}/results.json`,root)));
  for(const [path,expected] of Object.entries(old.sourceHashes)) {
    const bytes=await readFile(name==='minilm-desktop'&&snapshots[path]?new URL(snapshots[path],work):new URL(path,root));
    assert.equal(hash(bytes),expected,`Changed prior source ${path}`);
  }
  for(const [path,expected] of Object.entries(old.rawHashes))assert.equal(hash(await readFile(new URL(`artifacts/${name}/${path}`,root))),expected,`Changed prior evidence ${path}`);
}
const report=await json('report.json'),launch=await json('launch.json');
const byKind=k=>report.metrics.filter(m=>m.kind===k),max=k=>Math.max(...byKind(k).map(m=>m.durationMs));
const warm=byKind('warm').map(m=>m.durationMs).sort((a,b)=>a-b),p95=warm[Math.ceil(warm.length*.95)-1]??null;
const budgets={coldMs:max('cold'),warm2kP95Ms:p95,long50kMs:max('long'),tokenizerCancelAckMs:max('cancel_ack'),tokenizerCancelDrainMs:max('cancel_drain'),activeGraphCancelDrainMs:max('worker_cancel'),heartbeatDelayMs:max('heartbeat'),sampledFootprintBytes:launch.peakFootprintBytes};
const gates={completed:report.completed,behavior:report.metrics.every(m=>m.passed),parity:byKind('parity').length===1&&byKind('parity')[0].passed,
  cold:budgets.coldMs<=5000,warm:p95!==null&&p95<=300,long:budgets.long50kMs<=8000,
  tokenizerCancel:budgets.tokenizerCancelAckMs<=250&&budgets.tokenizerCancelDrainMs<=250&&byKind('cancel_drain').every(m=>m.passed),
  activeGraphCancel:budgets.activeGraphCancelDrainMs<=250&&byKind('worker_cancel').every(m=>m.passed),
  sampledMemory:launch.peakFootprintBytes>0&&launch.peakFootprintBytes<=1073741824,
  networkDeniedLaunch:launch.networkProfile.includes('(deny network*)')&&!launch.timeout,
  preciseMemoryOwnership:false,crossPlatform:false,privacyQuality:false};
const sourceHashes={},rawHashes={};
for(const path of ['src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/src/lib.rs','src-tauri/src/minilm_native_graph.rs','src-tauri/src/minilm_prototype.rs',
  'scripts/minilm-native-desktop/build.mjs','scripts/minilm-native-desktop/run.py','scripts/minilm-native-desktop/report.mjs','scripts/minilm-native-desktop/frontend/main.mjs','scripts/minilm-native-desktop/frontend/index.html','docs/evaluations/minilm-native-desktop/spec.md'])sourceHashes[path]=hash(await readFile(new URL(path,root)));
for(const path of ['report.json','launch.json','build-final.log','clippy.log','native-default.log','frontend-build-final.log','fixtures.json','network-deny.sb','Cargo-before.toml','Cargo-before.lock','lib-before.rs'])rawHashes[path]=hash(await readFile(new URL(path,work)));
const result={createdAt:new Date().toISOString(),gates,budgets,report,intentionalChanges:changes,
  runtime:{name:'ONNX Runtime',version:'1.24.3',source:'Existing onnxruntime-node dependency, darwin/arm64',sha256:'76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f',bytes:35937208,threads:1,telemetry:false},
  memory:{peakRssKiB:launch.peakRssKiB,peakFootprintBytes:launch.peakFootprintBytes,samplePeriodMs:launch.samplePeriodMs,limits:launch.memoryLimit},sourceHashes,rawHashes,
  limits:'One packaged macOS arm64 synthetic run, random head. Native graph execution on blocking pool with per-run termination. Existing enum worker_cancel denotes active native graph termination in this variant. Separate identifier, no installed-pack or normal UI changes. Conservative sampled memory and network-deny main-process launch do not establish exact XPC ownership or packet capture. No training or privacy-quality claim.'};
await writeFile(new URL('docs/evaluations/minilm-native-desktop/results.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({gates,budgets}));
