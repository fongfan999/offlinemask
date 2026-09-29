import { env, pipeline } from '@huggingface/transformers';
import { createModelRunner } from './model-runner.ts';
import { predictAllTokens } from './token-predictions.ts';
import { applyDetectionPolicy } from './policy.ts';
import { recognitionSource, attachRecognitionOffsets, type EncodeRecognition } from './recognition-source.ts';
import type { DetectionProgress } from './types.ts';

/** Shipping pair. The historical OpenMed evaluator intentionally stays separate. */
export async function loadRecognition(root: string, encode: EncodeRecognition, device: 'wasm' | 'cpu' = 'wasm') {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = root + '/';
  env.useFSCache = false; env.useBrowserCache = false; env.useWasmCache = false;
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = { wasm: '/runtime/ort-wasm-simd-threaded.asyncify.wasm' };
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
  }
  const runners: ReturnType<typeof createModelRunner>[] = [];
  try {
    for (const directory of ['underthesea', 'vietnamese-pii-multilingual']) {
      const classifier = await pipeline('token-classification', directory, {
        device, dtype: 'fp32', subfolder: '', model_file_name: 'model_int8', local_files_only: true,
      });
      const underthesea = directory === 'underthesea';
      runners.push(createModelRunner([{
        source: underthesea ? 'Underthesea · INT8' : 'OpenMed · mSuperClinical · INT8',
        tokenCount: text => classifier.tokenizer.encode(text).length,
        async predict(text) {
          const tokens = await predictAllTokens(classifier, text, true);
          return underthesea ? attachRecognitionOffsets(text, tokens,
            classifier.tokenizer.encode(text, { add_special_tokens: false }), await encode(text)) : tokens;
        },
        ...(underthesea ? { align: (_text, tokens) => tokens } : {}),
        dispose: () => classifier.dispose(),
      }]));
    }
  } catch (error) { await Promise.all(runners.map(runner => runner.dispose())); throw error; }
  return createRecognition(runners);
}

/** Shared orchestration; runtime experiments must preserve source mapping and policy. */
export function createRecognition(runners: ReturnType<typeof createModelRunner>[]) {
  async function inspect(original: string, progress: (p: DetectionProgress) => void = () => {}, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const source = recognitionSource(original);
    const evidence = [];
    // Match the evaluated recipe: per-model merge, contextual-only union, one final source policy.
    for (const [index, runner] of runners.entries()) {
      const found = await runner.inspect(source.text, p => progress({ ...p, completed: index + p.completed / Math.max(1, p.total), total: runners.length }), signal);
      evidence.push(...source.restore(found.modelOnly.filter(d => ['TEN', 'DIA_CHI', 'TO_CHUC'].includes(d.type))));
    }
    signal?.throwIfAborted();
    const result = applyDetectionPolicy(original, evidence);
    for (const span of [...result.modelOnly, ...result.complete]) {
      if (span.source.includes('OpenMed') || span.source.includes('Underthesea')) span.source = 'Gói nhận diện tiếng Việt';
    }
    return result;
  }
  return { inspect, detect: async (text: string, progress?: (p: DetectionProgress) => void, signal?: AbortSignal) => (await inspect(text, progress, signal)).complete,
    dispose: () => Promise.all(runners.map(runner => runner.dispose())) };
}
