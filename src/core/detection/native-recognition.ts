// Opt-in desktop qualification provider. The default app still loads WASM.
import { AutoTokenizer, env } from '@huggingface/transformers';
import { createRecognition } from './recognition.ts';
import { createModelRunner } from './model-runner.ts';
import { tokenPredictions } from './token-predictions.ts';
import { attachRecognitionOffsets, type EncodeRecognition } from './recognition-source.ts';
export type NativeCall = { operation: 'load' } | { operation: 'release'; epoch: number } | { operation: 'run'; epoch: number; model: number; ids: number[] };
export type NativeBridge = (request: NativeCall) => Promise<unknown>;
export async function loadNativeRecognition(root: string, encode: EncodeRecognition, bridge: NativeBridge) {
  env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = root + '/';
  env.useFSCache = false; env.useBrowserCache = false;
  const loaded = await bridge({ operation: 'load' }) as { epoch: number; labels: Record<string, string>[] };
  const runners: ReturnType<typeof createModelRunner>[] = [];
  try {
    for (const [model, directory] of ['underthesea', 'vietnamese-pii-multilingual'].entries()) {
      const tokenizer = await AutoTokenizer.from_pretrained(directory, { local_files_only: true });
      const underthesea = model === 0;
      runners.push(createModelRunner([{
        source: underthesea ? 'Underthesea · INT8' : 'OpenMed · mSuperClinical · INT8',
        tokenCount: text => tokenizer.encode(text).length,
        async predict(text) {
          const words = tokenizer.tokenize(text), content = tokenizer.encode(text, { add_special_tokens: false }), ids = tokenizer.encode(text);
          if (words.length !== content.length || ids.length !== content.length + 2 || content.some((id, i) => id !== ids[i + 1])) throw Error('Unsupported token layout');
          const output = await bridge({ operation: 'run', epoch: loaded.epoch, model, ids }) as { dims: number[]; data: number[] };
          const tokens = tokenPredictions(words, output.dims, output.data, loaded.labels[model]!, true);
          return underthesea ? attachRecognitionOffsets(text, tokens, content, await encode(text)) : tokens;
        },
        ...(underthesea ? { align: (_text, tokens) => tokens } : {}),
        dispose: async () => {},
      }]));
    }
  } catch (error) { await bridge({ operation: 'release', epoch: loaded.epoch }); throw error; }
  const recognition = createRecognition(runners);
  return { ...recognition, dispose: async () => { await bridge({ operation: 'release', epoch: loaded.epoch }); return []; } };
}
