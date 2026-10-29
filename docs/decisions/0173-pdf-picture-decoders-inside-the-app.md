# 0173 — pdf.js's picture decoders, inside the app

Date: 29 October 2026. Status: built and measured. Follows [0171](0171-scanned-pdfs-and-images-read-on-the-machine.md) (scanned PDFs read by text recognition) and [0172](0172-own-line-recogniser-for-windows.md), whose check on the owner's own scans found it.

## Problem

Office copiers save a compact scan as a colour background at low resolution with the text laid over it as a black-and-white mask, coded as a fax picture (CCITT) or JBIG2; some save the whole page in JPEG 2000. pdf.js 6.4 decodes those three codings with separate modules that it loads from `wasmUrl`. OfflineMask gives pdf.js no URL at all (`pdf.ts`, so that it fetches nothing), so on a scanned page drawn for recognition pdf.js skipped those pictures with a warning nobody sees, and the recogniser got the background alone: text a few greys from white. It is the same on the Mac, where Vision is handed the same drawn page.

Two of the four real documents the owner put on the machine for 0172's check were such scans (CCITT masks, 22 and 50 of them): read through the app they gave 8 and 16 paragraphs of fragments, two pages "không có chữ đọc được", and nothing was masked. The 703 synthetic scans of 0171 are JPEG pictures, which pdf.js decodes itself, so the measurement never met it.

## Decision

- **The JavaScript builds of the decoders ship in the app.** `scripts/prepare-runtime.mjs` (run by `pnpm build`) copies `jbig2_nowasm_fallback.js` (152 KB; it also decodes CCITT) and `openjpeg_nowasm_fallback.js` (446 KB) from `pdfjs-dist/wasm/`, with their licences, into `public/pdfjs/` (ignored by git), which the build puts in the app as it does `public/reading/`.
- **pdf.js is told where they are only when recognition is at hand.** `openPdf` takes a `decoders` URL and passes it as `wasmUrl`; `files.worker.ts` gives the app's own `/pdfjs/`, made absolute from the worker's location, only with `ocr`. Without recognition pdf.js still loads nothing, and a page with text never decodes its pictures (0171).
- **WebAssembly stays off** (`useWasm: false`): with it on, pdf.js would also load its colour-profile module (`qcms_bg.wasm`) for every page, and the JavaScript decoders read the same pictures. No CMap, font or ICC URL is given.
- **Nothing leaves the machine.** The decoders are imported from the app's own files, which the content security policy (`script-src 'self'`) already allows; the privacy page's promises (no network, nothing stored) are unchanged, so the page is not. `tests/privacy-contract.test.mjs` pins that pdf.js is given no URL but this one.
- **The measurement uses the package's folder** (`scripts/document-evaluation.mjs`), so `pnpm eval:documents` reads such scans as the app does.

## Checked

- `tests/ocr.test.mjs` builds a page with a 64 × 16 CCITT Group 3 mask holding a black bar: drawn with the decoders it has the bar's 77 160 dark pixels within a tenth, and none without them.
- In Chromium (the dev server in the built-in browser), `openPdf` in a module worker drew the same page with 77 145 dark pixels from `/pdfjs/`, and 0 without; the decoder imports only from an absolute URL in a worker started from a blob, hence the absolute URL.
- The owner's two copier scans through `maskDocument` after the change: 50 and 163 paragraphs and every page read, with names, tax codes, phones, an e-mail address and addresses among what is masked. They still do not meet 0171's bar; what is missed is in 0172 ("The owner's own scans"), and none of it comes from decoding.
- The tests, lint, build and `check:native`. The installed Store app was running, so the change was not driven in the Tauri window; WebView2 is the same Chromium engine as the check above.

## Dependencies

No new package: the files come from `pdfjs-dist` 6.4.299, already a dependency (0149). `jbig2_nowasm_fallback.js` is PDFium's JBIG2 and fax decoder (BSD-3-Clause, The PDFium Authors) compiled by Mozilla (Apache-2.0); `openjpeg_nowasm_fallback.js` is OpenJPEG (BSD-2-Clause, Université catholique de Louvain and contributors) compiled by Mozilla (BSD-2-Clause). Their four licence files are copied beside them.
