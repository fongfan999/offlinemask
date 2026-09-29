import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AutoTokenizer, env } from '@huggingface/transformers';
import { alignSourceTokens } from '../src/core/detection/source-offsets.ts';
import { parseFixture } from './model-comparison-metrics.mjs';

env.allowRemoteModels = false;
env.localModelPath = new URL('../public/models/', import.meta.url).pathname;
globalThis.fetch = async () => { throw new Error('Network forbidden'); };
const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/model-reliability.json', import.meta.url))).map(parseFixture);
const variants = [s=>s, s=>s.normalize('NFD'), s=>s.replace(/ /g,'\u00a0'), s=>`[CLS] ${s} [SEP]`, s=>`😀 ${s}\r\n${s}`];
let checked = 0;
for (const directory of ['vietnamese-pii','vietnamese-pii-multilingual']) {
  const tokenizer = await AutoTokenizer.from_pretrained(directory, {local_files_only:true});
  for (const fixture of fixtures) for (const variant of variants) {
    const text = variant(fixture.text);
    const words = tokenizer.tokenize(text);
    assert.equal(words.length, tokenizer.encode(text,{add_special_tokens:false}).length);
    let aligned;
    try { aligned = alignSourceTokens(text, words.map((word,i)=>({word,index:i+1,entity:'O',score:1}))); }
    catch (error) { console.error('Synthetic alignment case:', directory, fixture.id, variants.indexOf(variant), JSON.stringify(words)); throw error; }
    const covered = new Uint8Array(text.length);
    for (const token of aligned) covered.fill(1,token.start,token.end);
    for(let i=0;i<text.length;i++) if(!/\s/u.test(text[i])) assert.ok(covered[i], `${directory}: ${fixture.id}: uncovered offset ${i}`);
    checked++;
  }
}
console.log(`PASS ${checked} real-tokenizer source mappings; network disabled.`);
