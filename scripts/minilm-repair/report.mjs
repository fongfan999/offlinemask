import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { verify } from '../model-recheck/common.mjs';
const root=new URL('../../',import.meta.url), work=new URL('artifacts/minilm-repair/',root);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async path=>JSON.parse(await readFile(new URL(path,work)));
await verify();
const previous=JSON.parse(await readFile(new URL('docs/evaluations/minilm-admission/results.json',root)));
for(const [path,expected] of Object.entries(previous.sourceHashes))
  assert.equal(hash(await readFile(new URL(path,root))),expected,`Historical source changed: ${path}`);
for(const [path,expected] of Object.entries(previous.rawHashes))
  assert.equal(hash(await readFile(new URL(`artifacts/minilm-admission/${path}`,root))),expected,`Historical evidence changed: ${path}`);
const compression=await read('compression.json'), offsets=await read('offsets.json');
const runtimes={cpu:await read('runtime-cpu.json'),wasm:await read('runtime-wasm.json')};
for(const [file,entry] of Object.entries(compression.files)) {
  const bytes=await readFile(new URL(file.endsWith('.onnx')?file:`../minilm-admission/pack/${file}`,work));
  assert.equal(bytes.length,entry.bytes); assert.equal(hash(bytes),entry.sha256);
}
const sourceHashes={},rawHashes={};
for(const file of await readdir(new URL('scripts/minilm-repair/',root))) {
  const path=`scripts/minilm-repair/${file}`;
  sourceHashes[path]=hash(await readFile(new URL(path,root)));
}
for(const path of ['tests/minilm-repair.test.mjs','docs/evaluations/minilm-repair/spec.md'])
  sourceHashes[path]=hash(await readFile(new URL(path,root)));
for(const file of ['normalized.json','runtime-reference.json','compression.json','offsets.json','runtime-cpu.json','runtime-wasm.json','offsets.log','offsets-retry.log','tests.log'])
  rawHashes[file]=hash(await readFile(new URL(file,work)));
const req=createRequire(import.meta.resolve('@huggingface/transformers'));
const summary=offsets.summary;
const gates={size:compression.packBytes<=300000000,nodeCpuParity:runtimes.cpu.pass,nodeHostedWasmParity:runtimes.wasm.pass,
  observedTokenizerParity:summary.idFailures===0 && summary.maskFailures===0,
  nativeLexicalSourceAssociations:summary.nativeIdFailures===0 && summary.associationFailures===0 && summary.gapCases===0,
  originalWindowsWithinBudget:summary.overBudget===0,
  shippingTokenizerOffsets:false,packagedRuntime:false,privacyQuality:false};
const result={createdAt:new Date().toISOString(),decision:'Gather-only compression and NFC/native lexical offsets pass bounded repair probes; shipping offset adapter, packaged qualification and reviewed training data remain required.',
  gates,compression,tokenizer:{summary,rows:offsets.rows.map(({offsets,...row})=>row)},runtimes,
  versions:{node:process.version,icu:process.versions.icu,unicode:process.versions.unicode,
    nodeOrt:req('onnxruntime-node').env.versions,webOrt:req('onnxruntime-web').env.versions},
  previousResultSha256:hash(await readFile(new URL('docs/evaluations/minilm-admission/results.json',root))),sourceHashes,rawHashes,
  limits:'Untrained random classifier. Token positions produced by Python native tokenizer, not shipping JS. Association gate compares original letters, marks and numbers after whole-grapheme expansion; whitespace ownership and nonlexical token positions are not an exact-offset claim. These are reused diagnostic fixtures, not fresh quality data. Node-hosted WASM is not WebKit/packaged qualification. No production changes.'};
await writeFile(new URL('docs/evaluations/minilm-repair/results.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({packBytes:compression.packBytes,gates,tokenizer:summary}));
