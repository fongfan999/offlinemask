# Scanned documents and pictures read on the machine (28 October 2026)

The measurements of [decision 0171](../decisions/0171-scanned-pdfs-and-images-read-on-the-machine.md): the synthetic document set's PDFs turned into scans and pictures, read by Apple's Vision framework through the app's own native module, and masked with the installed shipping pack (`e562a9b3…`, decision 0169) on an M1 Pro running macOS 26.6. Cells read not read / leaked / over-masked / unlisted, as `pnpm -C desktop eval:documents` prints them.

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

The owner asked for each leak diagnosed and fixed where it belongs (decision 0171, "The 12 leaks, one by one"): the cell-gap threshold, the transfer-account rule, repeated values (names and numbers only), columns bridged by one glued word, a bar inside a word, the classification of a value glued to its neighbour, and page de-skew. Same scripts, same pack.

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
