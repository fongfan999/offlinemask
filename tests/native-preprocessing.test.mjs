import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNativePlans, validateEncoding, startNativeTokenizer } from '../scripts/native-preprocessing/tokenizer.mjs';
import { predictNative, sourceTokens } from '../scripts/native-preprocessing/provider.mjs';
import { modelChunks } from '../src/core/detection/chunks.ts';

function encoding(text) {
  let cursor = 0;
  const words = [...text], content_ids = words.map((_, i) => i + 10);
  return { input_ids: [0, ...content_ids, 2], content_ids, words,
    offsets: words.map(word => { const start = cursor; cursor += word.length; return [start, cursor]; }),
    attention_mask: Array(words.length + 2).fill(1), token_type_ids: Array(words.length + 2).fill(0),
    special_tokens_mask: [1, ...words.map(() => 0), 1] };
}
test('native count preparation follows the shared planner and preserves grapheme-bounded source chunks', async () => {
  const text = '😀 An\u0301 và Bình. '.repeat(100);
  let queries = 0;
  const plans = await prepareNativePlans([text], async value => { queries++; assert.ok(value.isWellFormed()); return encoding(value); });
  const actual = modelChunks(text, plans.count), expected = modelChunks(text, value => [...value.toWellFormed()].length + 2);
  assert.deepEqual(actual, expected);
  assert.ok(queries > actual.length);
  assert.ok(actual.length > 1);
  for (const chunk of actual) {
    assert.ok(chunk.text.isWellFormed());
    assert.equal(text.slice(chunk.start, chunk.start + chunk.text.length), chunk.text);
    assert.deepEqual(plans.encoding(chunk.text), encoding(chunk.text));
    assert.ok(plans.encoding(chunk.text).input_ids.length <= 384);
  }
  assert.throws(() => plans.encoding('unprepared'));
});

test('native encodings reject special-layout, tensor-mask and source-offset corruption', () => {
  const text = 'An';
  for (const change of [e => e.input_ids[1]++, e => e.special_tokens_mask[1] = 1,
    e => e.attention_mask.pop(), e => e.token_type_ids[0] = 1, e => e.offsets[1][1] = 999]) {
    const e = encoding(text); change(e); assert.throws(() => validateEncoding(text, e));
  }
});

test('native IDs drive the actual inference tensors and all tensors are released', async () => {
  for (const fail of [false, true]) {
    const tensors = [];
    class Tensor { constructor(type, data, dims) { Object.assign(this, { type, data, dims, released: false }); tensors.push(this); }
      dispose() { this.released = true; } }
    const e = encoding('An');
    const session = { inputNames: ['input_ids', 'attention_mask'], async run(inputs) {
      assert.deepEqual([...inputs.input_ids.data], e.input_ids.map(BigInt));
      assert.deepEqual(inputs.input_ids.dims, [1, 4]);
      if (fail) throw Error('Synthetic inference failure');
      return { logits: new Tensor('float32', new Float32Array([0, 1, 0, 1, 0, 1, 1, 0]), [1, 4, 2]) };
    } };
    if (fail) await assert.rejects(predictNative(session, { Tensor }, e, { 0: 'O', 1: 'B-PERSON' }));
    else assert.equal((await predictNative(session, { Tensor }, e, { 0: 'O', 1: 'B-PERSON' })).length, 2);
    assert.ok(tensors.every(t => t.released));
  }
});

test('native unknown tokens retain original Unicode spans; unlocated content is rejected', () => {
  const tokens = [{ index: 1, word: '[UNK]', entity: 'O', score: 1 }, { index: 2, word: '▁', entity: 'O', score: 1 }];
  assert.equal(sourceTokens('😀', tokens, [[0, 2], [2, 2]])[0].word, '😀');
  assert.throws(() => sourceTokens('😀', tokens, [[0, 0], [2, 2]]));
  assert.throws(() => sourceTokens('😀', tokens, [[0, 2]]));
});

test('missing native tokenizer process rejects without leaving pending work', async () => {
  const tokenizer = startNativeTokenizer('/nonexistent-offlinemask-interpreter', '/unused/tokenizer.json');
  await assert.rejects(tokenizer.encode('Synthetic text'));
  await tokenizer.dispose();
  await assert.rejects(tokenizer.encode('Again'));
});
