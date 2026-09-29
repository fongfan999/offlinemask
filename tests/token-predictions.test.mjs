import test from 'node:test';
import assert from 'node:assert/strict';
import { alignTokenOffsets } from 'openmed';
import { tokenPredictions } from '../src/core/detection/token-predictions.ts';

test('unknown-token source pieces retain their prediction and align repeated uppercase letters', () => {
  const words = ['▁Y', 'Ê', 'U', '▁C', 'Ầ', 'U'];
  const logits = new Float32Array((words.length + 2) * 2);
  logits[5 * 2 + 1] = 5; // Unknown ID's actual entity prediction must survive.
  const tokens = tokenPredictions(words, [1, 8, 2], logits, { 0: 'O', 1: 'B-FIRSTNAME' });
  assert.equal(tokens.length, 6);
  assert.equal(tokens[4].entity, 'B-FIRSTNAME');
  assert.ok(tokens[4].score > .99);
  const source = 'YÊU CẦU';
  const aligned = alignTokenOffsets(source, tokens);
  assert.deepEqual(aligned.map(t => source.slice(t.start, t.end)), ['Y', 'Ê', 'U', 'C', 'Ầ', 'U']);
});

test('malformed logits and absent labels fail closed', () => {
  assert.throws(() => tokenPredictions(['A'], [1, 2, 2], new Float32Array(4), { 0: 'O' }));
  assert.throws(() => tokenPredictions(['A'], [1, 3, 2], new Float32Array(6).fill(NaN), { 0: 'O' }));
  assert.throws(() => tokenPredictions(['A'], [1, 3, 1], [0, 1, 0], {}));
});

test('standalone whitespace markers do not shift later token indices', () => {
  const tokens = tokenPredictions(['▁', 'An', '▁', 'Bình'], [1, 6, 1], new Float32Array(6), { 0: 'O' });
  assert.deepEqual(tokens.map(t => t.index), [2, 4]);
  assert.deepEqual(alignTokenOffsets('An Bình', tokens).map(t => [t.start, t.end]), [[0, 2], [3, 7]]);
});

test('chunk tensors are released after success and each failure path', async () => {
  const { predictAllTokens } = await import('../src/core/detection/token-predictions.ts');
  for (const failure of [undefined, 'layout', 'inference', 'prediction']) {
    const disposed = [];
    const input = { data: BigInt64Array.from(failure === 'layout' ? [0n] : [0n, 1n, 2n]), dispose: () => disposed.push('input') };
    const logits = { dims: [1, 3, 1], data: new Float32Array(3).fill(failure === 'prediction' ? NaN : 0), dispose: () => disposed.push('logits') };
    const auxiliary = { dispose: () => disposed.push('auxiliary') };
    const tokenizer = Object.assign(() => ({ input_ids: input, attention_mask: input }), { tokenize: () => ['An'], encode: () => [1] });
    const model = Object.assign(async () => {
      if (failure === 'inference') throw Error('Synthetic inference failure');
      return { logits, auxiliary };
    }, { config: { id2label: { 0: 'O' } } });
    if (failure) await assert.rejects(predictAllTokens({ tokenizer, model }, 'An'));
    else assert.equal((await predictAllTokens({ tokenizer, model }, 'An'))[0].word, 'An');
    assert.deepEqual(disposed, failure === 'layout' || failure === 'inference' ? ['input'] : ['input', 'logits', 'auxiliary']);
  }
});
