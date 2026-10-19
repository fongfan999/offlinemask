import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verify } from '../model-recheck/common.mjs';
import { root, work, binary } from './client.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async url=>JSON.parse(await readFile(url));
await verify();
for(const name of ['minilm-admission','minilm-repair']) {
  const result=await json(new URL(`docs/evaluations/${name}/results.json`,root));
  for(const [path,expected] of Object.entries(result.sourceHashes))
    assert.equal(hash(await readFile(new URL(path,root))),expected,`Changed historical source: ${path}`);
  for(const [path,expected] of Object.entries(result.rawHashes))
    assert.equal(hash(await readFile(new URL(`artifacts/${name}/${path}`,root))),expected,`Changed historical evidence: ${path}`);
}
const parity=await json(new URL('parity-final.json',work));
const boundaries=await json(new URL('boundaries-final.json',work));
const runtime=await json(new URL('runtime.json',work));
const metadata=await json(new URL('cargo-metadata.json',work));
const dependencies=metadata.resolve.nodes.map(node=>{
  const p=metadata.packages.find(p=>p.id===node.id);
  return {name:p.name,version:p.version,license:p.license,source:p.source,features:node.features};
}).sort((a,b)=>a.name.localeCompare(b.name));
assert.ok(!dependencies.some(d=>['hf-hub','reqwest','ureq'].includes(d.name)));
assert.ok(!dependencies.find(d=>d.name==='tokenizers').features.includes('http'));
const sourceHashes={},rawHashes={};
for(const path of ['client.mjs','evaluate.mjs','boundaries.mjs','runtime.mjs','runtime-reference.py','report.mjs',
  'native/Cargo.toml','native/Cargo.lock','native/src/lib.rs','native/src/main.rs']) {
  const name=`scripts/minilm-native/${path}`;
  sourceHashes[name]=hash(await readFile(new URL(name,root)));
}
for(const path of ['spec.md','masking-boundaries.md']) {
  const name=`docs/evaluations/minilm-native/${path}`;
  sourceHashes[name]=hash(await readFile(new URL(name,root)));
}
for(const path of ['parity.json','parity-final.json','boundaries.json','boundaries-final.json','runtime-reference.json','runtime.json',
  'lib-initial.rs','boundaries-initial.mjs','rust-tests-final.log','tests.log','clippy.log','cargo-metadata.json'])
  rawHashes[path]=hash(await readFile(new URL(path,work)));
const unitLog=await readFile(new URL('rust-tests-final.log',work),'utf8');
const appLog=await readFile(new URL('tests.log',work),'utf8');
assert.match(unitLog,/4 passed; 0 failed/);assert.match(appLog,/tests 118/);assert.match(appLog,/fail 0/);
const result={createdAt:new Date().toISOString(),decision:'Native Rust offset adapter passes bounded diagnostics; keep isolated until packaged Tauri integration and resource qualification.',
  gates:{rawIdsMasksOffsets:parity.failures===0,maskingAndFailureBoundaries:boundaries.pass,
    nativeToWasmInference:runtime.pass,rustUnitTests:true,appTests:true,
    packagedTauri:false,resourceBudgets:false,privacyQuality:false},
  parity,boundaries,runtime,dependencies,
  build:{platform:process.platform,arch:process.arch,rust:'1.98.1',bytes:(await stat(binary)).size,sha256:hash(await readFile(binary)),
    note:'Standalone developer harness, not a shipped dependency or installer measurement.'},
  sourceHashes,rawHashes,
  limits:'Reused synthetic corpus and hand-authored boundary probes; random classification head. Python only creates comparison evidence and is not required by the executable. Rust CLI plus Node-hosted WASM is not packaged Tauri, cancellation, memory, cross-platform or privacy-quality qualification. Timings ran under concurrent developer load. Production and prior evidence fingerprints unchanged.'};
await writeFile(new URL('docs/evaluations/minilm-native/results.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({gates:result.gates,cases:parity.cases,boundaryChecks:boundaries.checks.length,inferenceChecks:runtime.checks.length,binaryBytes:result.build.bytes}));
