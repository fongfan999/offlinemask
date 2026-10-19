import { join } from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import { createModelRunner } from '../../src/core/detection/model-runner.ts';
import { predictAllTokens } from '../../src/core/detection/token-predictions.ts';
import { loadDetector } from '../../src/core/detection/openmed.ts';
import { attachReferenceOffsets, prepareReferenceOffsets } from './reference-offsets.mjs';

export const variants = ['small', 'large', 'combined', 'bigmed', 'underthesea', 'underthesea-fp32'];
export const selections = { small: ['vietnamese-pii'], large: ['vietnamese-pii-multilingual'], combined: ['vietnamese-pii', 'vietnamese-pii-multilingual'] };

/** All inference uses Node CPU. The alternatives' tokenizer reference remains
 * developer-only Python; its inference, windows and downstream policy are shared.
 */
export async function loadCandidate(root, variant, texts) {
  if (!variants.includes(variant)) throw Error('Unknown candidate');
  if (selections[variant]) return loadDetector(join(root, 'public/models'), '', 'cpu', selections[variant]);
  const modelRoot = join(root, 'artifacts/alternative-models');
  const isUnderthesea = variant.startsWith('underthesea');
  const directory = isUnderthesea ? 'underthesea' : 'bigmed';
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = modelRoot + '/';
  env.useFSCache = false; env.useBrowserCache = false; env.useWasmCache = false;
  const classifier = await pipeline('token-classification', directory, {
    device: 'cpu', dtype: 'fp32', subfolder: '', local_files_only: true,
    model_file_name: variant === 'underthesea-fp32' ? 'model' : 'model_int8',
  });
  try {
    const references = await prepareReferenceOffsets(classifier.tokenizer,
      join(modelRoot, directory, 'tokenizer.json'), texts);
    return createModelRunner([{
      source: `Evaluation · ${variant}`,
      tokenCount: text => classifier.tokenizer.encode(text).length,
      async predict(text) {
        const tokens = await predictAllTokens(classifier, text, true);
        if (!isUnderthesea) return tokens;
        const labels = { PER: 'PERSON', LOC: 'LOCATION', ORG: 'ORGANIZATION' };
        return tokens.map(token => {
          const [prefix, label] = token.entity.split('-');
          return { ...token, entity: labels[label] ? `${prefix}-${labels[label]}` : 'O' };
        });
      },
      ...(references ? { align: (text, tokens) => {
        const reference = references.get(text);
        if (!reference) throw Error('No reference offsets for this synthetic chunk');
        return attachReferenceOffsets(text, tokens, classifier.tokenizer.encode(text, { add_special_tokens: false }), reference);
      } } : {}),
      dispose: () => classifier.dispose(),
    }]);
  } catch (error) { await classifier.dispose(); throw error; }
}
