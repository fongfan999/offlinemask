# 0085 — OpenDocument spreadsheets (.ods); old Excel (.xls) waits for a reader

Date: 14 October 2026. Status: the owner asked for `.xls` and `.ods`; `.ods` is done, `.xls` is pending a dependency decision.

## .ods

Bảng tính opens, masks, saves and restores `.ods` files like `.xlsx` ([0076](0076-spreadsheet-files.md)), with the same header detection, per-column plan and review list ([0079](0079-file-review-and-capital-names.md)). There is no new dependency: `src/core/sheet/ods.ts` reads `content.xml` with the same kind of tag scanner as `.odt` ([0084](0084-opendocument-text.md)).

- **Reading.** Each cell's text is what a person sees: its `text:p` paragraphs, with encoded spaces, tabs and breaks. Comments are not cell text. Covered cells, the hidden part of a merged range, read as empty, like Excel's merged cells. Repeated cells and rows (`number-columns-repeated`, `number-rows-repeated`) expand to their copies, and the long run of empty rows LibreOffice ends every sheet with is dropped.
- **Writing.** The copy is the same package with only the hidden cells rewritten, so it stays an `.ods`. Every other cell keeps its value, formula and style. A hidden cell becomes a plain text cell with its style, as in `.xlsx`; its numeric value, formula and comment are removed, because they would show the original (a phone number stored as a number, for example). A repeated cell or row is split around the copy being edited. The package cleanup shared with `.odt` clears authors in `meta.xml`, comments and tracked changes, removes the first-page thumbnail and keeps `mimetype` first and stored.
- **Copy.** Home card "Excel, ODS, CSV"; drop zone "Kéo thả bảng tính vào đây" with ".xlsx, .ods, .csv"; the unreadable message names LibreOffice and passwords.

Verified: `pnpm lint`, `pnpm typecheck` and `pnpm test` (253) pass. The new tests cover:
- reading display text, repeats, merged cells, comments and a million trailing empty rows;
- writing with split repeats, untouched numbers and formulas, a numeric phone turned into text, cleared authors and thumbnail, `mimetype` first, and reopening;
- refusing a package that is not a spreadsheet.

In the browser preview, a synthetic `.ods` opened with the expected column suggestions and masked six cells. Not verified: files written by LibreOffice itself (it is not installed here), and opening the masked copy in LibreOffice.

## .xls (pending, then done in [0086](0086-old-excel-files.md))

Old Excel files are binary (BIFF inside an OLE container), and many Vietnamese bank "xls" exports are really HTML or XML spreadsheets. Reading them safely needs a maintained reader. The usual one, SheetJS Community Edition (Apache-2.0), publishes current versions only on its own CDN (`cdn.sheetjs.com`). The npm registry copy (0.18.5) lacks fixes for a prototype-pollution issue (CVE-2023-30533) and a ReDoS (CVE-2024-22363), and untrusted files are exactly what this app opens. Installing 0.20.3 from the CDN was blocked by this session's permission policy, because it fetches code from outside the npm registry. The owner decides whether to allow it. If allowed, the plan is: read `.xls` with SheetJS in the file worker only (loaded on demand), convert it to the in-memory ExcelJS workbook the `.xlsx` path uses, and save the masked copy as `.xlsx`, with values, merged cells and column widths. Until then the message stays "Tệp .xls cũ hãy lưu lại thành .xlsx trước".
