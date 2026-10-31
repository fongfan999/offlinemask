# 0180 — Scanned PDFs and images read on the machine (phase 2 of 0149)

Date: 28 October 2026. Status: designed, built, measured and run in the app on this date; on for macOS 14 and later by the owner's decision the same day (see "What ships"). Follows [0149](0149-text-pdf-documents.md), which parked scanned PDFs and images because both need text recognition (OCR).

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

With the gate on, `landing/privacy.html` §2 says that for scanned PDFs and images the text is read by the operating system's own text recognition (Apple's Vision on macOS 14 and later), on the machine and not over the network, that the picture is not kept and is not in the masked copy, and that Windows has none yet, with the page's date. `tests/privacy-contract.test.mjs` pins both states: the native module uses Vision and nothing that reads files, runs programs or connects, no OCR library is a dependency, and the page carries those sentences exactly when `ocrShipped` is true and not before.

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

**The 12 leaks, one by one** (the owner asked for each: what the engine read, and where the fix belongs). Eleven are in scanned PDFs, one in a picture; eight are in the `statement-classic` layout, which is two pages and so measured only as a PDF.

| Document | Value | What was read | Cause and where the fix belongs |
| --- | --- | --- | --- |
| seed 4 `statement-classic-1` | 821646066891, 429230299662, 092686411194, 59328774885 | `01/10/2026\tBUI MINH THAO chuyen tien den TK FT26894030217 821646066891 DO QUOC KHANG` | The reference landed inside the description cell, so "TK" was followed by the reference, not the account. The row's description wraps on two lines around the date and reference; one row of the table read "FT26550339030 Phi …" as a single word because the gap between the reference and the description (1.2 font sizes) was under the cell-gap threshold, and that one word bridged the gutter, which merged the two columns for the whole table. **Word placement**: the threshold is now a third of the line box or 1.2 glyph heights (was a half and 1.5). |
| seed 4 `statement-classic-2` | 27966360409821, 062925589888 | `VU MINH SON chuyen tien den TK 19/10/2026 FT26973158422 27966360409821 DANG THU NHUNG` | The same merged columns: date and reference inside the description. **Word placement**, as above. |
| seed 7 `statement-classic-2` | 692941092420 | `17/10/2026\tHUYNH MINH NHUNG chuyen tien den TK FT26011024013 692941092420 VU HOANG AN` | The same. **Word placement**. |
| seed 2 `statement-classic-2` | 96873162835 | `NGUYEN QUOC PHUC chuyen tien den T 96873162835 LY HUU KHANG` | The value is read; the "TK" before it was read "T", so the account rule's label was gone. **A detection rule that tolerates the noise**: after "chuyen tien den" or "chuyen khoan den", a number of six digits or more is an account whatever one short token sits between (`banking.ts`); with "TK" there the existing rule already has it. |
| seed 3 `statement-classic-1` | NGUYEN MINH HUNG | `41786 FT NGUYEN MINH HUNG(` (the text PDF: `VU HUU VIET chuyen tien den TK 4179866071 NGUYEN MINH HUNG`) | The name is read; everything before it was destroyed, so no transfer cue is left in the cell. The same name is read and masked in two other rows. **A masking rule that tolerates the noise**: a value hidden once is hidden wherever else it appears whole in the document, with the same alias (`repeatedValues` in `mask.ts`): a name of two words or more, or six characters with a digit, at word boundaries, losing to any detection at the same place. This is the document-wide counterpart of the text readers joining a value across a line break. |
| seed 3 `contract-labour-1` (scan and picture) | 0932732371 | `Địa Điện chỉ thoại: thư n932 093273237136 25/19 Nguyễn Tri, …` (the text PDF: `Điện thoại: 0932732371 · Email: hung.dang99@gmail.com`) | The engine read the two-column form row with the words of both columns interleaved and the phone number glued to two more digits: the value as read is `093273237136`, which is not the value. **Classification**: the measurement found the value inside the longer digit run and called it leaked; a value that starts or ends with a letter or digit must now be found whole (`document-evaluation.mjs`), so this is "not read", the engine's. |
| seed 6 `contract-labour-1` | 0887172791 | `Địa Điện chỉ thoại: thường 0887172791trú:231 đường Hoàng Diệu, …` | The same interleaving, the phone glued to "trú". **Classification**, as above: not read. |

So seven of the twelve were one placement defect, one was a label the engine misread, one a cue the engine destroyed, and three (two documents) were misreads of the value itself that the measurement had misfiled. Each change was then measured on all 703 scans and on the text PDFs of seeds 1–7 and the owner's sets, which must not move from the shipped baseline (all zeros on the synthetic seeds; the one bank name in the owner's draft invoice expectation).

**After the fixes**, four more changes measured the same way, each on all 703 scans and on the text PDFs of seeds 1–7 and the owner's sets:

- **Cell gap** (word placement, `ocr.rs`): a third of the line box or 1.2 glyph heights, not a half and 1.5. The seven statement leaks went: the reference and description read as two cells again.
- **Transfer-account rule** (`banking.ts`): "chuyen tien den T 96873162835" masks the account.
- **Repeated values** (`mask.ts`): a name of two words or more, or six characters with a digit, hidden once is hidden wherever else it appears whole. A first version repeated places and organizations too, and over-masked 28 phrases ("Thành phố Hồ Chí Minh" inside "Ủy ban nhân dân Thành phố Hồ Chí Minh", which 0159 keeps); limited to names and numbers it over-masks nothing on the text PDFs.
- **Columns bridged once** (`pdf.ts`, `splitBridged`): one row's glued word ("T26327506902: Rut tien ATM tai VPBank 9592", or "21/10/2026|FT26203861639" with a table rule read as a bar) had merged the reference and description columns, or the date and reference columns, for a whole table. A column span is now split at a gutter at least four fifths of the rows' typical font size wide that at most one row's words cover, with two rows or more on each side; and a bar inside a recognised word parts it (`unbar`), the rule keeping a letter and a half of width so the parts stand apart. The last three leaks went.
- **Classification** (`document-evaluation.mjs`): a value found only glued to a letter or digit is not read, not leaked.
- **Skew** (`ocr.rs`, `Deskew`): found while preparing the app check, not by the measurement. A photographed page is tilted, and a 1.4° tilt scattered a line's words over rows and tabs (the words of one line sloped past the half-size baseline tolerance). Vision reports every observation's four corners, so the page's skew is the median angle of its longer lines, and every box, the recogniser's and the detector's, is turned back by it about the picture's centre before any layout. The command and the worker message now carry the picture's size, which the angle needs. The photographed form then reads as clean paragraphs.

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

The text PDFs of seeds 1–7 stay at 0 / 0 / 0 / 0 (546 documents), the owner's decision at 0 and the owner's invoices at 0 / 1 / 0 / 0 (the bank name in a draft expectation, as before): the shipped baseline does not move.

The over-masked that remain are the engine's misreads of a heading or a label, each in the text PDF clean: "Sách Đắc Nhân Tâm" under a heading read "Sản phấm" (seeds 1 and 7, scan and picture), "Ốc Hương Thiên Nhiên", "OLALA Trứng Gà Sạch hộp 10" and "Nước mắm Phú Quốc chai 500ml" under goods headings read wrongly, "Chuyên viên nhân sự" after a label read wrongly, "TRƯỞNG CÔNG AN PHƯỜNG" and two place-and-date lines ("Thành phố Hà Nội, ngày 7 tháng 12 năm 2026") in pictures of decisions where the body's name above was misread. The seven misread-and-readable values are the engine's too: five e-mail addresses with one wrong letter and one name, in a scan and its picture.

**Checked in the desktop app** (`tauri dev` of this worktree under its own identifier beside the owner's running copy, driven through accessibility and captured window by window; screenshots under `desktop/artifacts/e2e/screenshots/`, not committed). A photographed form (the rasterised `form-application-1` turned 1.4°, resized, noised and saved as JPEG) and a scanned contract (`contract-labour-1` as a picture-only PDF) each opened on Tài liệu through the file picker, were read by Vision through the worker bridge, masked (10 places, 9 aliases; 17 places, 14 aliases), saved as `(OfflineMasked).md` (text alone, no picture) and restored from that copy at step 3 (10 and 17 aliases). The first attempt on the scan failed with "Chưa đọc được tệp này": pdf.js constructs the canvas factory with `new`, and the worker's factory was a plain object, so `getDocument` threw before any page was drawn; Node never reaches that code, having no `OffscreenCanvas`. It is a class now, with a test that stubs `OffscreenCanvas`. One reading quirk seen in the app and not in Node on the same file: the form row "Chức vụ: Giám đốc" came out as inline cells "Chức · vụ: Giám · đốc", the glyph gaps of WebKit's drawing of the page falling on the other side of the cell threshold; the values beside it were masked all the same.

## What ships

**On macOS 14 and later, scanned PDFs and PNG/JPEG pictures open on Tài liệu and are masked**: the owner opened the gate on 28 October 2026, once the 703 scans and pictures of seeds 1–7 leaked nothing where the text PDFs leak none, every misread value the reader finds was masked, the over-masked were the engine's misreads of headings and labels (listed above), and the feature had run end to end in the app on this Mac. `ocrShipped` in `src/adapters/ocr.ts` is `true`; `landing/privacy.html` §2 says the picture is read on the machine by the system's own recognition and never kept, dated 28 October 2026, and `tests/privacy-contract.test.mjs` checks the page against the gate in both states. The sidebar's "Hình ảnh · Sắp có" goes on those Macs. What the user should know, the note above the preview says: the engine reads about one private value in twenty wrongly on these scans, so the masked copy is to be reviewed before it is sent.

**Windows and macOS before 14 keep "Sắp có"** with a message naming the reason. Nothing reads Vietnamese on Windows yet; the decision is the owner's: Windows.Media.Ocr (the system's engine, which reads Vietnamese only once the user installs the Vietnamese language pack in Windows) measured on the owner's Windows PC with the scripts of this decision, or Mac-only for now. Tesseract, the engine that would run everywhere, misreads one private value in ten on clean renders and is not a floor to ship on; VietOCR as a downloaded pack is the candidate if an OS engine is not good enough.

**Not changed:** `landing/product.html` still says "Hình ảnh thì chưa"; as 0149 did, it changes with the release that carries the feature, since pushing to main deploys the site before the app can do it.

## Dependencies

- `objc2-vision` 0.3.2 (Zlib OR Apache-2.0 OR MIT; 4 October 2025), with `objc2-core-foundation` 0.3.2 for the geometry types, macOS only; `objc2-foundation` gains its `NSDictionary`, `NSEnumerator`, `NSError` and `NSRange` features. The same generation as the `objc2` crates already used.
- `@napi-rs/canvas` 1.0.13 (MIT) as a development dependency: pdf.js draws pages in Node through it, for the rasteriser and the measurement. It was ignored as pdf.js's optional dependency since 0149, when nothing drew; the app's worker draws with `OffscreenCanvas` and never loads it.
- Context7 was not available in this session; the Vision API was checked against the crate's documentation and a Swift probe, and pdf.js's drawing options against the package's type declarations.

## Windows

Checked on the owner's Windows PC (Windows 11 Pro 10.0.26200, 28 October 2026). **Windows.Media.Ocr does not read Vietnamese**, so the premise above, that it does once the language pack is installed, does not hold:

- Settings › Time & language › Language & region › Tiếng Việt offers the language pack, text-to-speech, handwriting and basic typing, and no optical character recognition feature; after installing Tiếng Việt, `OcrEngine.AvailableRecognizerLanguages` lists `en-US` alone and `C:\Windows\OCR` holds `en-us` alone.
- The English recogniser on the picture of seed 1's `contract-labour-1` writes 0 of the 45 tone-marked vowels, nor ă â đ ê ô ơ ư, in 1 280 characters: "CONG HÖA xÄ HÖI CHÜ NGHiA VIET NAM", "Büi Thanh Nhung", "Nguyén Thi Minh Khai". Like PaddleOCR's Latin models it cannot write the language, so it is not measured on the 703 scans: no value with a Vietnamese letter could be read verbatim, and a name read "Büi" is a name the policy may not mask.

What is built: the native module's Windows side (`media_ocr` in `src-tauri/src/ocr.rs`, the `windows` crate's `Media_Ocr`, `Graphics_Imaging`, `Storage_Streams`, `Globalization` and `Foundation_Collections` features, no other dependency): the picture decoded in memory by `BitmapDecoder`, read by `OcrEngine.TryCreateFromLanguage` with the Vietnamese recogniser, each word with the engine's own box (no second pass as on macOS, the boxes are the glyphs'), the page's reported `TextAngle` turned back as the Mac turns back Vision's corners. `available()` is true only where Windows lists a recogniser whose tag starts with `vi`, which today is nowhere; and `ocr_available` also requires `WINDOWS_SHIPPED`, off, so a future Windows that lists Vietnamese changes nothing until it is measured with `ocr-check` (renamed from `ocr-vision-check`) and the scripts above, and the privacy page says so (`tests/privacy-contract.test.mjs`). On Windows the app keeps "Hình ảnh · Sắp có" and its messages.

So Windows needs an engine of its own: VietOCR as a downloaded pack (MIT, 150 MB, see the candidates), measured against Tesseract's floor and the bar of this decision, or Mac-only for now. The owner's decision.

VietOCR read below Tesseract (see the evaluation), and OfflineMask's own recogniser took its place: [0181](0181-own-line-recogniser-for-windows.md), built into the app behind its own gate and measured to this decision's bar on all 703 scans (0 leaked).

## Not decided here

- **Windows.** Windows.Media.Ocr has no Vietnamese recogniser (see "Windows"); [0181](0181-own-line-recogniser-for-windows.md) reads pictures with OfflineMask's own models instead, off until the owner opens it.
- **Pages in old fonts** (0149's `old-font`) could be drawn and read like scans, which may read them better than their text layer; unmeasured.
- **Skewed or photographed pages:** Vision reads them, but the layout step assumes lines run across the page; a photo at an angle reads line by line without its tables.
- **HEIC and WebP** pictures stay "upcoming": Vision reads both, but the picture's size would need decoding in the worker.
