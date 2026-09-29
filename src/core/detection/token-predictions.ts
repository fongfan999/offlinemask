import type { Tensor, TokenClassificationPipeline } from '@huggingface/transformers';
import type { RawTokenClassificationEntity } from 'openmed';

/** Preserve tokenizer pieces, including unknown input, instead of decoding one ID at a time. */
export async function predictAllTokens(classifier: TokenClassificationPipeline, text: string, retainSeparators = false) {
  const words = classifier.tokenizer.tokenize(text);
  const ids = classifier.tokenizer.encode(text, { add_special_tokens: false });
  const inputs = classifier.tokenizer(text, { padding: false, truncation: false });
  let outputs: Record<string, Tensor> | undefined;
  try {
    const inputIds = inputs.input_ids.data;
    // The pinned encoders use exactly one leading CLS and one trailing SEP token.
    // Validate the layout rather than guessing indices if a future tokenizer differs.
    if (words.length !== ids.length || inputIds.length !== ids.length + 2
      || ids.some((id, i) => BigInt(id) !== inputIds[i + 1]))
      throw new Error('Unsupported token layout');
    outputs = await classifier.model(inputs);
    const logits = outputs!.logits!;
    const config = classifier.model.config as typeof classifier.model.config & { id2label?: Record<string, string> };
    return tokenPredictions(words, logits.dims, logits.data as Float32Array, config.id2label ?? {}, retainSeparators);
  } finally {
    // Predictions are plain values; no tensor needs to outlive this chunk.
    // Release on validation/inference errors as well as the success path.
    for (const tensor of new Set([...Object.values(inputs), ...Object.values(outputs ?? {})])) tensor.dispose();
  }
}

export function tokenPredictions(words: readonly string[], dimensions: readonly number[], data: ArrayLike<number>,
  labels: Record<string, string>, retainSeparators = false): RawTokenClassificationEntity[] {
  const [batch, sequence, classes] = dimensions;
  if (batch !== 1 || sequence !== words.length + 2 || !classes || data.length !== sequence * classes)
    throw new Error('Invalid token prediction shape');
  return words.map((word, i) => {
    const offset = (i + 1) * classes;
    let best = 0;
    for (let label = 0; label < classes; label++) {
      if (!Number.isFinite(data[offset + label])) throw new Error('Invalid token score');
      if (data[offset + label]! > data[offset + best]!) best = label;
    }
    const entity = labels[best];
    if (!entity) throw new Error('Missing token label');
    const max = data[offset + best]!;
    let denominator = 0;
    for (let label = 0; label < classes; label++) denominator += Math.exp(data[offset + label]! - max);
    return { word, index: i + 1, entity, score: 1 / denominator };
  // Standalone SentencePiece whitespace markers contain no source letters.
  // Keep original indices so removing these separators cannot renumber predictions.
  }).filter(token => retainSeparators || !/^[▁Ġ\s]+$/u.test(token.word));
}
