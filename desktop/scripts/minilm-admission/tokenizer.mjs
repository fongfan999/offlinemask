import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AutoTokenizer, env } from '@huggingface/transformers';
import { modelChunkIterator } from '../../src/core/detection/chunks.ts';
import { alignSourceTokens } from '../../src/core/detection/source-offsets.ts';
const work = fileURLToPath(new URL('../../artifacts/minilm-admission/', import.meta.url));
env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = work + '/';
env.useFSCache = false; env.useBrowserCache = false;
globalThis.fetch = async () => { throw Error('Network forbidden during tokenizer admission'); };
const tokenizer = await AutoTokenizer.from_pretrained('pack', { local_files_only: true });
const reference = JSON.parse(await readFile(join(work, 'tokenizer-reference.json')));
const results = [], chunks = [];
for (const r of reference.rows) {
  const ids = tokenizer.encode(r.text), inputs = tokenizer(r.text, { return_tensor: false, padding: false, truncation: false });
  let idMatch = true, maskMatch = true, alignmentError = null;
  try { assert.deepEqual(ids, r.ids); } catch { idMatch = false; }
  try { assert.deepEqual(inputs.attention_mask, r.attentionMask); } catch { maskMatch = false; }
  try {
    const tokens = tokenizer.tokenize(r.text).map((word,i) => ({ word, index:i+1, entity:'O', score:1 }));
    alignSourceTokens(r.text, tokens);
  } catch (e) { alignmentError = e.message; }
  const windows = [...modelChunkIterator(r.text, t => tokenizer.encode(t).length)];
  let end = 0;
  for (const w of windows) {
    assert.ok(w.start <= end && w.start + w.text.length > end, 'Window coverage gap');
    assert.ok(tokenizer.encode(w.text).length <= 384);
    assert.equal(r.text.slice(w.start, w.start + w.text.length), w.text);
    end = w.start + w.text.length;
    chunks.push({ id:r.id, start:w.start, text:w.text, ids:tokenizer.encode(w.text) });
  }
  assert.equal(end,r.text.length);
  // Reference offsets are evidence only. Never use them to align different JS IDs.
  const lexicalGaps = [];
  const covered = new Uint8Array(r.text.length);
  for (let i=0;i<r.offsets.length;i++) { const [a,b]=r.offsets[i]; if(!r.specialMask[i]) covered.fill(1,a,b); }
  for (let p=0; p<r.text.length; p++) if (/[\p{L}\p{M}\p{N}]/u.test(r.text[p]) && !covered[p]) lexicalGaps.push(p);
  results.push({ id:r.id, idMatch, maskMatch, alignmentError, windows:windows.length, nativeLexicalGaps:lexicalGaps });
}
await writeFile(join(work, 'chunks.json'), JSON.stringify(chunks));
const out = { slowFastIdMismatches:reference.slowFastIdMismatches, rows:results,
  summary:{ cases:results.length, chunks:chunks.length, jsIdMismatches:results.filter(r=>!r.idMatch).length,
    attentionMaskMismatches:results.filter(r=>!r.maskMatch).length, currentAlignerFailures:results.filter(r=>r.alignmentError).length,
    referenceOffsetGapCases:results.filter(r=>r.nativeLexicalGaps.length).length } };
await writeFile(join(work, 'tokenizer-evidence.json'), JSON.stringify(out,null,2)+'\n', { flag:'wx' });
console.log(JSON.stringify(out.summary));
