# 0078 — Word (.docx) documents

Date: 14 October 2026. Status: requested by the owner ("now support another file type, which one is low effort, high impact?" → Word; "go ahead with Word"). Word leaves the home page's "Sắp có" list; PDF and images stay there.

## Flow

The same three steps as Bảng tính ([0076](0076-spreadsheet-files.md)), on a new **Tài liệu** page (home card "Tài liệu · Word", sidebar entry "Tài liệu"). The owner chose the general category name, like "Bảng tính" for Excel and CSV, so other document formats such as PDF can join it later; "Word" names the format on the card and where files are dropped, and the internal id stays `word`:

1. Drop or pick a `.docx` (up to 20 MB; "Thử với tệp mẫu" builds an invented rental contract). The first 20 paragraphs show as a page with the aliases they will get; "Bản gốc" shows them unchanged. "Ẩn toàn bộ tài liệu" masks every paragraph in the background with the shared progress panel and Hủy.
2. "Tải tệp đã ẩn" saves `<tên> (đã ẩn).docx`; without a passcode the same keep-the-app-open notice as spreadsheets appears.
3. Drop the `.docx` the AI returned: known aliases are swapped back and highlighted, foreign ones listed; "Tải tệp đã khôi phục" saves `<tên> (đã khôi phục).docx`. A second tab restores a pasted text reply. Step 1 reopens the same document to mask again as a new session.

There are no per-column choices: every paragraph is read by the detector with the available categories (email, phone and account rules always; names, addresses and other private information when the recognition pack is installed), as spreadsheet cells marked "Quét nội dung" are.

## What is read and written

- **Text parts:** the body (including tables and text boxes), headers, footers, footnotes, endnotes and comments. A paragraph is its `<w:t>` runs joined, with tabs and line breaks kept.
- **Tracked changes:** deleted text (`w:delText`) is still in the file, so it is read and masked like visible text. Field codes (`w:instrText`, for example a mailto hyperlink) are read as separate lines.
- **Links and metadata:** `mailto:` targets in the relationship parts get the same email alias as the text. The author and last-modified-by fields in the file's properties are cleared.
- **Formatting:** each replacement is written into the first run it covers, so it takes that run's formatting (a name split across a bold and a plain run becomes one bold alias); covered text in later runs is removed. Runs gain `xml:space="preserve"` when the new text starts or ends with a space.
- **Not checked:** images, charts and embedded objects stay in the file unchecked; the preview says so. Legacy `.doc` is refused with a hint to save as `.docx`.
- The opened document is never modified: each write builds a fresh copy, so masking again with the same file never carries earlier aliases.

## Architecture

- `src/core/doc/docx.ts` reads and writes `.docx` with JSZip and a small tag scanner (Word's XML is well formed, and `DOMParser` does not exist in workers). `src/core/doc/mask.ts` masks and restores paragraphs with the shared `AliasBook` and `detectionReplacements` (moved out of spreadsheet cell masking).
- The worker is now `src/workers/files.worker.ts` for both spreadsheets and documents; documents stay in it, in RAM.
- Shared with spreadsheets: `scanTexts` (each distinct text once, no model for texts without letters, small batches, cancel), `FileDropZone.vue`, `MaskProgress.vue`, the save dialog, the restore panel and the native detector ([0077](0077-native-recognition-windows.md)).
- A Word session (`private-doc-v1`) stores the file name, paragraph count, the first 20 masked paragraphs with their marks, and the alias table; never the document. The vault codec validates it like the others.

## Dependency

`jszip` 3.10.2 (MIT, offered as "MIT OR GPL-3.0-or-later"; released 8 September 2026) is now a direct dependency. It was already in the tree through ExcelJS at the same version, so no new code is shipped; the sample generator loads it only on demand.

## Verification

`pnpm lint`, `pnpm typecheck` and `pnpm test` (228; `tests/docx.test.mjs` covers XML escaping, paragraph reading across runs, tabs, breaks, tables, headers and deleted text, writing aliases into the first covered run with formatting kept, mailto links and author fields, an unchanged source after writing, restoring including a foreign alias, refused files, and the vault codec) passed. In the in-app browser: the sample contract opened, the preview masked the CCCD, two phone numbers and an email; masking, saving, re-opening the saved file as the "AI's" file, restoring and saving produced the original values; step 1 reopened the document; the home page shows three cards; phone width and dark mode were checked. Not verified: real Word opening the exported files, very large documents, and the native engine on this page (it shares the detector already measured in 0077).

## Known gap

The local account-number rule needs its label before the number ("số tài khoản 0071…"); "tài khoản số 0071…" in the sample is not caught without the recognition pack. This is the shared text rule, not specific to Word.
