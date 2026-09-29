import { env, pipeline, type TokenClassificationPipeline } from "@huggingface/transformers";
import type { RawTokenClassificationEntity } from "openmed";
import manifest from "../../../scripts/model-manifest.json" with { type: "json" };
import { predictAllTokens } from './token-predictions.ts';

import { createModelRunner } from './model-runner.ts';

export interface TokenDetector {
  tokenizer: Pick<TokenClassificationPipeline['tokenizer'], 'encode'>;
  predict(text: string): Promise<RawTokenClassificationEntity[]>;
  dispose(): Promise<unknown>;
}
export type InferenceProvider = (directory: string) => Promise<TokenDetector>;

export async function loadDetector(modelRoot = "/models", wasmPath = "/runtime/", device: "wasm" | "cpu" = "wasm",
  modelDirectories: readonly string[] = manifest.models.map(model => model.directory), provider?: InferenceProvider) {
  // Evaluation may select pinned checkpoints; the app uses the full manifest by default.
  if (!modelDirectories.length || new Set(modelDirectories).size !== modelDirectories.length
    || modelDirectories.some(directory => !manifest.models.some(model => model.directory === directory)))
    throw new Error("Invalid pinned model selection");
  const models = manifest.models.filter(model => modelDirectories.includes(model.directory));
  // All resources must already be installed locally. Never fall back to a Hub or CDN.
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = modelRoot + "/";
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useWasmCache = false;
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = {
      // Use the JS loader embedded by Transformers.js with its matching WASM.
      wasm: `${wasmPath}ort-wasm-simd-threaded.asyncify.wasm`,
    };
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
  }
  const classifiers: TokenDetector[] = [];
  try {
    for (const model of models) {
      if (provider) {
        classifiers.push(await provider(model.directory));
        continue;
      }
      const classifier = await pipeline("token-classification", model.directory, {
        device, dtype: "fp32", // The published INT8 graphs have explicit filenames.
        subfolder: "", model_file_name: "model_int8", local_files_only: true,
      });
      classifiers.push({ tokenizer: classifier.tokenizer,
        predict: (text) => predictAllTokens(classifier, text, true),
        dispose: () => classifier.dispose(),
      });
    }
  } catch (error) {
    await Promise.all(classifiers.map((classifier) => classifier.dispose()));
    throw error;
  }
  return createModelRunner(classifiers.map((classifier, index) => ({
    source: `OpenMed · ${models[index]!.directory === "vietnamese-pii" ? "SuperClinical" : "mSuperClinical"} · INT8`,
    tokenCount: (text: string) => classifier.tokenizer.encode(text).length,
    predict: (text: string) => classifier.predict(text),
    dispose: () => classifier.dispose(),
  })));
}
