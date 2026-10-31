# 0181 — OfflineMask's own Vietnamese line recogniser, for Windows

Date: 29 October 2026. Status: trained, screened, built into the app behind `readingShipped` (off), measured through the app on all 703 scans (0 leaked) and run end to end in the Windows app; tilted and photographed copies measured too (0 leaked); opening it is the owner's decision (see "Not decided here"). Follows [0180](0180-scanned-pdfs-and-images-read-on-the-machine.md), whose "Windows" section found that Windows.Media.Ocr has no Vietnamese recogniser and that VietOCR reads fewer values than Tesseract at fifteen times Vision's time.

## Problem

Scanned PDFs and pictures open on macOS only, read by Vision. Most of OfflineMask's users are on Windows, which has no Vietnamese text recognition of its own. Every open-licence recogniser checked in 0180 either cannot write the 45 tone-marked vowels (PaddleOCR's Latin dictionaries), has no licence, or reads too little (VietOCR, Tesseract).

## What was built

A small line recogniser of our own, trained on this machine (Intel i5-12400, CPU only) and exported to ONNX so that it runs through the ONNX Runtime the app already carries.

- **Texts.** `scripts/ocr-train/export-lines.mjs` collects the lines the synthetic generator ([0153](0153-synthetic-document-set.md), [0160](0160-wider-synthetic-set.md)) would print: titles, paragraphs wrapped at three measures, runs of words, "Label: value" fields and the values alone, table headings and cells, signatures. Seeds 100–399 give 452 090 distinct lines for training, seeds 400–409 give 23 597 for validation. Seeds 1–26 are never used; the script refuses them.
- **Fonts.** 27 files from `google/fonts` at commit `9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0`, every one under the SIL Open Font Licence 1.1 at that commit: Tinos (Regular, Bold, Italic), Arimo, Cousine (Regular, Bold), Roboto, Noto Sans, Open Sans, Source Sans 3, Source Serif 4, Lora, Merriweather, IBM Plex Sans, IBM Plex Serif (Regular, Bold), Inter, Montserrat, Roboto Mono, Literata, Crimson Pro, Noto Sans Mono, Mulish, Nunito, Lexend, Fira Sans (Regular, Bold). The documents' own Be Vietnam Pro and Noto Serif are refused by `train.py`, so every measurement below reads typefaces the model never saw. The fonts are used for training only, kept under the ignored `desktop/artifacts/ocr-train/fonts/`, and not redistributed.
- **Rendering.** `scripts/ocr-train/train.py` draws each line at 18–44 px with a margin of 0.1–0.7 of the size across and 0.05–0.45 above and below, ink 0–80 on paper 205–255, with copier-like damage: a table rule beside or under the text, rotation up to 1.2°, down- and up-sampling, blur, noise and JPEG quality 40–95. 8 % of lines are upper-cased and 4 % lose their marks. Each line is scaled to height 32.
- **Model.** A convolutional stack (to 1 × W/4), a two-layer bidirectional LSTM of 160 and a linear layer over 231 classes (blank, every character of the texts, both cases of every Vietnamese letter, printable ASCII), trained with CTC: 1.8 million parameters, 7.3 MB as ONNX. AdamW at 1e-3 with a warm-up and a cosine schedule, batches of 48, three hours.
- **Export.** `train.py --export` writes `recogniser.onnx` (input `image` of 1 × 32 × W in −1…1, output `probabilities` of steps × batch × classes) and checks it against PyTorch at three widths.

The run that is measured: 20 000 steps, validation character error 0.28 %, 97.3 % of validation lines exact. `recogniser.onnx` sha256 `70c31d9fc69b00e5b07015a9dbf31c70b4f023d6baa4ce9189674395fc5961d5`, `charset.json` `6ce0ade0…`, training lines `d6a31515…`, validation lines `4d439319…`.

## Measured

`scripts/ocr-screening-v2/screen.mjs`, the screen of 0180 with this model in VietOCR's place: PP-OCRv4's mobile detector finds the boxes as before, each box is widened by a quarter of its height (the detector's boxes touch the ink; the model learnt lines with a margin, and without one it reads 244 of seed 1's 440 values), and each box is read in one pass with greedy CTC decoding. Details in the [evaluation](../evaluations/2026-10-28-scanned-documents.md#windows).

| Engine | Seed 1, hide values read verbatim (440) | Keep values (650) | Time a page |
| --- | --- | --- | --- |
| PP-OCRv4 detector + this recogniser | 429 | 554 | 1.6 s |
| Apple Vision (0180, on the Mac) | 430 | 622 | 0.7 s |
| Tesseract `vie` fast (0180) | 385 | 556 | |
| PP-OCRv4 detector + VietOCR (0180) | 336 | 536 | 11 s |

On all 703 scans and pictures of seeds 1–7 it reads 5 513 of the 5 604 private values verbatim; 91 are not. Of those, about 80 are long values in table cells or headings that wrap onto two lines, which the screen joins in plain top-to-bottom order with the other columns between them; about ten are letters misread ("Châu" as "Chậu", "BN67551980" as "BN67651980"). The figure is not the "not read" of 0180's document measurement (223 for Vision): that one runs through the app's reader by place, which puts a wrapped cell back together, and this screen does not.

## Limits

- The texts come from the same generator as the test documents (other seeds, the same templates and name lists), so these figures overstate what the model will do on real scans. The fonts are held out; the wording is not.
- The 703 scans are renders of the synthetic PDFs at 200 dpi through JPEG, upright and clean. Tilted and photographed copies of them are measured below ("Tilted and photographed pages"); a real copier's or phone's output is not.

## In the app

Where the system has no Vietnamese recognition (`ocr_available` is false: Windows, and Macs before macOS 14), the app reads pictures with these models once `readingShipped` (`src/adapters/ocr.ts`) is on. Everything else about pictures is 0180's: the same `OcrPage` of word boxes, the same reader by place, the same text-only masked copy.

- **The models are data**, described by `desktop/reading/reading-v1.json`: each file's name, size and SHA-256 and where the build fetches it, the detector's post-processing, and the recogniser's height, stride, margin and 231 classes. Changing a model means changing that file.
- **Inside the app, never downloaded by it.** `scripts/prepare-reading.mjs` (run by `pnpm build`, or `pnpm reading:prepare` before `tauri dev`) copies the two graphs (4.7 MB and 7.3 MB) into `public/reading/` and uses a file only when its size and digest match. The recogniser is committed beside its definition (`desktop/reading/recogniser.onnx`, the owner's choice of 29 October 2026, so every checkout and release build carries it); the detector is fetched by the build from RapidOCR's repository on Hugging Face at a pinned commit into the ignored `artifacts/reading/`. The installer grows by those 12 MB. A build without the files leaves `public/reading/` out, and the app then offers no reading of its own; a committed file that does not match its definition fails the build, and `tests/reading.test.mjs` pins it too.
- **A worker** (`src/workers/reading.worker.ts`) loads the graphs from the app itself and runs them on the ONNX Runtime WASM build the detection worker already uses (one thread), so no native code changed. The picture is decoded there and held only while it is read. `src/core/doc/reading.ts` is the reading itself, with no runtime in it, so the measurement runs the same code on the Node build (`scripts/reading-runtime.mjs`, `pnpm eval:documents … --reading`).
- **Word boxes** come from the recogniser's own alignment: each output step covers 4 columns of the line, two words part at the step where the space between them was read, and each word is drawn in to its ink. Only the detector's own text counts as ink, its rows before its box was pushed out and its box across: the quarter-height margin the recogniser needs takes in the neighbouring lines and the end of the next cell's word, and with them a word of a statement reached across the gutter and merged two columns for the whole table (ten account numbers leaked on the first measurement).
- **Font size.** `ocr.ts` sizes a line by how much room its letters take (0180), which bold print overstates by about a tenth. This engine also measures the height of the line's densest band of ink (about half the size in lower case, nearer three quarters in capitals: a least-squares fit over 1 882 lines of seed 1's scans against their text PDFs), and `ocr.ts` takes the mean of the two, which puts 90 % of lines within 9.6 % of their size instead of 12.9 %. The engine numbers its lines, so two boxes at the same height are two lines, and a measured size within 15 % of the page's median takes the median. Before these, the signature names under a payslip's table (5.2 to 5.4 sizes below it, where 5 ends a table) joined the table as cells on some pages and the first name leaked (eleven leaks). Vision gives no measured size, so its reading is unchanged.

## Measured through the app

`pnpm -C desktop eval:documents artifacts/seeds-scanned --pack <shipping pack> --reading --misread` on Windows 11 (i5-12400): the app's reading, detection and masking with these models in Vision's place, cells not read / leaked / over-masked / unlisted.

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

703 documents in 2 375 s: **not read 42, leaked 0, over-masked 5, unlisted 72** (Vision on the Mac, 0180: 221 / 0 / 11 / 263). With `--misread`: 21 misread and masked all the same, 0 misread and readable, 21 not found even without their marks. The first measurement, before the word ink and font size above, was 43 / 21 / 13 / 65. The text PDFs of the same seeds, re-measured after the change to `ocr.ts`: 546 documents, 0 / 0 / 0 / 0.

The five over-masked, one by one:

- `2/order/order-delivery-2`, the picture: "Giao giờ" in "Phí vận chuyển: 30.000 đồng. Ghi chú: Giao giờ hành chính.", read letter for letter as the text PDF has it; the pack masks it among the scan's paragraphs and not among the text PDF's.
- `4/form/form-application-2`, scan and picture: the motto "Độc lập - Tự do - Hạnh phúc" and the title "ĐƠN XIN VIỆC" under it are read as one paragraph, and the pack takes "phúc ĐƠN" for a name (two values over-masked in each).

**In the app.** `tauri dev` on the same PC with the gate opened locally (not committed), driven over WebView2's DevTools port: the sidebar lists PNG and JPG without "Sắp có"; seed 1's `contract-labour-1.png` opened on Tài liệu and was masked (organisation, tax code, phones, addresses, both names, birth date, ID card, e-mail, account); `payslip-table-1.pdf`, a picture-only PDF, was read in 10.6 s while the measurement above ran beside it, and masked to 9 places and 8 aliases, the company the model misread as "Cộng ty" included. In Chromium's WASM, with nothing else running, a page takes 3.4 s once the graphs are loaded; the first page also loads them (22 s from the dev server).

## Tilted and photographed pages

`scripts/rasterise-documents.mjs` gained `--tilt <degrees>` (each document turned by that much, alternately left and right) and `--photo` (paper `#ebe6dc` instead of white, the print blurred by 0.8 px, a shadow darkening one corner to about grey 170, grain of ±12), so the same documents and expectations can be measured as crooked scans and phone pictures.

Before any change, seed 1 (102 documents) through the app, not read / leaked / over-masked: 172 / 4 / 0 at 0.5°, 310 / 25 / 6 at 1°, 648 / 14 / 5 at 2°, and 517 / 33 / 7 photographed at 1.5°. The detector's boxes are upright, so a box around a leaning line takes in the next one. Three changes to `src/core/doc/reading.ts`:

- **The page is turned upright.** The detector's long regions (at least five times as wide as tall) each give a direction from the second moments of their pixels; their median, weighted by size, is the page's lean. A page leaning by more than 0.25° and less than 15° is turned back about its centre (bilinear, white where the turned page does not reach) and its lines found again; the words' places are the upright page's. At 0.1° the clean scans' payslip tables, which measure a false lean of 0.12° to 0.15°, were turned too, and the blur of turning them cost seven addresses (49 not read instead of 42).
- **A line's print height is measured against its own paper.** Ink is what is darker than halfway between the line's median grey and its darkest 2 %, rather than below a fixed grey, so blur and shadow do not thicken the band; a row inked all the way across is a rule; and the densest row counts as no denser than twice the middle inked row, so the bars of capital Ts ("STT" in a grey header cell measured at a fifth of its size) do not stand for the band. With the fixed grey, the photographed payslips' signature names joined the table and the first one leaked, as on the scans before the change above.
- **A line on shadowed paper is lifted.** The recogniser learnt on paper from grey 205 to white (`scripts/ocr-train/train.py`); a line whose paper (its 75th-percentile grey) is darker is scaled so that the paper reaches 230. In the shadowed corner of two photographed invoices "Mã số thuế" read as "Mã số thuố", so the tax code beside it was left without its label and leaked. A clean scan's paper is white and is not touched.

Then, the same measurement:

| Pages | Documents | not read | leaked | over-masked | unlisted |
| --- | --- | --- | --- | --- | --- |
| Upright, seeds 1–7 | 703 | 42 | 0 | 6 | 71 |
| Photographed and tilted 1.5°, seeds 1–7 | 703 | 42 | 0 | 6 | 65 |
| Tilted 0.5°, seed 1 | 102 | 4 | 0 | 1 | 9 |
| Tilted 1°, seed 1 | 102 | 9 | 0 | 2 | 12 |
| Tilted 2°, seed 1 | 102 | 3 | 0 | 1 | 6 |

The photographed 703 took 3 257 s; before the last two changes they were 49 / 6 / 5 / 91. The upright 703 are as before but for one more over-masked: in `5/order/order-receipt-1`, the scan, "Lý do nộp: Đặt cọc thuê văn phòng" is read letter for letter and the pack masks part of it, as with "Giao giờ" above. The six over-masked of the photographed pages are of the same two kinds: headings read verbatim that the pack takes for a value ("BIÊN BẢN BÀN GIAO TÀI SẢN", "Điều 2. Tiền lương", "Nhân viên" in a CV, scan and picture), and the motto joined to the title under it in `3/form/form-application-1`, the picture. On the tilted pages it is the motto again, joined to "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" in `1/decision/decision-benefit-2`. None is a misreading the reading could avoid; each is the pack's call on a heading.

## The owner's own scans

On 29 October 2026 the owner put four of their own documents on the PC, outside the repository; they were read there with the app's reading, detection and masking, and nothing of them is recorded here but what kind of thing was missed. One is a text PDF (masked in full, not a test of the reading). One is a colour JPEG scan of a business registration. Two are copier scans whose text is a fax-coded mask, which pdf.js was not decoding at all: [0182](0182-pdf-picture-decoders-inside-the-app.md) fixed that, and the findings below are after it.

They do not meet 0180's bar. Left unmasked, in kinds rather than counts, since they have no reviewed lists:

- **Form blocks with the labels in one column and the values, each after a colon, in the next** ("CCCD số / Ngày sinh / Số tài khoản" stacked beside ": … / : …"): two ID card numbers, two birth dates, an account number and a party's name where it first appears. The reader by place keeps the column of labels apart from the column of values, so no value follows its label. The synthetic documents never lay a form out so; it is a matter of the reader by place and detection, not of the recogniser, and Vision would give the same. Fixed in [0183](0183-forms-with-a-column-of-labels.md): such a block now reads one field a line, and those values are masked.
- **Signature names**: the two names under the signatures of one contract, masked above but read here with one letter different or in a line the pack did not take as names. Fixed in [0184](0184-signature-names-on-copier-scans.md).
- **Misreadings of a real copier's print**: a phone number and an e-mail address on the registration, read with slashes and wrong letters, so no longer a phone or an address; the end of a representative's name. A contract's price tables read poorly as a whole. Trained for in [0186](0186-recogniser-trained-on-copier-print.md): the phone and the e-mail address are now read and masked.
- **A photographed ID card** pasted on a contract's last page: its number and the machine-readable lines are not masked. Fixed in [0185](0185-copied-identity-cards.md).

Over-masked: "Sự Kiện Bát Khả Kháng" taken for an organisation about ten times, "Nam" (sex) for a name, and some misread words.

So the next work on pictures was the layout of label and value columns (done in 0183), then a check of signature rows (done in 0184), measured on synthetic documents laid out that way; then a recogniser trained also on the fonts and print of copiers (done in 0186); and ID cards, which need a reading of their own (done in 0185). Opening `readingShipped` waits for it.

## Dependencies

In the app: `onnxruntime-web` 1.26.0-dev.20260416-b7804b056c (MIT, Microsoft) is now a direct dependency, pinned to the version `@huggingface/transformers` 4.2.0 already resolves, so the lockfile gains no package; the worker imports its `webgpu` entry as Transformers.js does and uses the same `ort-wasm-simd-threaded.asyncify.wasm`. The two graphs ship in the app: the detector `ch_PP-OCRv4_det_infer.onnx` (Apache-2.0, PaddleOCR, as exported by RapidOCR; Hugging Face `SWHL/RapidOCR` at `1cfba2e90fc938db55889873735088de210cc173`, 4 745 517 bytes, sha256 `d2a7720d…`) and this decision's recogniser (7 258 670 bytes, `70c31d9f…`), the project's own work under the project's licence.

Training only; nothing below ships with the app. Locked in `scripts/ocr-train/uv.lock` (Python 3.12 through uv): PyTorch 2.14.1 (BSD-3-Clause), Pillow 13.0.0 (MIT-CMU), fontTools 4.68.0 (MIT), NumPy 2.5.4 (BSD-3-Clause), ONNX 1.23.2 (Apache-2.0), ONNX Runtime 1.31.1 (MIT), all from PyPI. The screen uses `onnxruntime-node` 1.24.3, `pdfjs-dist` and `@napi-rs/canvas`, already in the workspace. The detector is 0180's (`ch_PP-OCRv4_det_infer.onnx`, Apache-2.0, RapidOCR's export of PaddleOCR).

## Decided after the measurement

- **The recogniser is committed** (the owner, 29 October 2026): `desktop/reading/recogniser.onnx`, 7.3 MB, marked binary in `.gitattributes`. It is the one exception to the packs' rule that model weights stay out of the repository: it is small, it is the project's own work, and it ships inside the app rather than as a download, so a release build needs it at hand. A retrained recogniser replaces the file and its size and digest in `reading-v1.json` in one change.

## Not decided here

- **Opening it.** Opened by the owner on 31 October 2026 ([0191](0191-windows-reading-opened.md)), after 0182 to 0190. As written here: `readingShipped` stays off; the owner opens it. `landing/privacy.html` must then say so in the same change, with its "Cập nhật ngày …" line, and `tests/privacy-contract.test.mjs` checks for it. The sentence in §2 would become, for example: "… chữ trong ảnh được đọc ngay trên máy, không qua mạng: trên macOS 14 trở lên bằng bộ nhận dạng ký tự có sẵn của hệ điều hành (Vision của Apple), trên Windows bằng mô hình đọc chữ đi kèm ứng dụng (cài sẵn cùng OfflineMask, không tải thêm); ảnh không được lưu lại và không có trong bản đã ẩn, chỉ có chữ đọc được."
- **Macs before macOS 14** would also get this reading once the gate is on; it was measured on Windows only.
- **Real scans.** Four of the owner's own documents were read on 29 October 2026 ("The owner's own scans" above) and miss values; what they show is the next work, not decided here.
- **What happens to `media_ocr`**, the Windows.Media.Ocr engine of 0180, which no Windows machine can reach today.
