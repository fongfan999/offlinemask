// Developer-only CPU provider. Reuses shipping chunking, offsets and final policy.
import { createRecognition } from '../../src/core/detection/recognition.ts';
import { createModelRunner } from '../../src/core/detection/model-runner.ts';
import { attachRecognitionOffsets } from '../../src/core/detection/recognition-source.ts';
export async function loadNativeRecognition(native, encode) {
  const runners = [];
  for (const directory of ['underthesea', 'vietnamese-pii-multilingual']) {
    const classifier = await native.provider(directory);
    const underthesea = directory === 'underthesea';
    runners.push(createModelRunner([{
      source: underthesea ? 'Underthesea · INT8' : 'OpenMed · mSuperClinical · INT8',
      tokenCount: text => classifier.tokenizer.encode(text).length,
      async predict(text) {
        const tokens = await classifier.predict(text);
        return underthesea ? attachRecognitionOffsets(text, tokens,
          classifier.tokenizer.encode(text, { add_special_tokens: false }), await encode(text)) : tokens;
      },
      ...(underthesea ? { align: (_text, tokens) => tokens } : {}),
      dispose: () => classifier.dispose(),
    }]));
  }
  return createRecognition(runners);
}
