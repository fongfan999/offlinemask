// Hand-authored source spans, independent of the Python offset oracle.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { openNative, binary, asset, work } from './client.mjs';
const native=await openNative(), checks=[];
async function check(name,run) {
  try {await run();checks.push({name,pass:true});}
  catch(e) {checks.push({name,pass:false,error:e.message});}
}
try {
  for(const text of ['a\u0301','🙂','👩‍👩‍👧‍👦','🇻🇳','Ⅳ','①','Ａ','\u0000',':','—','!','<s>','</s>','<mask>','<unk>','<pad>'])
    await check(`exact-isolated-${JSON.stringify(text)}`,async()=>{
      const r=await native.encode(text,true); assert.equal(r.error,undefined);
      const spans=r.encoding.maskOffsets.filter(Boolean); assert.ok(spans.length>0);
      for(const s of spans) assert.deepEqual(s,[0,text.length]);
    });
  await check('repeated-decomposed-names',async()=>{
    const r=await native.encode('Nguyễn / Nguyễn'); assert.equal(r.error,undefined);
    assert.deepEqual(r.encoding.maskOffsets.filter(s=>s && s[1]-s[0]>=8),[[0,8],[11,19]]);
  });
  await check('unknown-between-ascii',async()=>{
    const r=await native.encode('A\u0000B'); assert.equal(r.error,undefined);
    assert.deepEqual(r.encoding.maskOffsets.filter(Boolean),[[0,1],[1,2],[2,3]]);
  });
  for(const text of ['',' \n\t ','\u0001','\u200b','▁'])
    await check(`normalizer-separator-${JSON.stringify(text)}`,async()=>{
      const r=await native.encode(text); assert.equal(r.error,undefined);
      assert.deepEqual(r.encoding.ids,[0,2]); assert.deepEqual(r.encoding.offsets,[null,null]);
    });
  await check('preserve-crlf-source-distances',async()=>{
    const r=await native.encode('A\r\nB'); assert.equal(r.error,undefined);
    assert.deepEqual(r.encoding.maskOffsets.filter(Boolean),[[0,1],[3,4]]);
  });
  await check('reject-source-over-limit',async()=>{
    assert.equal((await native.encode('🙂'.repeat(25001))).error,'SourceTooLong');
  });
  await check('reject-model-token-overflow-without-truncation',async()=>{
    const text='Nguyễn '.repeat(500);
    assert.equal((await native.encode(text,true)).error,'TokenBudget');
    assert.ok((await native.encode(text,false)).encoding.ids.length>384);
  });
} finally {await native.close();}
// Malformed frames must exit with a generic error and never echo request data.
for(const [name,frame] of [
  ['unknown-field',JSON.stringify({id:0,text:'SYNTHETIC_SECRET',inference:false,extra:true})+'\n'],
  ['invalid-json','SYNTHETIC_SECRET\n'],
  ['missing-newline',JSON.stringify({id:0,text:'SYNTHETIC_SECRET',inference:false})],
  ['oversized-frame','SYNTHETIC_SECRET'.repeat(30000)+'\n'],
]) await check(name,()=>{
  const r=spawnSync(binary,[asset],{input:frame,encoding:'utf8',timeout:30000});
  assert.equal(r.status,1); assert.equal(r.stderr,'Tokenizer request failed\n');
  assert.ok(!r.stdout.includes('SYNTHETIC_SECRET'));
});
await check('reject-tampered-asset',async()=>{
  const corrupted=new Uint8Array(await readFile(asset)); corrupted[100]^=1;
  const path=new URL('tampered-tokenizer-final.json',work);
  await writeFile(path,corrupted,{flag:'wx'});
  const r=spawnSync(binary,[path.pathname],{input:'',encoding:'utf8',timeout:30000});
  assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'Tokenizer request failed\n');
});
await writeFile(new URL('boundaries-final.json',work),JSON.stringify({checks,pass:checks.every(c=>c.pass)},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass)}));
