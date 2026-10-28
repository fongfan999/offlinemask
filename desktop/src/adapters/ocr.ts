import { invoke, isTauri } from "@tauri-apps/api/core";
import type { OcrPage } from "../core/doc/ocr.ts";

/** Text recognition for pictures (decision 0171) lives in the native `ocr` module: the
 * operating system's own engine, on this machine. Browser previews have none.
 *
 * Built and measured, not shipped: on scans of the synthetic set the reader still
 * leaks values the text PDFs do not (12 in 703 documents, decision 0171), so the
 * machine reports no recognition until that measurement is clean. Turning this on
 * changes what the app does with pictures: `landing/privacy.html` must say so in the
 * same change (`tests/privacy-contract.test.mjs` checks both states). */
export const ocrShipped = false;

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
