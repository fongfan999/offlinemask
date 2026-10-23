import { env, pipeline } from "@huggingface/transformers";
import type { RawTokenClassificationEntity } from "openmed";
import { createModelRunner, type ModelProvider } from "./model-runner.ts";
import { combinedModelSource } from "./model-policy.ts";
import { recognitionPack, type PackDefinition, type PackModel } from "./pack.ts";
import { predictAllTokens } from "./token-predictions.ts";
import { applyDetectionPolicy } from "./policy.ts";
import { createRangedFetch } from "./ranged-fetch.ts";
import { externalizeWeights } from "./external-weights.ts";
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

/** Where Transformers.js thinks the pack lives. It skips its local-file checks for http(s)
 * paths, and Windows serves the pack from `http://asset.localhost/`, so the tokenizer looked
 * missing there. A path that is not http keeps those checks on every platform. */
export const localPackPath = "offlinemask-pack:/";

/** The pack URL for a path under `localPackPath`; anything else is returned unchanged. */
export function packFileUrl(url: string, root: string): string {
  if (!url.startsWith(localPackPath)) return url;
  return `${root}/${url.slice(localPackPath.length).replace(/^\/+/, "")}`;
}

/** Graphs already read and rewritten by `wasmBackend`, by pack-relative path, served in
 * place of the file. */
const loadedGraphs = new Map<string, Uint8Array<ArrayBuffer>>();
const packRelative = (url: string) =>
  url.startsWith(localPackPath)
    ? url.slice(localPackPath.length).replace(/\/+/g, "/").replace(/^\//, "")
    : undefined;

/** The desktop serves the pack through a URL; Node evaluations read a directory. */
const isUrlRoot = (root: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(root);

/** Transformers.js reads only the installed pack; no Hub, CDN or cache is ever consulted. */
export function configureLocalModels(root: string) {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // Node reads files itself, so the alias would point it at a directory that does not exist.
  env.localModelPath = isUrlRoot(root) ? localPackPath : `${root}/`;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.useWasmCache = false;
  // Pack files arrive in ranges so the desktop host never copies a whole model in one call.
  const ranged = createRangedFetch({ shouldRange: (url) => url.startsWith(root) });
  env.fetch = (input, init) => {
    const relative = typeof input === "string" ? packRelative(input) : undefined;
    const graph = relative === undefined ? undefined : loadedGraphs.get(relative);
    if (graph) return Promise.resolve(new Response(graph));
    return ranged(typeof input === "string" ? packFileUrl(input, root) : input, init);
  };
}

/** One pack file in one buffer: from disk for Node evaluations, through the pack fetch in
 * the desktop worker. */
async function readPackFile(path: string, root: string): Promise<Uint8Array> {
  if (isUrlRoot(root)) return readBody(await env.fetch(`${localPackPath}${path}`));
  const fs = "node:fs/promises";
  const { readFile } = (await import(/* @vite-ignore */ fs)) as {
    readFile(path: string): Promise<Uint8Array>;
  };
  return readFile(`${root}/${path}`);
}

/** Frees a buffer that is no longer needed now rather than at the next garbage collection,
 * where the engine can (`ArrayBuffer.prototype.transfer`). Views into a larger buffer are
 * left alone. */
function release(view: Uint8Array) {
  const buffer = view.buffer as ArrayBuffer & { transfer?: (length: number) => ArrayBuffer };
  if (buffer.byteLength === view.byteLength) buffer.transfer?.(0);
}

/** An idle worker allocates nothing, so WebKit does not collect it, and the buffers a model
 * load leaves behind stayed in the page for minutes, about 0.5 GB more after loading
 * (decision 0129). A short burst of small, immediately dropped objects makes it collect. */
async function collectLoadGarbage() {
  let created = 0;
  for (let round = 0; round < 20; round++) {
    const objects: unknown[] = [];
    for (let index = 0; index < 100_000; index++) objects.push({ index });
    await new Promise((resolve) => setTimeout(resolve, 0));
    created += objects.length;
  }
  return created;
}

/** The whole body in one buffer sized from `content-length`, so no second copy is made. */
async function readBody(response: Response): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error("Model file unavailable");
  const total = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(total) || total <= 0)
    return new Uint8Array(await response.arrayBuffer());
  const bytes = new Uint8Array(total);
  const reader = response.body.getReader();
  let at = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > total) throw new Error("Model file changed");
    bytes.set(value, at);
    at += value.length;
    release(value);
  }
  if (at !== total) throw new Error("Model file changed");
  return bytes;
}

/** The default runtime: the pinned ONNX Runtime WASM build inside the detection worker. */
export function wasmBackend(device: "wasm" | "cpu" = "wasm", wasmPath = "/runtime/"): ModelBackend {
  return async (model, root) => {
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = {
        wasm: `${wasmPath}ort-wasm-simd-threaded.asyncify.wasm`,
      };
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
    }
    // The weights reach the runtime as external data: one heap copy instead of three
    // (decision 0129). The original file is the external data; only the graph is rewritten.
    const graph = `${model.directory}/${model.graph}.onnx`;
    const weights = await readPackFile(graph, root);
    const location = `${model.graph}.onnx_data`;
    const externalData = [{ path: location, data: weights }];
    loadedGraphs.set(graph, externalizeWeights(weights, location).model);
    let classifier;
    try {
      classifier = await pipeline("token-classification", model.directory, {
        device,
        dtype: "fp32",
        subfolder: "",
        model_file_name: model.graph,
        local_files_only: true,
        session_options: { externalData },
      });
    } finally {
      loadedGraphs.delete(graph);
      // The session keeps its own copy; drop the file bytes rather than leave them reachable.
      externalData.length = 0;
      release(weights);
    }
    if (device === "wasm") await collectLoadGarbage();
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

const graphBytes = (pack: PackDefinition, model: PackModel) =>
  pack.assets.find(
    (asset) => asset.directory === model.directory && asset.name === `${model.graph}.onnx`,
  )?.bytes ?? 0;

/** Load every model of a pack through one backend; detection runs them in pack order. */
export async function loadPackRecognition(
  pack: PackDefinition,
  root: string,
  encode: EncodeRecognition,
  backend: ModelBackend,
) {
  configureLocalModels(root);
  const runners: ReturnType<typeof createModelRunner>[] = [];
  try {
    // Largest graph first, while the page holds nothing else: the load peak was about
    // 0.4 GB lower (decision 0129). Runners keep pack order, which detection depends on.
    for (const model of [...pack.models].sort(
      (a, b) => graphBytes(pack, b) - graphBytes(pack, a),
    )) {
      const session = await backend(model, root);
      runners[pack.models.indexOf(model)] = createModelRunner(
        [createPackProvider(model, session, encode)],
        { threshold: model.minScore ?? 0 },
      );
    }
  } catch (error) {
    await Promise.all(runners.filter(Boolean).map((runner) => runner.dispose()));
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
