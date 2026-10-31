# Scanned documents and pictures read on the machine (28 October 2026)

The measurements of [decision 0180](../decisions/0180-scanned-pdfs-and-images-read-on-the-machine.md): the synthetic document set's PDFs turned into scans and pictures, read by Apple's Vision framework through the app's own native module, and masked with the installed shipping pack (`e562a9b3…`, decision 0169) on an M1 Pro running macOS 26.6. Cells read not read / leaked / over-masked / unlisted, as `pnpm -C desktop eval:documents` prints them.

## Engines screened on seed 1

54 pages rendered at 200 dpi with `pdftoppm`; each engine's text, whitespace squeezed, searched for every value of the expectation lists. Tesseract 5.5.1 (Homebrew) with the `vie` model from `tessdata_fast` (commit 923915d4, 2017) and `tessdata_best`; Apple Vision through a Swift probe with the same request the app makes.

| Engine | Hide values read verbatim (440) | Keep values read verbatim (650) |
| --- | --- | --- |
| Apple Vision, accurate, `vi-VT` + `en-US` | 430 | 622 |
| Tesseract `vie` fast, page segmentation 3, 200 dpi | 385 | 556 |
| Tesseract `vie` fast, page segmentation 3, 300 dpi | 395 | 541 |
| Tesseract `vie` fast, page segmentation 6 | 355 | 439 |
| Tesseract `vie` best, page segmentation 3 | 368 | 523 |
| Tesseract `vie` best, page segmentation 6 | 343 | 421 |

PaddleOCR's Latin recognisers (PP-OCRv3, v5, v6) were not run: their dictionaries hold none (v3, v5) or one (v6) of the 45 tone-marked Vietnamese vowels, so they cannot write the language.

## The document measurement

`pnpm -C desktop documents:generate artifacts/seeds/<n> --seed <n>` for seeds 1–7, `node scripts/rasterise-documents.mjs artifacts/seeds artifacts/seeds-scanned` (200 dpi, JPEG quality 80), then `pnpm -C desktop eval:documents` on each folder, the scanned one with `--misread`.

### Text PDFs, the baseline

`pnpm -C desktop eval:documents artifacts/seeds`, 546 documents (364 PDFs and 182 Word files) in 225 s: **0 / 0 / 0 / 0**.

### Seed 1's scans and pictures, reading by reading

52 scanned PDFs and 50 pictures (the one-page documents). Each row adds one step to the reader; the text PDFs of the same seed are 0 / 0 / 0 / 0.

| Reading | not read | leaked | over-masked | unlisted | time |
| --- | --- | --- | --- | --- | --- |
| Vision's lines as pdf.js items, the box height as font size | 26 | 25 | 6 | 32 | 93 s |
| plus words from Vision's part boxes, size from the letters' room | 29 | 7 | 5 | 34 | 94 s |
| plus cells from the text detector's glyph boxes | 21 | 2 | 2 | 28 | 111 s |
| plus letter widths by kind, tight extents, no cell beside a dash | 21 | 0 | 2 | 28 | 99 s |

Last reading, `--misread`: of the 21 values not read verbatim, 16 are misread and masked all the same, 0 are misread and readable, 5 are not found even without their marks (invoice-service-2: "Công ty Cổ phần Công nghệ Phú Thịnh", "0307506787"; invoice-winmart-1: "0399449254"; payslip-table-2: "Dương Quốc Đạt" read "Dơng Quốc Đạt"; statement-classic-1: "711700118311"). The two over-masked are "Sách Đắc Nhân Tâm" in order-delivery-2, scan and picture, under a heading the engine read "Sản phấm".

### Seeds 1–7, scans and pictures

| Seed | Scanned PDFs | Pictures (one-page documents) |
| --- | --- | --- |
| 1 | 52: 12 / 0 / 1 / 15 | 50: 9 / 0 / 1 / 13 |
| 2 | 52: 22 / 1 / 1 / 22 | 49: 14 / 0 / 0 / 14 |
| 3 | 52: 18 / 2 / 0 / 17 | 48: 14 / 1 / 0 / 17 |
| 4 | 52: 23 / 6 / 0 / 24 | 48: 14 / 0 / 0 / 15 |
| 5 | 52: 20 / 0 / 0 / 24 | 48: 17 / 0 / 1 / 21 |
| 6 | 52: 14 / 1 / 1 / 21 | 48: 13 / 0 / 3 / 15 |
| 7 | 52: 18 / 1 / 1 / 22 | 48: 15 / 0 / 0 / 20 |
| All | 364: 127 / 11 / 4 / 145 | 339: 96 / 1 / 5 / 115 |

703 documents in 637 s: not read 223, leaked 12, over-masked 9, unlisted 260. The text PDFs of the same seeds (546 documents with their Word copies) are 0 / 0 / 0 / 0 in 225 s. With `--misread`, of the 223 values not read verbatim 137 are misread and masked all the same, 7 are misread and readable (five e-mail addresses with a wrong letter, "BÙI BẢO HÀ" once, each in a scan and its picture), and 79 are not found even without their marks (phone and account numbers with a digit dropped or glued to a neighbour, a few company names and addresses).

**The 12 leaks.** Eleven are in scanned PDFs, one in a picture; eight are in the `statement-classic` layout, which is two pages and so measured only as a PDF.

- Seed 4, `statement-classic-1`, four account numbers: the reference column's word ("FT26894030217") landed inside the description cell, between "TK" and the account number ("chuyen tien den TK FT26894030217 821646066891"), so the rule that masks an account after "TK" saw the reference instead. The row's description wraps onto two lines around the date and reference, and the glyph-to-word placement of the two-word middle line put the reference's box inside the description's column. A layout defect, fixable.
- Seeds 2, 3, 4 and 7, `statement-classic`, the other account numbers and "NGUYEN MINH HUNG": the engine dropped digits from the account number ("4179866071" read "41786 FT"), so the name after it no longer followed an account; the same for the others. The engine's.
- Seeds 3 and 6, `contract-labour-1`, a phone number: the engine read the two-column form row ("Điện thoại: … · Email: …" beside "Địa chỉ: …") as one line with the words of both columns interleaved ("Địa Điện chỉ thoại: thư n932 093273237136 …"), gluing the phone number to the e-mail's digits. The engine's.

Against the bar, the scans leak where the text PDFs do not, in both kinds: a layout precision defect that another iteration can remove, and the engine's misreads, which no layout work removes and which also account for the seven misread values that would reach the AI readable.

### Seeds 1–7 after the fixes (the twelve leaks diagnosed)

The owner asked for each leak diagnosed and fixed where it belongs (decision 0180, "The 12 leaks, one by one"): the cell-gap threshold, the transfer-account rule, repeated values (names and numbers only), columns bridged by one glued word, a bar inside a word, the classification of a value glued to its neighbour, and page de-skew. Same scripts, same pack.

| Seed | Scanned PDFs | Pictures (one-page documents) |
| --- | --- | --- |
| 1 | 52: 12 / 0 / 1 / 15 | 50: 9 / 0 / 1 / 13 |
| 2 | 52: 22 / 0 / 1 / 21 | 49: 15 / 0 / 0 / 16 |
| 3 | 52: 18 / 0 / 0 / 17 | 48: 14 / 0 / 0 / 17 |
| 4 | 52: 22 / 0 / 0 / 26 | 48: 14 / 0 / 0 / 15 |
| 5 | 52: 20 / 0 / 1 / 24 | 48: 17 / 0 / 1 / 21 |
| 6 | 52: 14 / 0 / 1 / 21 | 48: 13 / 0 / 3 / 15 |
| 7 | 52: 16 / 0 / 1 / 22 | 48: 15 / 0 / 1 / 20 |
| All | 364: 124 / 0 / 5 / 146 | 339: 97 / 0 / 6 / 117 |

703 documents in 744 s: **not read 221, leaked 0, over-masked 11, unlisted 263**. With `--misread`: 138 misread and masked all the same, 7 misread and readable, 76 not found even without their marks. Before the fixes: 223 / 12 / 9 / 260.

The text PDFs of seeds 1–7 re-measured with the same code: 546 documents, 0 / 0 / 0 / 0 in 241 s; the owner's decision 0 / 0 / 0 / 0; the owner's invoices 0 / 1 / 0 / 0 (the bank name in a draft expectation): the shipped baseline does not move. The eleven over-masked are the engine's misreads of headings and labels, listed in the decision.

### In the app

`tauri dev` of this worktree, driven through accessibility: a photographed form (tilted 1.4°, noised, JPEG) and a scanned contract (picture-only PDF) opened on Tài liệu, were masked (10 places, 9 aliases; 17 places, 14 aliases), saved as Markdown and restored from that copy (10 and 17 aliases). One defect found and fixed: pdf.js constructs the worker's canvas factory with `new`, and a plain object threw before any scanned page was drawn.

## Windows

On the owner's Windows PC (Windows 11 Pro 10.0.26200, x64 CPU, no GPU used).

**Windows.Media.Ocr** has no Vietnamese recogniser: installing Tiếng Việt offers no text recognition feature, `OcrEngine.AvailableRecognizerLanguages` lists `en-US` alone, and the English recogniser on the picture of seed 1's `contract-labour-1` writes no Vietnamese letter in 1 280 characters. Not measured further.

**VietOCR**, screened like the engines above on seed 1's 54 pages (drawn at 200 dpi and passed through JPEG quality 80, as the scans are) with `scripts/ocr-screening-v1/screen.mjs`: PP-OCRv4's mobile text detector (RapidOCR's ONNX export, `ch_PP-OCRv4_det_infer.onnx`, sha256 `d2a7720d…`, Apache-2.0) finds the segments with PaddleOCR's post-processing (threshold 0.3, box score 0.6, unclip 1.5); VietOCR's `vgg_transformer` (`vemines/vietocr-onnx` at 049d43e7, encoder `37528399…` with data `395df00d…`, decoder `a77eb696…`, MIT) reads each segment at height 32 with greedy decoding, a segment wider than 384 being cut at its widest word gap (wider, the decoder stops early: "Số 285 Nguyên Thị Minh" for a whole address); ONNX Runtime 1.24.3 (`onnxruntime-node`, already installed under `@huggingface/transformers`).

| Engine | Hide values read verbatim (440) | ignoring case | Keep values read verbatim (650) | ignoring case | time a page |
| --- | --- | --- | --- | --- | --- |
| PP-OCRv4 detector + VietOCR `vgg_transformer` | 336 | 385 | 536 | 571 | 11 s |
| for reference, from the Mac: Apple Vision | 430 | | 622 | | 0.7 s |
| for reference, from the Mac: Tesseract `vie` fast | 385 | | 556 | | |

Of the 104 hide values not read verbatim, 49 are read but in the wrong case ("công ty TNHH", "trần hưng đạo"), 15 are read without or with wrong tone marks, and 40 are not found even so: every e-mail address with "@" read as "0" ("ngoc.do40000utlook.com"), names of statement rows that wrap onto two lines and come apart in the screen's simple reading order, a stray segment inside an address ("Hồ Xã Chí Minh"), spaces dropped inside phone numbers. The reading-order losses are the screen's, which the app's reader by place would partly recover; the case and "@" errors are the model's, and an e-mail address read with "0" for "@" is one the policy no longer recognises. Below Tesseract verbatim and fifteen times slower than Vision: not a candidate as it stands.

### OfflineMask's own recogniser (decision 0181)

A CTC line recogniser trained for three hours on this machine's CPU from lines of the generator's seeds 100–399, drawn in 27 open fonts that exclude the documents' own (`recogniser.onnx` sha256 `70c31d9f…`; validation character error 0.28 %). Screened with `scripts/ocr-screening-v2/screen.mjs`: the same detector, pages and scoring as VietOCR's screen, each box widened by `--grow` of its height before it is read.

| Reading, seed 1's 54 pages | Hide values read verbatim (440) | ignoring case | Keep values read verbatim (650) | ignoring case | time a page |
| --- | --- | --- | --- | --- | --- |
| the detector's box as it is | 244 | 255 | 308 | 327 | 1.6 s |
| widened by 0.1 of its height | 410 | 411 | 539 | 545 | 1.6 s |
| widened by 0.25 | 429 | 429 | 554 | 554 | 1.6 s |
| widened by 0.35 | 419 | 420 | 520 | 521 | 1.6 s |
| widened by 0.5 (neighbouring lines come in) | 349 | 352 | 341 | 347 | 1.6 s |

Without a margin the first and last letters and the marks above capitals are lost ("CỘNC HÒA … NGHẨA VIỆT NA"); the detector's boxes touch the ink and every training line had room around it.

At 0.25, on all 703 scans and pictures of seeds 1–7 (`artifacts/seeds-scanned`, 728 pages in 1 180 s): **5 513 of 5 604 hide values read verbatim, 7 343 of 8 515 keep values**. By seed, hide values not read in scanned PDFs / pictures: 10 / 7, 7 / 4, 9 / 3, 8 / 3, 6 / 4, 12 / 5, 10 / 3. By layout: statement-classic 21, statement-compact 21, payslip-table 13, payslip-compact 12, minutes-meeting 7, order-receipt 6, invoice-winmart 3, contract-rental 2, minutes-handover 2, and one each in form-application, invoice-household, medical-exam and utility-electric.

The 91 are mostly long values that wrap: statement rows' names and companies ("CONG TY TNHH MTV VAN TAI DONG A"), company names over two heading lines, payslip addresses in a narrow cell, each joined by the screen's top-to-bottom order with the other column's words between its halves. About ten are the model's: "Châu" read "Chậu", "Đà" read ")à", "Sài" read "ài", "BN67551980" read "BN67651980", "NV24259", "PE52514527", one phone number and one e-mail address (in a scan and its picture). Not comparable with Vision's 223 "not read" above, which goes through the app's reader by place; that measurement needs the recogniser in the app.

### OfflineMask's own recogniser through the app (decision 0181)

`pnpm -C desktop eval:documents artifacts/seeds-scanned --pack <shipping pack e562a9b3…> --reading --misread` on the owner's Windows PC: the recogniser and detector of `desktop/reading/reading-v1.json` read every page without text and every picture through `src/core/doc/reading.ts`, then the app's reader by place, detection and masking. Cells not read / leaked / over-masked / unlisted.

| Seed | Scanned PDFs | Pictures (one-page documents) |
| --- | --- | --- |
| 1 | 52: 4 / 0 / 0 / 6 | 50: 4 / 0 / 0 / 4 |
| 2 | 52: 4 / 0 / 0 / 7 | 49: 5 / 0 / 1 / 6 |
| 3 | 52: 3 / 0 / 0 / 4 | 48: 3 / 0 / 0 / 4 |
| 4 | 52: 3 / 0 / 2 / 10 | 48: 2 / 0 / 2 / 4 |
| 5 | 52: 3 / 0 / 0 / 7 | 48: 3 / 0 / 0 / 6 |
| 6 | 52: 2 / 0 / 0 / 6 | 48: 2 / 0 / 0 / 2 |
| 7 | 52: 2 / 0 / 0 / 4 | 48: 2 / 0 / 0 / 2 |
| All | 364: 21 / 0 / 2 / 44 | 339: 21 / 0 / 3 / 28 |

703 documents in 2 375 s: **not read 42, leaked 0, over-masked 5, unlisted 72**; Vision after its fixes, above, 221 / 0 / 11 / 263. With `--misread`: 21 misread and masked all the same, 0 misread and readable, 21 not found even without their marks (addresses and company names misread in a letter or two, "BN67551980", "NV24259", one phone number, one e-mail address, two statement names, one account number; most in a scan and its picture).

Reading by reading:

| Reading | not read | leaked | over-masked | unlisted |
| --- | --- | --- | --- | --- |
| words drawn in to all the ink of the widened box, sizes from widths | 43 | 21 | 13 | 65 |
| plus ink only within the detector's own text, sizes also from the height of the print, lines numbered, sizes near the page's median taken as it | 42 | 0 | 5 | 72 |

The 21 leaks of the first reading: ten account numbers in `statement-classic` (a word reaching across the gutter merged the reference and description columns for the whole table, and "TK FT… 4762…" no longer reads as a transfer to an account), and eleven first signature names in `payslip-table` (the names row, 5.2–5.4 font sizes below the table, joined it as cells where a bold name's size was overestimated). The five over-masked of the second, and the text PDFs of the same seeds re-measured after the change to `ocr.ts` (546 documents, 0 / 0 / 0 / 0 in 1 013 s), are in decision 0181.

### Tilted and photographed pages (decision 0181)

`node scripts/rasterise-documents.mjs <seeds> <out> --tilt <degrees> [--photo --jpeg 70]` made crooked and photographed copies of the same documents (the photographed: paper `#ebe6dc`, 0.8 px blur, one corner shadowed to about grey 170, grain ±12, tilted 1.5°). With the page turned upright, the print height measured against each line's own paper and shadowed lines lifted (decision 0181), through the app with `--reading --misread`:

| Pages | Documents | not read | leaked | over-masked | unlisted |
| --- | --- | --- | --- | --- | --- |
| Upright, seeds 1–7 | 703 | 42 | 0 | 6 | 71 |
| Photographed, seeds 1–7 | 703 | 42 | 0 | 6 | 65 |
| Tilted 0.5°, seed 1 | 102 | 4 | 0 | 1 | 9 |
| Tilted 1°, seed 1 | 102 | 9 | 0 | 2 | 12 |
| Tilted 2°, seed 1 | 102 | 3 | 0 | 1 | 6 |

Before those changes, seed 1: 172 / 4 / 0 at 0.5°, 310 / 25 / 6 at 1°, 648 / 14 / 5 at 2°, 517 / 33 / 7 photographed; all seven seeds photographed, with the page turned upright but the print measured against a fixed grey: 49 / 6 / 5 / 91.
