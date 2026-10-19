import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { openNative, root, work } from './client.mjs';
const rows=JSON.parse(await readFile(new URL('artifacts/minilm-repair/normalized.json',root)));
const reference=JSON.parse(await readFile(new URL('artifacts/minilm-repair/offsets.json',root))).rows;
const native=await openNative();
const checks=[];
try {
  for(let i=0;i<rows.length;i++) {
    const r=rows[i], expected=reference[i];
    assert.equal(r.id,expected.id); assert.equal(r.kind,expected.kind); assert.equal(r.start,expected.start);
    const actual=await native.encode(r.text);
    let error=actual.error ?? null;
    if(!error) {
      try {
        assert.deepEqual(actual.encoding.ids,r.jsIds);
        assert.deepEqual(actual.encoding.attentionMask,r.jsMask);
        assert.deepEqual(actual.encoding.offsets,expected.offsets);
        assert.ok(actual.encoding.typeIds.every(x=>x===0));
        for(let j=0;j<actual.encoding.offsets.length;j++)
          assert.equal(actual.encoding.offsets[j]===null,actual.encoding.specialMask[j]===1);
      } catch(e) {error=e.message;}
    }
    checks.push({id:r.id,kind:r.kind,start:r.start,error,durationMs:actual.durationMs});
  }
} finally {await native.close();}
const result={loadMs:native.ready.loadMs,cases:checks.length,failures:checks.filter(r=>r.error).length,checks};
await writeFile(new URL('parity-final.json',work),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({loadMs:result.loadMs,cases:result.cases,failures:result.failures,failed:checks.filter(r=>r.error).slice(0,3)}));
