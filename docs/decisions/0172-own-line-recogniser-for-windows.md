# 0172 — OfflineMask's own Vietnamese line recogniser, for Windows

Date: 29 October 2026. Status: trained and screened; not in the app. Follows [0171](0171-scanned-pdfs-and-images-read-on-the-machine.md), whose "Windows" section found that Windows.Media.Ocr has no Vietnamese recogniser and that VietOCR reads fewer values than Tesseract at fifteen times Vision's time.

## Problem

Scanned PDFs and pictures open on macOS only, read by Vision. Most of OfflineMask's users are on Windows, which has no Vietnamese text recognition of its own. Every open-licence recogniser checked in 0171 either cannot write the 45 tone-marked vowels (PaddleOCR's Latin dictionaries), has no licence, or reads too little (VietOCR, Tesseract).

## What was built

A small line recogniser of our own, trained on this machine (Intel i5-12400, CPU only) and exported to ONNX so that it runs through the ONNX Runtime the app already carries.

- **Texts.** `scripts/ocr-train/export-lines.mjs` collects the lines the synthetic generator ([0153](0153-synthetic-document-set.md), [0160](0160-wider-synthetic-set.md)) would print: titles, paragraphs wrapped at three measures, runs of words, "Label: value" fields and the values alone, table headings and cells, signatures. Seeds 100–399 give 452 090 distinct lines for training, seeds 400–409 give 23 597 for validation. Seeds 1–26 are never used; the script refuses them.
- **Fonts.** 27 files from `google/fonts` at commit `9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0`, every one under the SIL Open Font Licence 1.1 at that commit: Tinos (Regular, Bold, Italic), Arimo, Cousine (Regular, Bold), Roboto, Noto Sans, Open Sans, Source Sans 3, Source Serif 4, Lora, Merriweather, IBM Plex Sans, IBM Plex Serif (Regular, Bold), Inter, Montserrat, Roboto Mono, Literata, Crimson Pro, Noto Sans Mono, Mulish, Nunito, Lexend, Fira Sans (Regular, Bold). The documents' own Be Vietnam Pro and Noto Serif are refused by `train.py`, so every measurement below reads typefaces the model never saw. The fonts are used for training only, kept under the ignored `desktop/artifacts/ocr-train/fonts/`, and not redistributed.
- **Rendering.** `scripts/ocr-train/train.py` draws each line at 18–44 px with a margin of 0.1–0.7 of the size across and 0.05–0.45 above and below, ink 0–80 on paper 205–255, with copier-like damage: a table rule beside or under the text, rotation up to 1.2°, down- and up-sampling, blur, noise and JPEG quality 40–95. 8 % of lines are upper-cased and 4 % lose their marks. Each line is scaled to height 32.
- **Model.** A convolutional stack (to 1 × W/4), a two-layer bidirectional LSTM of 160 and a linear layer over 231 classes (blank, every character of the texts, both cases of every Vietnamese letter, printable ASCII), trained with CTC: 1.8 million parameters, 7.3 MB as ONNX. AdamW at 1e-3 with a warm-up and a cosine schedule, batches of 48, three hours.
- **Export.** `train.py --export` writes `recogniser.onnx` (input `image` of 1 × 32 × W in −1…1, output `probabilities` of steps × batch × classes) and checks it against PyTorch at three widths.

The run that is measured: 20 000 steps, validation character error 0.28 %, 97.3 % of validation lines exact. `recogniser.onnx` sha256 `70c31d9fc69b00e5b07015a9dbf31c70b4f023d6baa4ce9189674395fc5961d5`, `charset.json` `6ce0ade0…`, training lines `d6a31515…`, validation lines `4d439319…`.

## Measured

`scripts/ocr-screening-v2/screen.mjs`, the screen of 0171 with this model in VietOCR's place: PP-OCRv4's mobile detector finds the boxes as before, each box is widened by a quarter of its height (the detector's boxes touch the ink; the model learnt lines with a margin, and without one it reads 244 of seed 1's 440 values), and each box is read in one pass with greedy CTC decoding. Details in the [evaluation](../evaluations/2026-10-28-scanned-documents.md#windows).

| Engine | Seed 1, hide values read verbatim (440) | Keep values (650) | Time a page |
| --- | --- | --- | --- |
| PP-OCRv4 detector + this recogniser | 429 | 554 | 1.6 s |
| Apple Vision (0171, on the Mac) | 430 | 622 | 0.7 s |
| Tesseract `vie` fast (0171) | 385 | 556 | |
| PP-OCRv4 detector + VietOCR (0171) | 336 | 536 | 11 s |

On all 703 scans and pictures of seeds 1–7 it reads 5 513 of the 5 604 private values verbatim; 91 are not. Of those, about 80 are long values in table cells or headings that wrap onto two lines, which the screen joins in plain top-to-bottom order with the other columns between them; about ten are letters misread ("Châu" as "Chậu", "BN67551980" as "BN67651980"). The figure is not the "not read" of 0171's document measurement (223 for Vision): that one runs through the app's reader by place, which puts a wrapped cell back together, and this screen does not.

## Limits

- The texts come from the same generator as the test documents (other seeds, the same templates and name lists), so these figures overstate what the model will do on real scans. The fonts are held out; the wording is not.
- Nothing here is through the app: there are no word boxes yet, so the 0171 bar (0 leaked on all 703, over-masking no worse than text PDFs) has not been measured.

## Dependencies

Training only; nothing below ships with the app. Locked in `scripts/ocr-train/uv.lock` (Python 3.12 through uv): PyTorch 2.14.1 (BSD-3-Clause), Pillow 13.0.0 (MIT-CMU), fontTools 4.68.0 (MIT), NumPy 2.5.4 (BSD-3-Clause), ONNX 1.23.2 (Apache-2.0), ONNX Runtime 1.31.1 (MIT), all from PyPI. The screen uses `onnxruntime-node` 1.24.3, `pdfjs-dist` and `@napi-rs/canvas`, already in the workspace. The detector is 0171's (`ch_PP-OCRv4_det_infer.onnx`, Apache-2.0, RapidOCR's export of PaddleOCR).

## Not decided here

- **Whether to build it into the app.** That needs word boxes (from the CTC alignment: each output step is 4 pixels of the line), the detector and recogniser as a downloaded pack like the recognition packs (about 12 MB, pinned by size and SHA-256 on R2, which the owner uploads), the privacy page, and the full 0171 measurement.
- **A check on real scans.** Synthetic scans cannot show how the model does on a real copier's output; a few of the owner's own scans, read on the machine and never committed, would.
- **What happens to `media_ocr`**, the Windows.Media.Ocr engine of 0171, which no Windows machine can reach today.
