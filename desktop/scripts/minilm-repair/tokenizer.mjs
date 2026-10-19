import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { AutoTokenizer, env } from '@huggingface/transformers';
import { normalizeWithMap } from './normalize.mjs';
const old = new URL('../../artifacts/minilm-admission/', import.meta.url);
const work = new URL('../../artifacts/minilm-repair/', import.meta.url);
env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = old.pathname;
env.useFSCache = false; env.useBrowserCache = false;
globalThis.fetch = async () => { throw Error('Network forbidden'); };
const tokenizer = await AutoTokenizer.from_pretrained('pack', { local_files_only: true });
const corpus = JSON.parse(await readFile(new URL('corpus.json', old)));
const windows = JSON.parse(await readFile(new URL('chunks.json', old)));
const rows = [...corpus.map(r => ({ ...r, kind:'full' })), ...windows.map(r=>({ ...r, kind:'window' }))].map(r=>{
  const { normalized, spans } = normalizeWithMap(r.text);
  assert.equal(normalized, r.text.normalize('NFC'));
  const inputs = tokenizer(normalized, { return_tensor:false, padding:false, truncation:false });
  return { id:r.id, kind:r.kind, start:r.start ?? 0, text:r.text, normalized, spans,
    jsIds:inputs.input_ids, jsMask:inputs.attention_mask };
});
await writeFile(new URL('normalized.json',work),JSON.stringify(rows),{flag:'wx'});
console.log(JSON.stringify({full:corpus.length,windows:windows.length}));
