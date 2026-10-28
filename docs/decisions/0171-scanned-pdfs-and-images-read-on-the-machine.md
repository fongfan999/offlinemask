# 0171 — Scanned PDFs and images read on the machine (phase 2 of 0149)

Date: 28 October 2026. Status: designed, built and measured on this date; gated off (see "What ships"). Follows [0149](0149-text-pdf-documents.md), which parked scanned PDFs and images because both need text recognition (OCR).

## Problem

A page without text, a copier's PDF, a photo of a form or a screenshot of a table, has nothing for the detector to read, so nothing is masked. 0149 refuses an all-scanned PDF and leaves scanned pages out of a mixed file. People have such files for exactly the documents OfflineMask is for: contracts, statements and identity papers that reach them as scans.

The bar is the one 0149 set: the text in the picture is masked exactly as a text PDF's is, and the masked copy is the same text-only Markdown, so nothing hidden in the original, least of all the picture itself, can follow it to the AI. Everything runs on the user's machine; a new model download would have to follow the recognition-pack pattern and change the privacy page.

## Candidates, measured

Vietnamese print needs all of its letters: 45 lower-case tone-marked vowels (ạ ả ấ … ỹ) beyond ă â đ ê ô ơ ư. An engine that cannot produce them reads "Điều" as "Dieu" at best. Every candidate was checked for that first, then the ones that could run here were measured on the same pages: the 54 pages of seed 1 of the synthetic document set ([0153](0153-synthetic-document-set.md), [0160](0160-wider-synthetic-set.md)) rendered at 200 dpi, scored by how many of the expectation lists' values each engine read verbatim (squeezed whitespace), which is the "not read" bucket of the document measurement without the layout step.

| Engine | Licence | Vietnamese letters | Runs on | Hide values read | Keep values read |
| --- | --- | --- | --- | --- | --- |
| Apple Vision (`VNRecognizeTextRequest`, accurate, `vi-VT` + `en-US`) | OS framework | all | macOS 14+ | 430 / 440 | 622 / 650 |
| Tesseract 5.5.1, `vie` (tessdata_fast), page segmentation 3, 200 dpi | Apache-2.0 | all | everywhere (WASM through tesseract.js) | 385 / 440 | 556 / 650 |
| same at 300 dpi | | | | 395 / 440 | 541 / 650 |
| Tesseract `vie` (tessdata_best) | Apache-2.0 | all | | 368 / 440 | 523 / 650 |
| PaddleOCR PP-OCRv5 `latin` recognition (ONNX, 7.9 MB) | Apache-2.0 | ư, ơ, đ only: 0 of the 45 tone-marked vowels in `ppocrv5_latin_dict.txt` | everywhere (ONNX Runtime) | not run | |
| PaddleOCR PP-OCRv6 tiny / small / medium (ONNX) | Apache-2.0 | 1 of 45 in `ppocrv6_dict.txt`, 0 in the tiny dictionary | | not run | |
| PaddleOCR PP-OCRv3 `latin` | Apache-2.0 | 0 of 45 (`latin_dict.txt`) | | not run | |
| `tieubaoca/pp-ocrv6-medium-rec-vietnamese` (Hugging Face) | none stated | all | | not run: no licence | |
| VietOCR (`vemines/vietocr-onnx`, MIT; encoder 114 MB, decoder 40 MB) | MIT | all | everywhere | not run | |
| Windows.Media.Ocr (Windows, needs the Vietnamese language pack installed in Windows) | OS component | all | Windows | not run: no Windows machine here | |

What the numbers say:

- **Apple Vision** reads 98 % of the private values and 96 % of the kept phrases verbatim, in 0.7 s a page. Its misses are systematic and few: "Điều" read as "Điêu" (the grave under ê lost), "Tiền" as "Tiên", and one or two values a page split by a table rule read as "|".
- **Tesseract** loses 10–16 % of the private values. Its Vietnamese model adds and drops tone marks ("Ngân hàng TMCP Đầu tư và Phát triển" came out "Ngôn hùng TMCP Đầu tư và Phút triển"; "VU KIM YEN" in a transfer line became "VŨ KIM YEN") and misreads digits in statement rows ("2025785671709" for "54025785671709", "11o2soo2so7g"). A value misread is a value that reaches the AI unmasked, so this is not a floor to ship on, and the `best` model and a higher resolution do not change it. It stays the measured reference for a platform without a system engine.
- **PaddleOCR**, the "ONNX pair through the existing runtime" the task named, cannot write Vietnamese: PaddleOCR lists `vi` under its Latin group, but the Latin dictionaries of every generation (v3, v5, v6) lack the tone-marked vowels, so the models cannot output them. The one Vietnamese fine-tune found has no licence. VietOCR is licensed and capable but is a 150 MB sequence-to-sequence pair with autoregressive decoding, a different runtime path from the pack's token classification; it would be the candidate for a cross-platform engine and is left unmeasured here.
- **Windows.Media.Ocr** is the Windows counterpart of Vision, but it reads Vietnamese only once the user installs the Vietnamese language pack in Windows, and it could not be measured on this Mac.

## Decision

### Engine: the operating system's own, Apple Vision on macOS

OfflineMask reads text in pictures with **Apple's Vision framework** (`VNRecognizeTextRequest`, accurate level, language correction on, `vi-VT` first and `en-US` second), through the Rust `objc2-vision` bindings in a native module `src-tauri/src/ocr.rs`. Vision runs on the device; Apple documents the request as on-device and the app's content-security policy and network tests still allow no other connection. There is **no model download**, no change to the recognition pack and no new system permission: reading a picture needs none.

**Windows and older macOS keep "Sắp có".** `ocr_available` reports whether the machine reads Vietnamese (Vision lists it from macOS 14); where it does not, the sidebar's "Hình ảnh · Sắp có" item stays, pictures are refused with "Máy này chưa đọc được chữ trong hình ảnh: cần macOS 14 trở lên; trên Windows sắp có." and a scanned PDF with the matching wording. The Windows engine is a decision of its own: Windows.Media.Ocr measured on the owner's Windows PC with the scripts below, or VietOCR as a downloaded pack if an OS engine is not good enough.

Why not a cross-platform engine now: the only one that could run everywhere and be measured here, Tesseract, misreads one private value in ten on clean renders. Shipping it would make "masked" mean less on Windows than on macOS, which is worse than "coming".

### How a page becomes text

1. **A PDF page without text** (fewer than five characters, as in 0149) is drawn once with pdf.js at 200 dpi, the resolution office copiers use, into an `OffscreenCanvas` in the files worker (a canvas factory of our own, since pdf.js's default needs a document) and encoded as PNG. A page longer than 4 000 px on a side is scaled down. Pictures in the file may now be decoded (`maxImageSize` is unlimited when recognition is on), but only a drawn page decodes them; text pages are read as before.
2. **An image file** (PNG or JPEG, told by its first bytes, up to 20 MB and 25 million pixels) goes to the engine as it is; its size comes from its header, nothing is decoded in JavaScript.
3. The worker cannot call native code, so it posts the picture to the main thread (`ocr` message), which invokes `ocr_page` and posts the lines back (`ocr-result`); the same bridge pattern as the detection worker's native recognition. The picture is held for the call and released.
4. **Words with places.** Vision's recogniser returns one observation per line with a box, and a box for any character range of its text; but those part boxes are even divisions of the line, not the glyphs' places (checked letter by letter: every letter of a word gets the word's box, and a cell gap is as wide as a word space), and the line box itself is padded (a lone short word gets a box twice its width). So the native module performs a second request on the same picture, Vision's text-rectangle detector with character boxes, which are tight. Each recognised line is split at its spaces into words (the space kept on the word, so the reader knows the engine saw one); the detector's glyphs on that line, left to right, fall into cells at the wide gaps (wider than half the line's box height or one and a half glyph heights, whichever is more: a word space is a third of the font size, a cell gap two thirds or more); the words are shared out over the cells in the glyphs' proportion, at word boundaries, except beside a word without a letter or digit (a dash the detector did not box leaves a gap that is not a cell's); and each cell's words are spread over the cell's true extent. A line the detector did not see keeps the recogniser's boxes.
5. **Font size.** The boxes are still no measure of the font (the same print gets line boxes from 1.3 to 2 times its size), so the size of a line is estimated from the room its letters take: each kind of letter at the width it has in the document fonts, a least-squares fit over 2 628 pieces of the text PDFs (`advances`: small letters 0.571 of the size, capitals 0.731, digits 0.611, other marks 0.366), which puts 90 % of lines within ±8 % of their size; a single average put 90 % within ±12 %, and the footer of an invoice in capitals came out a fifth too large, enough to band two wrapped lines into one table row. The words then become pdf.js-shaped text items (`ocrTextItems`) and take 0149's path unchanged: lines by baseline, a gap wider than the font size a tab, tables laid out by column, "Label: value" forms inline, lines into paragraphs. A word that is only a bar is a table rule read as text and is dropped. On the bank statements of the synthetic set, the result reads cell for cell like the text PDF's, down to the date and reference columns.
6. The page's kind is `scanned` (read by recognition), or `blank` when the engine found nothing (an empty page or an unreadable picture), beside 0149's `text`, `old-font` and `no-text` (no recognition on this machine). The masked Markdown is written from the paragraphs alone, as before, with a placeholder line for a blank page; a scanned page that was read needs none.

### What the user sees

- The drop zone and picker on Tài liệu, the home page's start box and the Finder service (`public.png`, `public.jpeg`) accept PNG and JPEG where the machine reads them; the sidebar's Tài liệu entry reads "DOCX, ODT, PDF, PNG, JPG" and the "Hình ảnh · Sắp có" item goes.
- "Đang đọc trang 12 / 300" with Hủy, from 0149, covers the slow part: a scanned page costs about a second (0.7 s in Vision, the rest drawing), so a 300-page scan takes about five minutes and Hủy stops at the next page.
- Above the preview: "Trang 2, 5 là ảnh scan: chữ được đọc bằng nhận dạng ký tự nên có thể sai sót. Hãy xem lại bản đã ẩn trước khi gửi." (or the whole-file wording for an all-scanned PDF or a picture), and "Trang 3 không có chữ đọc được (trang trống hoặc ảnh quá mờ)" for a blank page. The "Tệp có N hình ảnh" note counts only pictures that were not read.
- A picture's session is a document session like a PDF's: its masked copy is `<tên> (OfflineMasked).md`, Sao chép copies the Markdown, and restore takes the AI's `.md`, `.txt`, `.docx` or `.odt`.

### Privacy page

While the gate is off nothing changes for users and `landing/privacy.html` stays as it is. When it ships, §2 says that for scanned PDFs and images the text is read by the operating system's own text recognition (Apple's Vision on macOS 14 and later), on the machine and not over the network, that the picture is not kept and is not in the masked copy, and that Windows has none yet, with the page's date. `tests/privacy-contract.test.mjs` pins both states: the native module uses Vision and nothing that reads files, runs programs or connects, no OCR library is a dependency, and the page carries those sentences exactly when `ocrShipped` is true and not before.

## Measurement

The same expectation lists judge recognised documents. `scripts/rasterise-documents.mjs` turns a folder of the synthetic set's PDFs into scans: every page drawn with pdf.js at 200 dpi, written back as a JPEG (quality 80, a copier's choice) in a PDF of pictures alone, no text layer; a one-page document is also written as a PNG beside it, which measures the image route. `pnpm eval:documents` lists `.png`/`.jpg` beside the documents, routes pages without text to the app's own engine through `src-tauri/target/release/ocr-vision-check` (built with `--features recognition-evaluation`; `scripts/ocr-runtime.mjs`), and with `--misread` looks again at every value not read: letters and digits without their marks are searched for, and the value is reported as "misread, masked" when what was read is fully masked all the same, or "misread, readable" when it would reach the AI, the count that matters.

Seeds 1–7 of the synthetic set (364 PDFs; 339 of them one page, also as pictures), text PDFs against their scans, with the installed shipping pack:

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

**How the layout work changed the numbers**, on seed 1's scans and pictures (102 documents; the text PDFs of seed 1 are 0 / 0 / 0 / 0):

| Reading | not read | leaked | over-masked | unlisted |
| --- | --- | --- | --- | --- |
| Vision's lines as pdf.js items, the box height as font size | 26 | 25 | 6 | 32 |
| plus words from Vision's part boxes, size from the letters' room | 29 | 7 | 5 | 34 |
| plus cells from the text detector's glyph boxes | 21 | 2 | 2 | 28 |
| plus letter widths by kind, tight extents, no cell beside a dash | 21 | 0 | 2 | 28 |

The 25 leaks of the first reading were all in bank statements, whose rows had banded together and whose cells had glued; the account and phone numbers in them were read but no longer looked like a statement's cells to the policy. The last reading reads those statements cell for cell like the text PDF.

**What the remaining counts are.** The not-read values are the engine's, not the reader's: with `--misread`, 16 of 21 are read with a wrong letter or tone mark ("Trân Hưng Đạo" for "Trần Hưng Đạo", "Vận tái" for "Vận tải") and masked all the same, 0 are misread and readable, and 5 are not found even without their marks (a company name and two phone numbers the engine dropped a digit or a word from, a name read "Dơng Quốc Đạt", an account number under a table rule). The 28 unlisted values are those misread forms, masked: the lists hold the true spellings. The two over-masked are one book title, "Sách Đắc Nhân Tâm", in an order's table, once in the scan and once in the picture of the same page: the engine read the column heading "Sản phẩm" as "Sản phấm", so the rule that keeps goods under a goods column did not apply and the title was masked as a name. That is the engine misreading a heading, not a weaker policy; the text PDF of the same order is clean.

## What ships

Nothing, yet. The bar was 0149's: no leak where the text PDFs have none, and the scans of seeds 1–7 leak 12 values where the text PDFs leak none. Rather than lower the bar, the feature is **built, measured and gated off**: `ocrShipped` in `src/adapters/ocr.ts` is `false`, so `ocrAvailable` reports no recognition on every machine, pictures and scanned PDFs are refused with the messages above, the sidebar keeps "Hình ảnh · Sắp có", and `landing/privacy.html` is unchanged; `tests/privacy-contract.test.mjs` checks the page against the gate in both states, so turning the gate on without the page fails the gate. Everything else is in place: the native module and its commands, the worker bridge, the readers, the Finder service types, the measurement scripts and this record.

To ship it, in this order:

1. Fix the reference-column placement on wrapped statement rows (the seed 4 case) and re-run `eval:documents` on `artifacts/seeds-scanned --misread`. The layout defect's share of the leaks is five; the engine's seven remain.
2. Decide on the engine's misreads with the owner. They are Vision's, not the reader's: a dropped digit in one account number in twenty on the statements, a two-column form row read as one. On these scans they leave 7 of about 3 000 private values readable and make 7 more leak through the policy; the note above the preview tells the user to review the masked copy, which is what the review step is for. If that is acceptable, set `ocrShipped` to `true`, add the §2 sentences to the privacy page (the test names them) with its date, and remove the "Sắp có" item where the machine reads pictures (the code already does); if not, the engine on macOS is the ceiling, and the alternative is a Vietnamese model of our own (VietOCR as a pack), measured the same way.
3. Check the desktop app end to end (`pnpm desktop:dev`: a scan dropped on Tài liệu through the worker, the main thread and `ocr_page`), a real copier scan and a phone photo, and the Finder service with a picture. **Checked here:** the worker path the app uses (an `OffscreenCanvas` with a 2d context, `convertToBlob` to PNG, `Path2D`, `ImageData` and `createImageBitmap` inside a worker) exists in the system WebKit of macOS 26.6, through a `WKWebView` probe.

On Windows and on macOS before 14 nothing changes in any case: no engine reads Vietnamese there yet.

## Dependencies

- `objc2-vision` 0.3.2 (Zlib OR Apache-2.0 OR MIT; 4 October 2025), with `objc2-core-foundation` 0.3.2 for the geometry types, macOS only; `objc2-foundation` gains its `NSDictionary`, `NSEnumerator`, `NSError` and `NSRange` features. The same generation as the `objc2` crates already used.
- `@napi-rs/canvas` 1.0.13 (MIT) as a development dependency: pdf.js draws pages in Node through it, for the rasteriser and the measurement. It was ignored as pdf.js's optional dependency since 0149, when nothing drew; the app's worker draws with `OffscreenCanvas` and never loads it.
- Context7 was not available in this session; the Vision API was checked against the crate's documentation and a Swift probe, and pdf.js's drawing options against the package's type declarations.

## Not decided here

- **Windows.** Windows.Media.Ocr, measured on a Windows machine with the scripts above, or a downloaded pack with a licensed Vietnamese model (VietOCR) if the OS engine is not good enough. Tesseract's numbers above are the floor a candidate must beat.
- **Pages in old fonts** (0149's `old-font`) could be drawn and read like scans, which may read them better than their text layer; unmeasured.
- **Skewed or photographed pages:** Vision reads them, but the layout step assumes lines run across the page; a photo at an angle reads line by line without its tables.
- **HEIC and WebP** pictures stay "upcoming": Vision reads both, but the picture's size would need decoding in the worker.
