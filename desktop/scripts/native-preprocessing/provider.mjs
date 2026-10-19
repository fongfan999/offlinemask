import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tokenPredictions } from '../../src/core/detection/token-predictions.ts';
import { createModelRunner } from '../../src/core/detection/model-runner.ts';
import { startNativeTokenizer, prepareNativePlans } from './tokenizer.mjs';

export function sourceTokens(text, tokens, offsets) {
  if (tokens.length !== offsets.length) throw Error('Native prediction/offset mismatch');
  return tokens.flatMap((token, i) => {
    const [start, end] = offsets[i];
    if (start === end) {
      if (!/^[▁\s]+$/u.test(token.word)) throw Error('Unlocated native content token');
      return [];
    }
    return [{ ...token, start, end, word: text.slice(start, end) }];
  });
}
export async function predictNative(session, ort, encoding, labels) {
  const inputs = {}; let outputs;
  try {
    for (const name of session.inputNames) {
      if (!['input_ids', 'attention_mask', 'token_type_ids'].includes(name)) throw Error('Unsupported ONNX input');
      inputs[name] = new ort.Tensor('int64', BigInt64Array.from(encoding[name], BigInt), [1, encoding.input_ids.length]);
    }
    outputs = await session.run(inputs);
    return tokenPredictions(encoding.words, outputs.logits.dims, outputs.logits.data, labels, true);
  } finally { for (const tensor of new Set([...Object.values(inputs), ...Object.values(outputs ?? {})])) tensor.dispose(); }
}

export async function loadNativeBigMed(root, texts) {
  const directory = join(root, 'artifacts/alternative-models/bigmed');
  const tokenizer = startNativeTokenizer(process.env.OFFLINEMASK_EVAL_PYTHON, join(directory, 'tokenizer.json'));
  let plans;
  try { plans = await prepareNativePlans(texts, text => tokenizer.encode(text)); }
  finally { await tokenizer.dispose(); }
  const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
  const ort = requireTransformers('onnxruntime-node');
  const labels = JSON.parse(await readFile(join(directory, 'config.json'))).id2label;
  const session = await ort.InferenceSession.create(join(directory, 'model_int8.onnx'), { executionProviders: ['cpu'] });
  const runner = createModelRunner([{
    source: 'Evaluation · bigmed',
    tokenCount: plans.count,
    async predict(text) { return predictNative(session, ort, plans.encoding(text), labels); },
    align(text, tokens) { return sourceTokens(text, tokens, plans.encoding(text).offsets); },
    dispose: () => session.release(),
  }]);
  return { ...runner, cachedQueries: plans.cachedQueries };
}
