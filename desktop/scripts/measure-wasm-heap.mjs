// Measure the ONNX Runtime WASM heap that the shipping pack needs (decision 0129).
// Loads each pack model into the same runtime the desktop worker uses, once as the
// whole graph (how the app loaded it before) and once with its weights as external
// data (how it loads now), runs one 512-token input and prints the heap size.
// WASM memory never shrinks, so the size after loading is what the page keeps.
//
//   mise exec -- node scripts/measure-wasm-heap.mjs <pack root> [inline|external]
//
// Run each mode in its own process: the heap of one run would hide the other.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recognitionPack } from "../src/core/detection/pack.ts";
import { externalizeWeights } from "../src/core/detection/external-weights.ts";

const [rootArg, mode = "external"] = process.argv.slice(2);
if (!rootArg || !["inline", "external"].includes(mode))
  throw new Error("Usage: measure-wasm-heap.mjs <pack root> [inline|external]");
const root = resolve(rootArg);

// The runtime Transformers.js resolves, not a second copy.
const transformers = createRequire(import.meta.url).resolve("@huggingface/transformers");
const dist = join(createRequire(transformers).resolve("onnxruntime-web"), "..");
let memory;
const Memory = WebAssembly.Memory;
WebAssembly.Memory = function (descriptor) {
  memory = new Memory(descriptor);
  return memory;
};
WebAssembly.Memory.prototype = Memory.prototype;
const ort = await import(pathToFileURL(join(dist, "ort.node.min.mjs")).href);
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  wasm: pathToFileURL(join(dist, "ort-wasm-simd-threaded.asyncify.wasm")).href,
  mjs: pathToFileURL(join(dist, "ort-wasm-simd-threaded.asyncify.mjs")).href,
};

const mb = (bytes) => Math.round(bytes / 2 ** 20);
const tokens = 512;
const ids = (fill) =>
  new ort.Tensor("int64", BigInt64Array.from({ length: tokens }, fill), [1, tokens]);
const sessions = [];
for (const model of recognitionPack.models) {
  const bytes = new Uint8Array(await readFile(join(root, model.directory, `${model.graph}.onnx`)));
  let session;
  if (mode === "inline") session = await ort.InferenceSession.create(bytes);
  else {
    const location = `${model.graph}.onnx_data`;
    session = await ort.InferenceSession.create(externalizeWeights(bytes, location).model, {
      externalData: [{ path: location, data: bytes }],
    });
  }
  const loaded = mb(memory.buffer.byteLength);
  const feeds = {};
  for (const name of session.inputNames) {
    feeds[name] = name.includes("mask")
      ? ids(() => 1n)
      : name.includes("type")
        ? ids(() => 0n)
        : ids((_, i) => BigInt(i ? 100 + i : 0));
  }
  for (const output of Object.values(await session.run(feeds))) output.dispose();
  sessions.push(session);
  console.log(
    `${mode} ${model.directory}: graph ${mb(bytes.length)} MB, heap after loading ${loaded} MB, after one ${tokens}-token run ${mb(memory.buffer.byteLength)} MB`,
  );
}
