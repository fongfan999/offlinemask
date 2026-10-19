import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verify } from '../model-recheck/common.mjs';
const root=new URL('../../',import.meta.url),work=new URL('artifacts/minilm-desktop/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(new URL(p,work)));
await verify();
for(const name of ['minilm-admission','minilm-repair','minilm-native']) {
  const historical=JSON.parse(await readFile(new URL(`docs/evaluations/${name}/results.json`,root)));
  for(const [path,expected] of Object.entries(historical.sourceHashes))assert.equal(hash(await readFile(new URL(path,root))),expected,`Historical source changed: ${path}`);
  for(const [path,expected] of Object.entries(historical.rawHashes))assert.equal(hash(await readFile(new URL(`artifacts/${name}/${path}`,root))),expected,`Historical evidence changed: ${path}`);
}
const changes=await json('intentional-changes.json');
for(const c of changes)assert.equal(hash(await readFile(new URL(c.file,root))),c.afterSha256);
const report=await json('report.json'),launch=await json('launch.json');
const byKind=k=>report.metrics.filter(m=>m.kind===k);
const durations=k=>byKind(k).map(m=>m.durationMs);
const max=k=>Math.max(...durations(k));
const warm=durations('warm').sort((a,b)=>a-b);
const p95=warm[Math.ceil(warm.length*.95)-1]??null;
const budget={coldMs:max('cold'),warm2kP95Ms:p95,long50kMs:max('long'),nativeCancelAckMs:max('cancel_ack'),nativeCancelDrainMs:max('cancel_drain'),workerCancelMs:max('worker_cancel'),heartbeatDelayMs:max('heartbeat'),sampledFootprintBytes:launch.peakFootprintBytes};
const gates={completed:report.completed,allBehaviorChecks:report.metrics.every(m=>m.passed),packagedParity:byKind('parity').length===1&&byKind('parity')[0].passed,
  cold:max('cold')<=5000,warm:p95!==null&&p95<=300,long:max('long')<=8000,
  nativeCancel:max('cancel_ack')<=250&&max('cancel_drain')<=250&&byKind('cancel_drain').every(m=>m.passed),workerCancel:max('worker_cancel')<=250,
  sampledMemory:launch.peakFootprintBytes>0&&launch.peakFootprintBytes<=1073741824,
  networkDeniedLaunch:launch.networkProfile.includes('(deny network*)')&&!launch.timeout,
  preciseProcessTreeMemory:false,crossPlatform:false,privacyQuality:false};
const deps=await readFile(new URL('default-dependencies.txt',work),'utf8');
assert.ok(!deps.includes('offlinemask-minilm-tokenizer-prototype')&&!deps.includes('tokenizers v'));
assert.match(await readFile(new URL('tests-final.log',work),'utf8'),/tests 120/);
assert.match(await readFile(new URL('tests-final.log',work),'utf8'),/fail 0/);
const sourceHashes={},rawHashes={};
for(const p of ['src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/src/lib.rs','src-tauri/src/minilm_prototype.rs',
  'scripts/minilm-desktop/build.mjs','scripts/minilm-desktop/run.py','scripts/minilm-desktop/report.mjs','scripts/minilm-desktop/native-client.mjs',
  'scripts/minilm-desktop/frontend/main.mjs','scripts/minilm-desktop/frontend/inference.worker.mjs','scripts/minilm-desktop/frontend/index.html',
  'tests/minilm-desktop.test.mjs','docs/evaluations/minilm-desktop/spec.md'])sourceHashes[p]=hash(await readFile(new URL(p,root)));
for(const p of ['report.json','launch.json','intentional-changes.json','fixtures.json','network-deny.sb','build-final.log','frontend-build-final.log','clippy-feature.log','native-default.log','tests-final.log','production-build.log','default-dependencies.txt'])rawHashes[p]=hash(await readFile(new URL(p,work)));
const result={createdAt:new Date().toISOString(),gates,budget,report,memory:{samplePeriodMs:launch.samplePeriodMs,peakRssKiB:launch.peakRssKiB,peakFootprintBytes:launch.peakFootprintBytes,attribution:launch.memoryLimit},intentionalChanges:changes,sourceHashes,rawHashes,
  limits:'macOS arm64 developer bundle; fixed random classification head and synthetic input. Memory includes newly observed WebKit processes rather than precise process ownership, and sampling may miss peaks. Network-deny profile is applied at main-process launch; WebKit XPC services have separate sandboxing, while CSP and local assets constrain frontend fetches. No final detector or privacy-accuracy claim.'};
await writeFile(new URL('docs/evaluations/minilm-desktop/results.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({gates,budget}));
