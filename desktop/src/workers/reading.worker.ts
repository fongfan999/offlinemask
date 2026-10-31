/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/webgpu";
import definition from "../../reading/reading-v1.json";
import { readPicture, type ReadingDefinition, type ReadingModels } from "../core/doc/reading.ts";
import type { OcrPage } from "../core/doc/ocr.ts";

/** Reads text in pictures with OfflineMask's own models (decision 0181), off the main
 * thread, on the ONNX Runtime WASM build the app already carries (the one the detection
 * worker uses). The graphs come from the app itself (`/reading/`), never from the
 * network. A picture is held only while it is read. */
export type ReadingRequest = { id: number; image: ArrayBuffer; width: number; height: number };
export type ReadingResponse = { id: number; page?: OcrPage; error?: boolean };

const reading = definition as ReadingDefinition;
let models: Promise<ReadingModels> | undefined;

async function graph(file: ReadingDefinition["detector"] | ReadingDefinition["recogniser"]) {
  const response = await fetch(`/reading/${file.name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok || bytes.length !== file.bytes) throw new Error("Missing model");
  return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
}

async function load(): Promise<ReadingModels> {
  ort.env.wasm.wasmPaths = { wasm: "/runtime/ort-wasm-simd-threaded.asyncify.wasm" };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const detector = await graph(reading.detector);
  const recogniser = await graph(reading.recogniser);
  return {
    async detect(input, width, height) {
      const result = await detector.run({
        [detector.inputNames[0]!]: new ort.Tensor("float32", input, [1, 3, height, width]),
      });
      return result[detector.outputNames[0]!]!.data as Float32Array;
    },
    async recognise(input, width) {
      const { probabilities } = await recogniser.run({
        image: new ort.Tensor("float32", input, [1, 1, reading.recogniser.height, width]),
      });
      return {
        data: probabilities!.data as Float32Array,
        steps: probabilities!.dims[0]!,
        classes: probabilities!.dims[2]!,
      };
    },
  };
}

/** The picture's pixels, drawn over white as a page is. */
async function decode(image: ArrayBuffer, width: number, height: number) {
  const bitmap = await createImageBitmap(new Blob([image]));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (event: MessageEvent<ReadingRequest>) => {
  const { id, image, width, height } = event.data;
  // One picture at a time: the graphs are large and a page is read in seconds.
  queue = queue.then(async () => {
    try {
      models ??= load();
      const page = await readPicture(await decode(image, width, height), await models, reading);
      postMessage({ id, page } satisfies ReadingResponse);
    } catch {
      models = undefined;
      postMessage({ id, error: true } satisfies ReadingResponse);
    }
  });
};
