# 0149 — PDF files that contain text (phase 1)

Date: 25 October 2026. Status: steps 1–4 and 6 of the plan implemented on 25 October 2026, so the app opens PDFs on the Tài liệu page; step 5 (a PDF sample) not started. Owner: "what should we do next?" for PDF and images → PDFs that already contain text first; scanned PDFs and images later, together, because both need OCR. This record is the plan for phase 1; "Reader: what was built and measured" and "In the app" record what implementation found, including where it changed the plan.

## Problem

Text, spreadsheets and Word are masked; PDF is the format people most often have for contracts, statements, invoices and CVs, and it is still "Sắp có" in the sidebar (decision 0087). PDF is harder than Word in two ways:

1. **Masking a PDF in place is easy to get dangerously wrong.** Drawing a black box over a name hides it on screen, but the name stays in the page's content and can be selected, copied, searched or read by any AI that reads the file. The same goes for the document's metadata, bookmarks, annotations, form fields, attachments and earlier revisions kept by incremental saves. A copy that looks masked but is not is worse than no feature.
2. **Some PDFs have no text at all.** A scanned PDF is a picture of each page. Without OCR there is nothing to read, so nothing to mask.

## Decision

### Output is masked text, not a rebuilt PDF

Phase 1 reads the text out of the PDF, masks it with the same detector and alias book as Word, and gives back **text**: "Sao chép" and "Tải tệp đã ẩn" saving `<tên> (offlinemasked).md` (the suffix was "(đã ẩn)" until [0150](0150-offlinemasked-suffix.md)). It does not write a PDF.

This is how the redaction is true: the output is built **only from the text we extracted and masked**. Nothing from the original file is copied across, so nothing can ride along. The original name never reaches the output under a box, there is no metadata, no annotation, no attachment, no hidden layer, no earlier revision, no embedded font or image. What the user sends to AI is exactly what the preview shows.

Why not a masked PDF in phase 1:

- **Rewriting the page's text** means editing content streams and fonts. PDFs embed only the glyphs they use, so an alias like "Người_3" often cannot be drawn in the original font; text is positioned glyph by glyph and a longer alias overflows its place. Done badly it leaves the original glyphs in the stream.
- **Turning each page into an image with boxes** removes the text for real, but the AI then has to OCR the picture, which is slower, worse at Vietnamese and costs the user tokens; and the file grows many times.
- **A proper redaction engine** (MuPDF's redaction removes the text, images and vector content under a box) is AGPL-3.0, which does not fit the project's licence, and is a native library per platform.

People mask to send the content to AI, not the layout, and AI reads Markdown well. A layout-preserving masked PDF is recorded under "Not decided here".

### Reading

- **Library:** Mozilla's pdf.js (`pdfjs-dist`, Apache-2.0), loaded only when a PDF opens, run inside `files.worker.ts` so the document stays in RAM in the worker like Word and spreadsheets. It is plain JavaScript and the same on every platform; PDFium through Rust would need a native library per platform in the release builds (decision 0104) for no gain at this stage. Pick the version and the worker setup (pdf.js normally starts its own worker; inside ours it must not) with Context7 at implementation, and record the version, release date and licence in the implementing decision as 0078 did for JSZip.
- **What is read, in this order per page:** the page's text, then form field values, then the text of annotations (comments, notes). Each page starts with a `## Trang N` heading so the AI and the user can find their place. Bookmarks and the document title are not read, because the output does not carry them.
- **Lines and spaces:** pdf.js gives text items with positions. Items on the same baseline join into a line; a gap wider than a fraction of the font size becomes a space (many PDFs draw words without space characters); a larger vertical gap starts a paragraph. Items in clear columns are read column by column; tables come out as lines with tabs between cells. This is best effort and is checked with fixtures, not promised.
- **Vietnamese:** text is normalised to NFC, since PDFs often store "ệ" as a base letter and combining marks. Words split across lines ("Nguyễn Văn" ⏎ "An") are joined for detection the same way a Word paragraph is.
- **Invisible text** (render mode 3, the OCR layer some scanners add) is read like visible text. It is what the AI would read, so it must be masked too.
- **Limits:** up to 20 MB like Word, and up to 300 pages ("PDF dài hơn 300 trang. Hãy tách thành các tệp nhỏ hơn rồi thử lại."); larger files get a message instead of a slow, memory-heavy run. Pages are read one at a time and released, so a long PDF does not sit in memory twice.

### What we tell users about scanned PDFs

A page counts as having no text when it has fewer than five characters (a page number at most). Telling a scanned page from a blank one would mean asking pdf.js which pictures the page draws, which decodes them (see below), so both get the same honest wording: "no readable text, usually a scan".

- **Every page scanned:** the file does not open. In the start box and on the Tài liệu page: "PDF này là ảnh scan nên OfflineMask chưa đọc được chữ. Hỗ trợ ảnh scan sắp có."
- **Some pages scanned:** the file opens. Above the preview: "Trang 3, 7 không có chữ đọc được (thường là ảnh scan). Bản đã ẩn sẽ không có nội dung các trang này." Runs are shortened ("Trang 3, 5–7, 9"). In the output those pages appear as `## Trang 3` followed by `(Trang không có chữ đọc được, thường là ảnh scan — không có trong bản đã ẩn)`, so the AI and the user see the gap instead of silently losing a page.
- Because the output is text built from what we read, a scanned page can never leak through: its picture is simply not in the output. The message is about completeness, not about risk.

### Images inside a PDF that has text

Most text PDFs also carry pictures: a logo, a signature, a stamp, a photo of an ID card pasted into a form, a screenshot of a table. Phase 1 does not read them, and the output, being text, does not contain them.

- **No leak:** a CCCD photo or a signature in the original is not in the masked copy, because nothing but extracted text goes there. This is the same property that makes scanned pages safe.
- **But it may be missing something the AI needs,** such as a table pasted as a screenshot. The user is told once per file, without opening or decoding any picture: "Tệp có 2 hình ảnh. Hình ảnh không có trong bản đã ẩn; nếu trong ảnh có chữ cần gửi, hãy gõ lại."
- **Small images are ignored** for this notice: under 200,000 pixels (about 450 × 450), which leaves out logos, icons and bullets drawn as images, or nearly every business PDF would carry the warning and people would stop reading it. A logo saved at print resolution can still pass this size.
- **Per file, not per page, because per page costs too much.** The plan hoped to name the pages with pictures. pdf.js can only say which pictures a page paints by building the page's operator list, and that decodes every picture on it, in the background after the list returns (measured: about 20 ms of CPU and 12 MB of memory for each scan-sized picture, and the peak grows with the number of pages). `maxImageSize: 0` stops the decoding but also drops the picture from the list. So the count comes from the file's own structure: every image's dictionary (its width and height) sits uncompressed in front of its data, because the format never puts streams inside compressed object streams. The reader finds `/Subtype /Image` in the raw bytes and reads a small window around each; soft masks and masks, which are images belonging to another image, are left out. 20–48 ms for an 18 MB file.

Other files that cannot be read honestly are refused with their own reason:

- **Password to open:** "PDF này cần mật khẩu để mở. Hãy mở bằng trình đọc PDF, lưu lại bản không mật khẩu rồi thử lại." (A PDF that only restricts printing or copying opens normally; those restrictions are not about reading.)
- **Text in old Vietnamese font encodings** (TCVN3, VNI, or fonts with no Unicode map) extracts as mojibake, which the detector cannot read and which would go to the AI unmasked in effect. When a page's text is mostly characters outside Vietnamese and common punctuation, the page is treated like a scanned page with the reason "chữ dùng phông cũ, chưa đọc được", rather than masked badly.

### Where it lives

- PDF joins **Tài liệu**, as 0078 anticipated: the drop zone and picker accept `.docx`, `.odt` and `.pdf`; the home start box's hint reads "Excel, CSV, Word, PDF, TXT". `fileKind` sends `.pdf` to the document page; the faded "PDF · Sắp có" sidebar item goes away; "Hình ảnh · Sắp có" stays, and the start box's upcoming message becomes about images only.
- Steps 1 and 3 are the same as Word. Step 2's download is `.md` instead of the original format, and the button says so ("Tải tệp đã ẩn (.md)"). Step 3 restores what the AI returned: a pasted reply, or a dropped `.md`, `.txt`, `.docx` or `.odt`. There is no restored PDF. Step 2 also offers "Sao chép", which copies the masked Markdown to paste straight into the AI and opens step 3 on the pasted-reply tab.
- The document source gains a `pdf` format beside `docx` and `odt`; masking goes through `core/doc/mask.ts` unchanged. A PDF session is a `private-doc-v1` session with exactly the same fields (file name, paragraph count, the first 20 masked paragraphs with their marks, the alias table, never the document). It is told apart by its file name ending in `.pdf`, so the vault codec and stored sessions need no change.

## Privacy page and PRD

Nothing here changes networking, what is stored or where, permissions or input observation: pdf.js is bundled, loads no fonts or data from the network, and sessions keep the same fields. `landing/privacy.html` should need no change; `tests/privacy-contract.test.mjs` decides, and if it disagrees the page is updated first. Confirm at implementation that pdf.js is configured not to fetch CMaps or standard fonts from a CDN (they must be bundled or disabled); that would otherwise be automatic network access.

`PRD.md`'s "Deferred" line changes to keep scanned documents, images and OCR deferred and move PDFs with a text layer into scope.

## Plan

1. **Done.** `core/doc/pdf.ts`: open with pdf.js in the worker, read pages into paragraphs with page headings, classify each page (text, scanned, unreadable font), refuse encrypted files. Fixtures first (below).
2. **Done.** `document.ts` and `file-kind.ts`: route `.pdf`; add the `pdf` source format; write output as Markdown instead of a file copy.
3. **Done.** Tài liệu page: accept PDF, the scanned-pages notice, the `.md` download label, restore from `.md`/`.txt`.
4. **Done.** Sidebar and home: remove the PDF "Sắp có" item, update the card's file line and the start box messages.
5. Sample: "Thử với tệp mẫu" for PDF builds an invented two-page contract with one scanned page, generated at test/build time, never a real document.
6. **Done.** PRD line, this decision's follow-up record with versions and measurements, and `docs/product-direction.md`'s table.

**Fixtures, one per failure class** (the owner checks real files against the masked copy): words without space characters; two columns; a table; decomposed Vietnamese; a name split across lines; an invisible OCR text layer; form field values; a comment annotation; a text page with a large embedded picture and one with only a small logo; one scanned page among text pages; an all-scanned file; a TCVN3-encoded page; a password-protected file; a file with a print restriction only. Test PDFs are written by a small generator in `tests/`, not checked in from real sources. Keep `pnpm test`, `pnpm test:models` and `pnpm lint` green.

## Performance

Everything runs on the user's computer, offline: there is no server to absorb a slow file, and the recognition models already use most of the memory budget (on the WASM backend they live in the web process, which WebKit kills past 4 GB, decision 0128). PDF reading must therefore stay a small cost next to recognition.

**Do only the work text needs.** pdf.js is a viewer; most of its cost is drawing. Phase 1 never draws:

- No rendering, no canvas, no page images. Only the text of each page is asked for.
- Image data is never decoded (see above), and fonts are not loaded into the page (`disableFontFace`). pdf.js is given no URL for CMaps, standard fonts, ICC profiles or its WebAssembly decoders, and system fonts are off, so it has nowhere to fetch from; text needs none of them. The one loss: a PDF whose CJK text relies on Adobe's predefined CMaps without embedding its fonts reads poorly. Vietnamese PDFs embed their fonts.
- pdf.js is loaded on demand, the first time a PDF opens, so the app's start-up and the other pages pay nothing.

**Stream, don't hold.** Pages are read one at a time in the worker; after each, its page object is cleaned up and only its paragraphs are kept. The preview shows as soon as the first pages are read, while the rest are read in the background behind the shared progress panel with Hủy. The PDF's bytes are released once reading finishes; the masked output is written from paragraphs, never from the PDF.

**Recognition stays the expensive part and is already tuned:** the shared `scanTexts` reads each distinct text once, skips texts without letters, and works in small batches (0078). Repeated page headers, footers and page numbers, common in PDFs, therefore cost once.

**Budgets, measured before shipping** on the owner's Mac (native recognition) and an Intel/WASM build, with the largest fixture (300 pages, mixed text and images) and a real 20 MB statement:

| | Target |
| --- | --- |
| pdf.js loaded and first page in the preview | under 1 s |
| Text extraction, without recognition | under 20 ms per page on average |
| Memory added by reading, at its peak | under 150 MB above the same document as Word |
| Hủy | stops within one batch |

A budget that is missed is reported in the implementing decision with the measurement, not loosened silently. The limits of 20 MB and 300 pages are revisited with those numbers.

## Reader: what was built and measured

`desktop/src/core/doc/pdf.ts` opens a PDF and returns paragraphs, per-page kinds (`text`, `no-text`, `old-font`) and the notes above; `writePdfText` writes the masked Markdown. It is not wired to the worker or the Tài liệu page yet (steps 2–4). New refusal codes and their Vietnamese messages are in `DocError` and `useDocRun.ts`: `password`, `too-many-pages`, `scanned`, `old-font`.

**How it reads.**

- pdf.js runs in the same thread as its caller, through its "fake worker": the module `pdf.worker.mjs` is imported for its side effect of registering itself. Inside `files.worker.ts` this avoids a second worker holding a second copy of the file. The legacy build is used, so older WebKit on supported macOS versions runs it too.
- pdf.js already joins glyphs into words and turns a gap into a space item as wide as the gap. A space item wider than twice the font size becomes a tab, which is how table rows come out with tabs between cells. Lines on the same baseline join; consecutive lines less than 1.8 font sizes apart join into one paragraph with a space, unless one of them has a tab or the new line starts a list item.
- Columns are read in the file's own order. That is right for the layout software tested; a PDF that draws across both columns line by line would mix them. Not handled.
- Control characters that some fonts' Unicode maps add after a letter (seen as "Thị\u0005") are removed before NFC.
- Old fonts are spotted by counting characters TCVN3 and VNI produce: Latin letters Vietnamese does not use (ß, Ö, ä, ø), Latin-1 symbols (¸, µ, §; not « » °), private-use, control and replacement characters. A page is `old-font` when they are more than 10% of at least 20 letters. An ordinary German or French sentence and Chinese text stay below that.
- pdf.js 6 has no `isEvalSupported` option any more: it does not compile fonts with `eval`.

**Tests.** `tests/pdf.test.mjs` (19 tests) with `tests/pdf-fixtures.mjs`, which writes every fixture at test time with pdf-lib from invented text, plus two hand-written PDFs using the standard 40-bit RC4 security handler (pdf-lib cannot encrypt). Every fixture class in the plan is covered, plus a name under a black box (read, so masked) and a file with names in its title and author fields (absent from the output). One test replaces `fetch` and opens every fixture: no call.

**Measured** on the owner's Mac (Apple M1 Pro, 16 GB) in Node 24, with `node --expose-gc scripts/measure-pdf.mjs`. Each file is drawn twice. "Split fonts" uses the tests' Noto Sans, whose Latin and Vietnamese letters are separate subsets, so each line breaks into about 18 pieces (720 text items a page, a worst case). "One font" uses macOS's Arial, which has every letter, as a PDF exported from Word does. Warm second runs; the first run of a process adds about 125 ms to load pdf.js.

| File | First page | Per page | Image count | Peak RSS added | Kept after |
| --- | --- | --- | --- | --- | --- |
| 300 pages, 20 pictures, one font (12 MB) | 0.16 s | 2.7 ms | 20 ms | 39 MB | 2 MB |
| 300 pages, 20 pictures, split fonts (18 MB) | 0.59 s | 21.6 ms | 26 ms | 44 MB | 2 MB |
| 25 pages of large pictures, one font (19 MB) | 0.19 s | 8.9 ms | 29 ms | 39 MB | 0 MB |
| 25 pages of large pictures, split fonts (19 MB) | 0.22 s | 12.9 ms | 42 ms | 56 MB | 0 MB |

Against the budgets:

- **First page under 1 s:** met. About 200 ms of a 300-page file's first page is pdf.js walking the page tree when it opens the document; a short file opens in under 1 ms.
- **Under 20 ms per page:** met for the realistic files; **missed by the worst case**, at 20.5–21.6 ms. That file has about ten times the text items of an ordinary page, and the time is pdf.js's own text extraction. 300 such pages take about 6.5 s before recognition starts, which is why reading needs the progress panel.
- **Under 150 MB at the peak:** met, measured as RSS added: 39–56 MB, and 418 MB once, on the very first file a process read, while pdf.js loaded and V8 grew its heap. The JS heap including garbage peaks higher (80–120 MB realistic, about 525 MB for the worst case) before V8 collects it; what stays after reading is 0–3 MB. Since Word was not measured alongside, the comparison is with nothing, which is stricter.
- **Hủy:** not measured. Reading is one call that finishes the whole file; making it cancellable belongs with the worker wiring (step 2).
- The 20 MB and 300-page limits stand: at the realistic rate 300 pages read in under a second.

**Not verified:** WebKit (the measurements are Node's V8, not JavaScriptCore), the Intel/WASM build and its 4 GB limit, a real 20 MB bank statement (none was at hand; the 19 MB file is generated), real PDFs from Word, Google Docs, banks' statement systems and scanners.

**Dependencies.**

- `pdfjs-dist` 6.4.299 (Apache-2.0, by Mozilla; released 3 October 2026) is a dependency. Its optional `@napi-rs/canvas`, a native binding used to draw pages in Node, is not installed (`ignoredOptionalDependencies` in `pnpm-workspace.yaml`): nothing here draws. The WebAssembly decoders shipped in the package (OpenJPEG, JBIG2, QCMS) are never loaded, because `useWasm` is off and no `wasmUrl` is given.
- For tests and the measurement only: `pdf-lib` 1.17.1 (MIT; last release 2022) writes the fixtures, `@pdf-lib/fontkit` 1.1.1 (MIT) embeds fonts, and `@fontsource/noto-sans` 5.3.0 (OFL-1.1, already used by the landing page) provides them.
- Context7 was not available in this session; options were checked against the package's own type declarations and source.

`pnpm lint`, `pnpm typecheck` and `pnpm test` (377) pass. `pnpm test:models` fails on this machine with and without these changes, because the model files are not downloaded here.

## In the app

**Routing.** `core/doc/document.ts` opens a PDF when its first kilobyte holds `%PDF-`, whatever its name; `.md` and `.txt` open as a new `plain` source (`core/doc/plain.ts`: each non-empty line a paragraph, every line ending kept on writing), used only to restore what the AI returned for a PDF. `fileKind` sends `.pdf` to Tài liệu, from the home page, the Tài liệu drop zone and the macOS Finder service, whose `Info.plist` now offers `com.adobe.pdf`.

**Progress and Hủy while reading.** The worker sends a `progress` message after each page, and the page shows "Đang đọc trang 12 / 300" under the drop zone with Hủy. Hủy sends a `cancel` message; the reader checks it before each page. pdf.js works through promises, which never let a waiting message in, so the reader yields to the event loop with a timer whenever 50 ms have passed since the last yield (a timer every page would cost up to 4 ms a page). In the browser preview a 300-page file read at about 85 pages a second, and Hủy returned to the drop zone 44 ms after the click, with no error.

**Workers are built as ES modules** (`worker.format: "es"` in `vite.config.ts`). Vite's default builds each worker as one file with every dynamic import inlined, which put pdf.js in the files worker: 3.8 MB instead of 2.0 MB, loaded for every spreadsheet and Word file. As ES modules the files worker is 1.07 MB and pdf.js (0.49 MB and 1.24 MB) loads only when a PDF opens; SheetJS's code-page tables and the detection worker's native-recognition code split out the same way. Both workers were already started with `type: "module"`, and development always ran them as ES modules.

**Checked** in the browser preview (Chromium, development server and a production build): a three-page PDF with a phone number, an email, an account number, a scanned page and a large image opened with its two notes; masking, "Sao chép" (the copied Markdown has the three page headings and the scanned page's line), "Tải tệp đã ẩn (.md)" saving `Hợp đồng thuê (đã ẩn).md` (now `(offlinemasked)`, [0150](0150-offlinemasked-suffix.md)), and restoring a dropped `.md` reply (2 aliases restored, a foreign one listed, saved as `Trả lời (đã khôi phục).md`); the Word sample and the spreadsheet sample still open; an image dropped on the home page gets "Hình ảnh sắp được hỗ trợ…"; no request left localhost. `pnpm lint`, `pnpm typecheck` and `pnpm test` (380) pass.

**Not checked:** the desktop app's WebKit and its module workers loading chunks from the app's asset protocol (`pnpm desktop:dev` or a release build), the Finder service with a PDF, a phone-width layout of the new progress line, and recognition with the pack installed (the models are not downloaded on this machine).

**Seen in testing:** with the tests' two-subset Noto font, pdf.js sometimes puts a space inside a word where the font switches back from the Vietnamese subset ("Ngọ c"). The same text in one font reads correctly, so it is left as a property of the fixture font; a real PDF that switches fonts inside a word could show it too.

**Not changed:** `landing/product.html` still says "Chưa hỗ trợ PDF và hình ảnh" and lists no PDF. Pushing to main deploys the site, and the released app cannot open PDFs until the next release; update it with that release.

## Not decided here

- **A masked PDF that keeps the layout.** Options when there is demand: page images with real boxes (simple, true, heavy for AI), or a permissively licensed engine that removes content under a box. Either needs its own decision and its own leak tests (extract text from the output and assert no original value remains).
- **Scanned PDFs and images (phase 2):** OCR as an optional downloaded pack, like the recognition pack, with a review step before export. That will change `landing/privacy.html` (a new download) and needs its own decision.
