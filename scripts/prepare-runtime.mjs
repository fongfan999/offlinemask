import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = fileURLToPath(new URL("../", import.meta.url));
// Resolve the runtime used by the pinned Transformers.js dependency, avoiding CDN assets.
const requireTransformers = createRequire(import.meta.resolve("@huggingface/transformers"));
const ortDir = dirname(requireTransformers.resolve("onnxruntime-web"));
const runtimeDir = join(root, "public/runtime");
await mkdir(runtimeDir, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.asyncify.wasm"])
  await copyFile(join(ortDir, file), join(runtimeDir, file));
console.log("Prepared local WASM runtime (no model weights).");
