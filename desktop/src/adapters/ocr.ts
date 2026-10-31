import { invoke, isTauri } from "@tauri-apps/api/core";
import type { OcrPage } from "../core/doc/ocr.ts";
import type { ReadingRequest, ReadingResponse } from "../workers/reading.worker.ts";

/** Text recognition for pictures (decision 0171) lives in the native `ocr` module: the
 * operating system's own engine, on this machine. Browser previews have none.
 *
 * On by the owner's decision of 28 October 2026 (decision 0171), once the scans of the
 * synthetic set leaked nothing the text PDFs did not and the feature ran end to end in
 * the app. Off, the machine reports no recognition and pictures keep "Sáº¯p cÃ³". The
 * state changes what the app does with pictures, so `landing/privacy.html` says so
 * while it is on (`tests/privacy-contract.test.mjs` checks both states). */
export const ocrShipped = true;

/** Where the system has no Vietnamese recognition (Windows, Macs before macOS 14),
 * OfflineMask's own models, carried inside the app, read the picture in a worker (decision
 * 0172). On by the owner's decision of 31 October 2026 (decision 0182), once the scans of
 * the synthetic set leaked nothing on Windows and the owner's own copier scans, forms and
 * identity cards were masked (0173 to 0181). `landing/privacy.html` describes it while it
 * is on (checked by `tests/privacy-contract.test.mjs`). */
export const readingShipped = true;

let engine: "system" | "reading" | undefined;

async function systemAvailable(): Promise<boolean> {
  try {
    return await invoke<boolean>("ocr_available");
  } catch {
    return false;
  }
}

/** The models are in the app only when the build had them (`scripts/prepare-reading.mjs`). */
async function readingAvailable(): Promise<boolean> {
  if (!readingShipped) return false;
  try {
    return (await fetch("/reading/reading-v1.json")).ok;
  } catch {
    return false;
  }
}

export async function ocrAvailable(): Promise<boolean> {
  if (!ocrShipped || !isTauri()) return false;
  engine = (await systemAvailable())
    ? "system"
    : (await readingAvailable())
      ? "reading"
      : undefined;
  return engine !== undefined;
}

let worker: Worker | undefined;
let sequence = 0;
const waiting = new Map<number, { resolve: (page: OcrPage) => void; reject: () => void }>();
function readWithModels(image: Uint8Array, width: number, height: number): Promise<OcrPage> {
  if (!worker) {
    worker = new Worker(new URL("../workers/reading.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<ReadingResponse>) => {
      const { id, page } = event.data;
      const waiter = waiting.get(id);
      waiting.delete(id);
      if (page) waiter?.resolve(page);
      else waiter?.reject();
    };
  }
  const id = ++sequence;
  const copy = image.slice().buffer;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject: () => reject(new Error("Text recognition failed")) });
    worker!.postMessage({ id, image: copy, width, height } satisfies ReadingRequest, [copy]);
  });
}

/** The lines of text in a PNG or JPEG picture of `width` Ã— `height` pixels. The bytes
 * are held only for the call. */
export async function recognizeImage(
  image: Uint8Array,
  width: number,
  height: number,
): Promise<OcrPage> {
  if (engine === "reading") return readWithModels(image, width, height);
  return invoke<OcrPage>("ocr_page", { image: Array.from(image), width, height });
}
