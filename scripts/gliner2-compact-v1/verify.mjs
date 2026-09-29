import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hash} from '../single-model-decision-v1/common.mjs';
const read=async p=>JSON.parse(await readFile(p));
const artifact='artifacts/gliner2-compact-v1',evidence='docs/evaluations/gliner2-compact-v1/compatible';
const protocol=await read(`${evidence}/protocol.json`),run=await read(`${artifact}/compatible/execution.json`);
assert.equal(run.exitCode,0);assert.equal(run.timeout,false);assert.equal(run.networkConnectionProbeDenied,true);
assert.equal(run.networkProfile,'(version 1) (allow default) (deny network*)');
assert.equal(hash(await readFile(run.runtimeLibrary)),run.runtimeLibrarySha256);
assert.equal(execFileSync('git',['-C',`${artifact}/upstream`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),protocol.upstreamRevision);
assert.equal(execFileSync('git',['-C',`${artifact}/upstream`,'diff','--exit-code'],{encoding:'utf8'}),'');
assert.equal(hash(await readFile(`${artifact}/upstream/crates/pii-engineer-core/examples/offlinemask_eval.rs`)),hash(await readFile('scripts/gliner2-compact-v1/runner.rs')));
for(const [file,data]of Object.entries(protocol.assets.files))assert.equal(hash(await readFile(`${artifact}/model/${file}`)),data.sha256,file);
assert.equal(hash(await readFile(`${artifact}/model/gliner_config.json`)),protocol.assets.files['config.json'].sha256);
const oldReceipt=await read('docs/evaluations/quality-first-v1/verification.json');
assert.equal(hash(await readFile('docs/evaluations/quality-first-v1/results.json')),oldReceipt.resultsSha256);
const previous=await read('docs/evaluations/quality-first-v1/results.json');
for(const v of ['underthesea','bigmed','large']){
 const file=`artifacts/quality-first-v1/${v}.json`;
 assert.equal(hash(await readFile(file)),previous.rawHashes[v]??previous.rawHashes[file]);
}
const inputs=await read(`${artifact}/inputs.json`);
const raw=(await readFile(`${artifact}/compatible/raw.jsonl`,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
assert.equal(raw.length,398);
let windowCount=0;
for(const [index,row]of raw.entries()){
 assert.equal(row.index,index);assert.equal(row.error,null);
 const text=inputs[index].text,bytes=Buffer.from(text),covered=new Uint8Array(bytes.length);
 for(const w of row.windows){
  assert.ok(w.tokens>0&&w.tokens<=384);assert.ok(w.byteStart>=0&&w.byteEnd>w.byteStart&&w.byteEnd<=bytes.length);
  const part=bytes.subarray(w.byteStart,w.byteEnd);assert.deepEqual(Buffer.from(part.toString('utf8')),part);
  covered.fill(1,w.byteStart,w.byteEnd);windowCount++;
 }
 let offset=0;for(const ch of text){const n=Buffer.byteLength(ch);if(!/\s/u.test(ch))for(let p=offset;p<offset+n;p++)assert.equal(covered[p],1,`Unprocessed character: ${index}`);offset+=n;}
 for(const e of row.entities){assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end<=text.length&&e.end>e.start);assert.equal(text.slice(e.start,e.end),e.text);}
}
// JSON omits optional undefined fields (recordId/representation). Compare the
// serialized representation rather than treating those absent fields as a drift.
// Preserve frozen scoring sources: the sole replay adjustment is this assertion.
for(const source of ['score.mjs','score-compatible.mjs']){
 const code=await readFile(`scripts/gliner2-compact-v1/${source}`,'utf8');
 const before='assert.deepEqual(results,saved)';
 assert.equal(code.split(before).length,2);
 const replay='scripts/gliner2-compact-v1/.score-replay.mjs';
 await writeFile(replay,code.replace(before,'assert.deepEqual(JSON.parse(JSON.stringify(results)),saved)'),{flag:'wx'});
 try{execFileSync(process.execPath,['--experimental-strip-types',replay,'--verify'],{stdio:'inherit'});}
 finally{await unlink(replay);}
}
const originalRun=await read(`${artifact}/execution.json`);
assert.equal(originalRun.exitCode,-6);assert.equal(originalRun.timeout,false);
const originalRaw=(await readFile(`${artifact}/raw.jsonl`,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
assert.equal(originalRaw.length,398);
const originalResults=await read('docs/evaluations/gliner2-compact-v1/results.json');
const result=await read(`${evidence}/results.json`);
assert.deepEqual(result.recipes,originalResults.recipes,'Runtime-only rerun changed scored outcomes');
// The compatible scorer must remain a mechanical path substitution, not a tuning fork.
const originalScorer=await readFile('scripts/gliner2-compact-v1/score.mjs','utf8');
assert.equal(await readFile('scripts/gliner2-compact-v1/score-compatible.mjs','utf8'),originalScorer
 .replace("evidence='docs/evaluations/gliner2-compact-v1'", "evidence='docs/evaluations/gliner2-compact-v1/compatible'")
 .replaceAll('`${artifact}/raw.jsonl`','`${artifact}/compatible/raw.jsonl`'));
const receipt={verifiedAt:new Date().toISOString(),executions:398,rankedCases:386,windowCount,errors:0,
 runtimeRepair:{originalExitCode:-6,compatibleExitCode:0,scoredOutcomes:'Identical across 1.22.1 and 1.20.1; initial failed shutdown retained as diagnostic evidence'},
 priorAnnotationsAndApprovals:'Unchanged',organizationAnnotations:protocol.organizationAnnotations.length,
 networkConnections:'Denied by macOS sandbox; connection probe rejected',
 originalTextSpans:'All raw UTF-16 spans and complete non-whitespace window coverage verified',
 scores:'Exact replay of frozen policy and all six options, retained scope and full scope for four recipes',
 replayNormalization:'JSON round-trip before equality to omit optional undefined fields, matching saved JSON; no score or prediction adjustment',
 releaseGate:['regression','challenge','approved24'].every(c=>result.recipes.gliner2.stages[c].retained.screeningPass)?'SCREEN_PASSED_NOT_PACKAGED_QUALIFIED':'NOT_PASSED',
 files:Object.fromEntries(await Promise.all([`${evidence}/protocol.json`,`${evidence}/results.json`,`${artifact}/compatible/raw.jsonl`,`${artifact}/compatible/execution.json`,
 `${artifact}/raw.jsonl`,`${artifact}/execution.json`,'docs/evaluations/gliner2-compact-v1/results.json',
 'scripts/gliner2-compact-v1/run.py','scripts/gliner2-compact-v1/verify.mjs'].map(async f=>[f,hash(await readFile(f))])))};
await writeFile(`${evidence}/verification.json`,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(receipt);
