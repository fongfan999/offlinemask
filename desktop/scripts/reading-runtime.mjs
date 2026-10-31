// OfflineMask's own text recognition (decision 0181) for the measurements: the app's
// `readPicture` with the two graphs of `reading/reading-v1.json` on the ONNX Runtime
// Node build (`onnxruntime-node` 1.24.3, already installed under @huggingface/transformers;
// the app runs the same graphs on the WASM build). Each graph is read from `reading/`
// (the committed recogniser) or `artifacts/reading/` (where `node scripts/prepare-reading.mjs`
// fetches the detector), checked by size and SHA-256. Pictures are decoded in memory; nothing is written.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readPicture } from "../src/core/doc/reading.ts";

const require = createRequire(import.meta.url);
const ort = createRequire(require.resolve("@huggingface/transformers"))("onnxruntime-node");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

export const readingDefinition = JSON.parse(
  readFileSync(new URL("../reading/reading-v1.json", import.meta.url), "utf8"),
);
const committed = fileURLToPath(new URL("../reading/", import.meta.url));
export const readingFolder = fileURLToPath(new URL("../artifacts/reading/", import.meta.url));

/** A model file of the definition, verified. */
export function readModel(file, folder = readingFolder) {
  const path = existsSync(`${committed}${file.name}`) ? committed : folder;
  const bytes = readFileSync(`${path}${file.name}`);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== file.bytes || digest !== file.sha256)
    throw new Error(`${file.name} does not match reading/reading-v1.json`);
  return bytes;
}

/** An `OcrEngine` for `openDocument`, the graphs loaded on first use. */
export function createReadingEngine(folder = readingFolder) {
  let models;
  const load = async () => {
    const detector = await ort.InferenceSession.create(readModel(readingDefinition.detector, folder));
    const recogniser = await ort.InferenceSession.create(
      readModel(readingDefinition.recogniser, folder),
    );
    return {
      async detect(input, width, height) {
        const result = await detector.run({
          x: new ort.Tensor("float32", input, [1, 3, height, width]),
        });
        return Object.values(result)[0].data;
      },
      async recognise(input, width) {
        const { probabilities } = await recogniser.run({
          image: new ort.Tensor("float32", input, [1, 1, readingDefinition.recogniser.height, width]),
        });
        return {
          data: probabilities.data,
          steps: probabilities.dims[0],
          classes: probabilities.dims[2],
        };
      },
    };
  };
  const engine = async (image, width, height) => {
    models ??= await load();
    const decoded = await loadImage(Buffer.from(image));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return readPicture({ data, width, height }, models, readingDefinition);
  };
  engine.dispose = () => {};
  return engine;
}
