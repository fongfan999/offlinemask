# 0149 — PDF files that contain text (phase 1)

Date: 25 October 2026. Status: proposed, not implemented. Owner: "what should we do next?" for PDF and images → PDFs that already contain text first; scanned PDFs and images later, together, because both need OCR. This record is the plan for phase 1; implementation records its own findings in a later decision.

## Problem

Text, spreadsheets and Word are masked; PDF is the format people most often have for contracts, statements, invoices and CVs, and it is still "Sắp có" in the sidebar (decision 0087). PDF is harder than Word in two ways:

1. **Masking a PDF in place is easy to get dangerously wrong.** Drawing a black box over a name hides it on screen, but the name stays in the page's content and can be selected, copied, searched or read by any AI that reads the file. The same goes for the document's metadata, bookmarks, annotations, form fields, attachments and earlier revisions kept by incremental saves. A copy that looks masked but is not is worse than no feature.
2. **Some PDFs have no text at all.** A scanned PDF is a picture of each page. Without OCR there is nothing to read, so nothing to mask.

## Decision

### Output is masked text, not a rebuilt PDF

Phase 1 reads the text out of the PDF, masks it with the same detector and alias book as Word, and gives back **text**: "Sao chép" and "Tải tệp đã ẩn" saving `<tên> (đã ẩn).md`. It does not write a PDF.

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
- **Vietnamese:** text is normalised to NFC with `core/unicode.ts`, since PDFs often store "ệ" as a base letter and combining marks. Words split across lines ("Nguyễn Văn" ⏎ "An") are joined for detection the same way a Word paragraph is.
- **Invisible text** (render mode 3, the OCR layer some scanners add) is read like visible text. It is what the AI would read, so it must be masked too.
- **Limits:** up to 20 MB like Word, and up to 300 pages; larger files get a message instead of a slow, memory-heavy run. Pages are read one at a time and released, so a long PDF does not sit in memory twice.

### What we tell users about scanned PDFs

A page counts as scanned when it has no extractable text (or only a handful of characters, such as a page number) but does draw an image.

- **Every page scanned:** the file does not open. In the start box and on the Tài liệu page: "PDF này là ảnh scan nên OfflineMask chưa đọc được chữ. Hỗ trợ ảnh scan sắp có."
- **Some pages scanned:** the file opens. Above the preview: "Trang 3, 7 là ảnh scan nên chưa đọc được. Bản đã ẩn sẽ không có nội dung các trang này." In the output those pages appear as `## Trang 3` followed by `(Trang ảnh scan — không có trong bản đã ẩn)`, so the AI and the user see the gap instead of silently losing a page.
- Because the output is text built from what we read, a scanned page can never leak through: its picture is simply not in the output. The message is about completeness, not about risk.

Other files that cannot be read honestly are refused with their own reason:

- **Password to open:** "PDF này cần mật khẩu để mở. Hãy mở bằng trình đọc PDF, lưu lại bản không mật khẩu rồi thử lại." (A PDF that only restricts printing or copying opens normally; those restrictions are not about reading.)
- **Text in old Vietnamese font encodings** (TCVN3, VNI, or fonts with no Unicode map) extracts as mojibake, which the detector cannot read and which would go to the AI unmasked in effect. When a page's text is mostly characters outside Vietnamese and common punctuation, the page is treated like a scanned page with the reason "chữ dùng phông cũ, chưa đọc được", rather than masked badly.

### Where it lives

- PDF joins **Tài liệu**, as 0078 anticipated: the drop zone and picker accept `.docx`, `.odt` and `.pdf`; the home card's file line reads "Word, PDF". `fileKind` sends `.pdf` to the document page; the faded "PDF · Sắp có" sidebar item goes away; "Hình ảnh · Sắp có" stays, and the start box's upcoming message becomes about images only.
- Steps 1 and 3 are the same as Word. Step 2's download is `.md` instead of the original format, and the button says so ("Tải tệp đã ẩn (.md)"). Step 3 restores what the AI returned: a pasted reply, or a dropped `.md`, `.txt` or `.docx`. There is no restored PDF.
- The document source gains a `pdf` format beside `docx` and `odt`; masking goes through `core/doc/mask.ts` unchanged. A PDF session is a `private-doc-v1` session with the same fields (file name, paragraph count, the first 20 masked paragraphs with their marks, the alias table, never the document); the vault codec accepts the new format value.

## Privacy page and PRD

Nothing here changes networking, what is stored or where, permissions or input observation: pdf.js is bundled, loads no fonts or data from the network, and sessions keep the same fields. `landing/privacy.html` should need no change; `tests/privacy-contract.test.mjs` decides, and if it disagrees the page is updated first. Confirm at implementation that pdf.js is configured not to fetch CMaps or standard fonts from a CDN (they must be bundled or disabled); that would otherwise be automatic network access.

`PRD.md`'s "Deferred" line changes to keep scanned documents, images and OCR deferred and move PDFs with a text layer into scope.

## Plan

1. `core/doc/pdf.ts`: open with pdf.js in the worker, read pages into paragraphs with page headings, classify each page (text, scanned, unreadable font), refuse encrypted files. Fixtures first (below).
2. `document.ts` and `file-kind.ts`: route `.pdf`; add the `pdf` source format; write output as Markdown instead of a file copy.
3. Tài liệu page: accept PDF, the scanned-pages notice, the `.md` download label, restore from `.md`/`.txt`.
4. Sidebar and home: remove the PDF "Sắp có" item, update the card's file line and the start box messages.
5. Sample: "Thử với tệp mẫu" for PDF builds an invented two-page contract with one scanned page, generated at test/build time, never a real document.
6. PRD line, this decision's follow-up record with versions and measurements, and `docs/product-direction.md`'s table.

**Fixtures, one per failure class** (the owner checks real files against the masked copy): words without space characters; two columns; a table; decomposed Vietnamese; a name split across lines; an invisible OCR text layer; form field values; a comment annotation; one scanned page among text pages; an all-scanned file; a TCVN3-encoded page; a password-protected file; a file with a print restriction only. Test PDFs are written by a small generator in `tests/`, not checked in from real sources. Keep `pnpm test`, `pnpm test:models` and `pnpm lint` green.

**Effect on the user's computer:** small. pdf.js adds about a megabyte or two of JavaScript, loaded only when a PDF opens; reading a 50-page PDF takes about as long as opening it in a viewer, and recognition then runs as it does for Word. Measure on the owner's Mac and on an Intel/WASM build (decision 0128's 4 GB limit) with the largest fixture before shipping.

## Not decided here

- **A masked PDF that keeps the layout.** Options when there is demand: page images with real boxes (simple, true, heavy for AI), or a permissively licensed engine that removes content under a box. Either needs its own decision and its own leak tests (extract text from the output and assert no original value remains).
- **Scanned PDFs and images (phase 2):** OCR as an optional downloaded pack, like the recognition pack, with a review step before export. That will change `landing/privacy.html` (a new download) and needs its own decision.
