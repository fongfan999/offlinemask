import { invoke, isTauri } from "@tauri-apps/api/core";
import type { OcrPage } from "../core/doc/ocr.ts";

/** Text recognition for pictures (decision 0171) lives in the native `ocr` module: the
 * operating system's own engine, on this machine. Browser previews have none.
 *
 * On by the owner's decision of 28 October 2026 (decision 0171), once the scans of the
 * synthetic set leaked nothing the text PDFs did not and the feature ran end to end in
 * the app. Off, the machine reports no recognition and pictures keep "Sắp có". The
 * state changes what the app does with pictures, so `landing/privacy.html` says so
 * while it is on (`tests/privacy-contract.test.mjs` checks both states). */
export const ocrShipped = true;

export async function ocrAvailable(): Promise<boolean> {
  if (!ocrShipped || !isTauri()) return false;
  try {
    return await invoke<boolean>("ocr_available");
  } catch {
    return false;
  }
}

/** The lines of text in a PNG or JPEG picture of `width` × `height` pixels. The bytes
 * are held only for the call. */
export async function recognizeImage(
  image: Uint8Array,
  width: number,
  height: number,
): Promise<OcrPage> {
  return invoke<OcrPage>("ocr_page", { image: Array.from(image), width, height });
}
