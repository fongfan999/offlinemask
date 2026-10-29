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
// pdf.js's decoders for fax (CCITT), JBIG2 and JPEG 2000 pictures, in their JavaScript
// builds, served at `/pdfjs/` for a scanned page's text (decision 0173), with their
// licences.
const pdfjsDir = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "wasm");
const decodersDir = join(root, "public/pdfjs");
await mkdir(decodersDir, { recursive: true });
for (const file of [
  "jbig2_nowasm_fallback.js",
  "openjpeg_nowasm_fallback.js",
  "LICENSE_JBIG2",
  "LICENSE_PDFJS_JBIG2",
  "LICENSE_OPENJPEG",
  "LICENSE_PDFJS_OPENJPEG",
])
  await copyFile(join(pdfjsDir, file), join(decodersDir, file));
console.log("Prepared local WASM runtime and picture decoders (no model weights).");
