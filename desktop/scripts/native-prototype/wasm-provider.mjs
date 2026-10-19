// Same pinned ONNX WebGPU/asyncify WASM distribution as production, hosted in
// Node for automated synthetic output comparison. This is not WebKit timing.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AutoTokenizer } from '@huggingface/transformers';
import { tokenPredictions } from '../../src/core/detection/token-predictions.ts';
export async function createWasmProvider(root) {
  const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
  const ort = requireTransformers('onnxruntime-web/webgpu');
  const runtime = dirname(requireTransformers.resolve('onnxruntime-web'));
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = { wasm: join(runtime, 'ort-wasm-simd-threaded.asyncify.wasm') };
  return async directory => {
    const tokenizer = await AutoTokenizer.from_pretrained(directory, { local_files_only: true });
    const config = JSON.parse(await readFile(join(root, directory, 'config.json'), 'utf8'));
    const session = await ort.InferenceSession.create(await readFile(join(root, directory, 'model_int8.onnx')), { executionProviders: ['wasm'], logSeverityLevel: 4 });
    return {
      tokenizer,
      async predict(text) {
        const words = tokenizer.tokenize(text), contentIds = tokenizer.encode(text, { add_special_tokens: false }), ids = tokenizer.encode(text);
        if (words.length !== contentIds.length || ids.length !== contentIds.length + 2 || contentIds.some((id, index) => id !== ids[index + 1])) throw Error('Unsupported token layout');
        const inputs = {};
        let outputs;
        try {
          for (const name of session.inputNames) {
            const data = name === 'input_ids' ? ids : name === 'attention_mask' ? ids.map(() => 1) : name === 'token_type_ids' ? ids.map(() => 0) : null;
            if (!data) throw Error('Unsupported input');
            inputs[name] = new ort.Tensor('int64', BigInt64Array.from(data.map(BigInt)), [1, ids.length]);
          }
          outputs = await session.run(inputs);
          return tokenPredictions(words, outputs.logits.dims, outputs.logits.data, config.id2label, true);
        } finally { for (const tensor of [...Object.values(inputs), ...Object.values(outputs ?? {})]) tensor.dispose(); }
      },
      dispose: () => session.release(),
    };
  };
}
