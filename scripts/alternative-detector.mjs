import { env, pipeline } from '@huggingface/transformers';
import { alignTokenOffsets, decodeBioTokenSpans } from 'openmed';
import { modelChunks } from '../src/core/detection/chunks.ts';
import { modelDetections, mergeModelDetections } from '../src/core/detection/model-policy.ts';
import { predictAllTokens } from '../src/core/detection/token-predictions.ts';
import { detectBankingIdentifiers } from '../src/core/detection/banking.ts';
import { detectContactDetails } from '../src/core/detection/contact.ts';

/** Developer-only candidate adapter. Never imported by the app or its worker. */
export async function loadAlternative(root, variant) {
  if (!['bigmed', 'underthesea', 'underthesea-fp32'].includes(variant)) throw new Error('Unknown candidate');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = root + '/';
  env.useFSCache = false;
  env.useBrowserCache = false;
  const classifier = await pipeline('token-classification', variant.startsWith('underthesea') ? 'underthesea' : variant, {
    device: 'cpu', dtype: 'fp32', subfolder: '',
    model_file_name: variant === 'underthesea-fp32' ? 'model' : 'model_int8', local_files_only: true,
  });
  return {
    async detect(text) {
      const detections = [];
      for (const chunk of modelChunks(text, value => classifier.tokenizer.encode(value).length)) {
        let tokens = await predictAllTokens(classifier, chunk.text);
        if (variant.startsWith('underthesea')) {
          // Its published general-NER label set is PER/LOC/ORG/MISC.
          // MISC is not a privacy category; do not claim credentials/identifiers from it.
          const mapping = { PER: 'PERSON', LOC: 'LOCATION', ORG: 'ORGANIZATION' };
          tokens = tokens.map(token => {
            const [prefix, label] = token.entity.split('-');
            return { ...token, entity: mapping[label] ? `${prefix}-${mapping[label]}` : 'O' };
          });
        }
        const spans = decodeBioTokenSpans(chunk.text, alignTokenOffsets(chunk.text, tokens), { threshold: 0 });
        detections.push(...modelDetections(chunk.text, spans).map(span => ({ ...span,
          start: span.start + chunk.start, end: span.end + chunk.start, source: `Evaluation · ${variant}` })));
      }
      return [...detectBankingIdentifiers(text), ...detectContactDetails(text), ...mergeModelDetections(detections)];
    },
    dispose: () => classifier.dispose(),
  };
}
