import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { openNative, root, work } from './client.mjs';
const require=createRequire(import.meta.resolve('@huggingface/transformers'));
const ort=require('onnxruntime-web');
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=dirname(require.resolve('onnxruntime-web'))+'/';
globalThis.fetch=async()=>{throw Error('Network forbidden during native-path evaluation');};
const rows=JSON.parse(await readFile(new URL('runtime-reference.json',work)));
const session=await ort.InferenceSession.create(new Uint8Array(await readFile(new URL('artifacts/minilm-repair/model-gather.onnx',root))),{executionProviders:['wasm']});
const native=await openNative(), checks=[];
try {
  for(const r of rows) {
    const result=await native.encode(r.text,true); assert.equal(result.error,undefined);
    const e=result.encoding; assert.deepEqual(e.ids,r.ids);
    const inputs={input_ids:e.ids,attention_mask:e.attentionMask,token_type_ids:e.typeIds};
    const tensors=Object.fromEntries(Object.entries(inputs).map(([key,values])=>[key,new ort.Tensor('int64',BigInt64Array.from(values,BigInt),[1,values.length])]));
    let outputs;
    try {
      outputs=await session.run(tensors);
      assert.deepEqual(outputs.logits.dims,[1,e.ids.length,39]);
      const expected=r.logits.flat(2),actual=outputs.logits.data;
      let errors=0,maxAbs=0;
      for(let i=0;i<expected.length;i++) {
        const delta=Math.abs(expected[i]-actual[i]);maxAbs=Math.max(maxAbs,delta);
        if(!Number.isFinite(actual[i]) || delta>1e-4+1e-4*Math.abs(expected[i])) errors++;
      }
      assert.equal(e.maskOffsets.length,e.ids.length);
      for(const span of e.maskOffsets.filter(Boolean)) {
        assert.ok(span[0]>=0 && span[0]<span[1] && span[1]<=r.text.length);
        assert.ok(!/^[\udc00-\udfff]/u.test(r.text.slice(span[0])));
        assert.ok(!/[\ud800-\udbff]$/u.test(r.text.slice(0,span[1])));
      }
      checks.push({id:r.id,start:r.start,tokens:e.ids.length,maxAbs,errors});
    } finally {for(const t of [...Object.values(tensors),...Object.values(outputs??{})])t.dispose();}
  }
} finally {await native.close();await session.release();}
await writeFile(new URL('runtime.json',work),JSON.stringify({checks,pass:checks.every(c=>c.errors===0)},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:checks.length,maxAbs:Math.max(...checks.map(c=>c.maxAbs)),failures:checks.filter(c=>c.errors).length}));
