import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeTokenizer } from '../scripts/minilm-desktop/native-client.mjs';

test('desktop adapter drops late results even when native cancellation is too late', async () => {
  let finish, id=0; const calls=[];
  const client=createNativeTokenizer(async (name,args)=>{
    calls.push({name,args});
    if(name==='minilm_cancel')return false;
    return new Promise(resolve=>{finish=resolve;});
  },()=>++id);
  const pending=client.encode('synthetic');
  assert.equal(await client.cancel(),false);
  finish({ids:[0,2]});
  await assert.rejects(pending,{name:'AbortError'});
  const recovered=client.encode('second');finish({ids:[0,2]});
  assert.deepEqual(await recovered,{ids:[0,2]});
  assert.deepEqual(calls.map(c=>c.args.id),[1,1,2]);
});

test('desktop adapter refuses overlap and never surfaces provider input errors', async () => {
  let fail,id=0;
  const client=createNativeTokenizer(()=>new Promise((_,reject)=>{fail=reject;}),()=>++id);
  const pending=client.encode('synthetic secret');
  await assert.rejects(client.encode('other'),/busy/);
  fail(Error('provider includes synthetic secret'));
  await assert.rejects(pending,{message:'Native tokenizer failed'});
  assert.equal(await client.cancel(),false);
});
