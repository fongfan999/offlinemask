import { env, pipeline } from "@huggingface/transformers";
import type { RawTokenClassificationEntity } from "openmed";
import { createModelRunner, type ModelProvider } from "./model-runner.ts";
import { combinedModelSource } from "./model-policy.ts";
import { recognitionPack, type PackDefinition, type PackModel } from "./pack.ts";
import { predictAllTokens } from "./token-predictions.ts";
import { applyDetectionPolicy } from "./policy.ts";
import {
  recognitionSource,
  attachRecognitionOffsets,
  type EncodeRecognition,
} from "./recognition-source.ts";
import type { DetectionProgress } from "./types.ts";

/** A loaded model: its tokenizer for token counts and IDs, and raw per-token predictions. */
export interface ModelSession {
  tokenizer: {
    encode(text: string, options?: { add_special_tokens?: boolean }): number[];
  };
  predict(text: string): Promise<RawTokenClassificationEntity[]>;
  dispose(): Promise<unknown>;
}
/** Loads one pack model from the verified pack root. The runtime (WASM, native…) lives here. */
export type ModelBackend = (model: PackModel, root: string) => Promise<ModelSession>;

/** Transformers.js reads only the installed pack; no Hub, CDN or cache is ever consulted. */
export function configureLocalModels(root: string) {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = root + "/";
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.useWasmCache = false;
}

/** The default runtime: the pinned ONNX Runtime WASM build inside the detection worker. */
export function wasmBackend(device: "wasm" | "cpu" = "wasm", wasmPath = "/runtime/"): ModelBackend {
  return async (model) => {
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = {
        wasm: `${wasmPath}ort-wasm-simd-threaded.asyncify.wasm`,
      };
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
    }
    const classifier = await pipeline("token-classification", model.directory, {
      device,
      dtype: "fp32",
      subfolder: "",
      model_file_name: model.graph,
      local_files_only: true,
    });
    return {
      tokenizer: classifier.tokenizer,
      predict: (text) => predictAllTokens(classifier, text, true),
      dispose: () => classifier.dispose(),
    };
  };
}

/** Wrap a loaded model in the shared runner contract: chunking, alignment and label policy. */
export function createPackProvider(
  model: PackModel,
  session: ModelSession,
  encode: EncodeRecognition,
): ModelProvider {
  const native = model.offsets === "native";
  return {
    source: model.source,
    tokenCount: (text) => session.tokenizer.encode(text).length,
    async predict(text) {
      const tokens = await session.predict(text);
      if (!native) return tokens;
      const ids = session.tokenizer.encode(text, { add_special_tokens: false });
      return attachRecognitionOffsets(
        text,
        tokens,
        ids,
        await encode(text, model.directory),
        model.labels,
      );
    },
    // Native offsets are already exact; the sequential aligner is for Metaspace pieces.
    ...(native ? { align: (_text: string, tokens: RawTokenClassificationEntity[]) => tokens } : {}),
    dispose: () => session.dispose(),
  };
}

/** Load every model of a pack, in pack order, through one backend. */
export async function loadPackRecognition(
  pack: PackDefinition,
  root: string,
  encode: EncodeRecognition,
  backend: ModelBackend,
) {
  configureLocalModels(root);
  const runners: ReturnType<typeof createModelRunner>[] = [];
  try {
    for (const model of pack.models) {
      const session = await backend(model, root);
      runners.push(createModelRunner([createPackProvider(model, session, encode)]));
    }
  } catch (error) {
    await Promise.all(runners.map((runner) => runner.dispose()));
    throw error;
  }
  return createRecognition(runners, pack);
}

/** The shipping pack on the default WASM runtime. Evaluations may select the Node CPU runtime. */
export function loadRecognition(
  root: string,
  encode: EncodeRecognition,
  device: "wasm" | "cpu" = "wasm",
) {
  return loadPackRecognition(recognitionPack, root, encode, wasmBackend(device));
}

/** Shared orchestration; runtime experiments must preserve source mapping and policy. */
export function createRecognition(
  runners: ReturnType<typeof createModelRunner>[],
  pack: PackDefinition = recognitionPack,
) {
  const modelSources = new Set([...pack.models.map((model) => model.source), combinedModelSource]);
  async function inspect(
    original: string,
    progress: (p: DetectionProgress) => void = () => {},
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const source = recognitionSource(original);
    const evidence = [];
    // Match the evaluated recipe: per-model merge, contextual-only union, one final source policy.
    for (const [index, runner] of runners.entries()) {
      const found = await runner.inspect(
        source.text,
        (p) =>
          progress({
            ...p,
            completed: index + p.completed / Math.max(1, p.total),
            total: runners.length,
          }),
        signal,
      );
      evidence.push(
        ...source.restore(
          found.modelOnly.filter((d) => ["TEN", "DIA_CHI", "TO_CHUC"].includes(d.type)),
        ),
      );
    }
    signal?.throwIfAborted();
    const result = applyDetectionPolicy(original, evidence);
    // Users see one recognition pack, not the models inside it.
    for (const span of [...result.modelOnly, ...result.complete]) {
      if (modelSources.has(span.source)) span.source = pack.name;
    }
    return result;
  }
  return {
    inspect,
    detect: async (text: string, progress?: (p: DetectionProgress) => void, signal?: AbortSignal) =>
      (await inspect(text, progress, signal)).complete,
    dispose: () => Promise.all(runners.map((runner) => runner.dispose())),
  };
}
