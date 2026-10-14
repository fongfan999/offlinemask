# 0086 — Old Excel files (.xls), read with SheetJS

Date: 14 October 2026. Status: chosen by the owner ("go with option 1") after [0085](0085-opendocument-spreadsheets.md) explained why `.xls` needs a reader library and that its current release is published only on the vendor's CDN.

## Why

Many Vietnamese banks and accounting systems still export statements and customer lists as `.xls`. These are dense in personal data, and analysing them is a common reason to ask an AI. Until now these files met "lưu lại thành .xlsx trước" before anything else.

## Dependency

| Package | Version | Licence | Source | Why |
| --- | --- | --- | --- | --- |
| `xlsx` (SheetJS Community Edition) | 0.20.3 | Apache-2.0 | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, pinned in `pnpm-lock.yaml` with integrity `sha512-oLDq3jw7…H+3AJA==` | Reads binary BIFF5/BIFF8 workbooks and the HTML or XML spreadsheets saved as `.xls` |

The npm registry's `xlsx` stops at 0.18.5, without the fixes for CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS) on crafted files; SheetJS publishes later versions only on its CDN. The lockfile's integrity hash makes every install fetch exactly this tarball. Upgrades are deliberate: change the URL, review the changelog, and keep this table current.

It is used only to read. It runs in the file worker, imported when an `.xls` is opened, with its code-page tables (`xlsx/dist/cpexcel.full.mjs`) for older files in Windows-1258 and other legacy encodings. The worker is built as one file, so the dependency adds about 0.9 MB to it (1.07 → 2.0 MB), loaded from disk the first time a file is opened. Splitting worker chunks would change the build for the recognition worker too and was not worth the risk. Context7 was not available in this session; the API was taken from the package's own type definitions.

## Decision

- `.xls` is read into the same in-memory ExcelJS workbook as `.xlsx` (`src/core/sheet/xls.ts`): values (numbers stay numbers, dates stay dates), number formats, merged cells and column widths. Header detection, column plans, the review list and restoring work unchanged.
- The masked copy is an `.xlsx` ("sao ke (đã ẩn).xlsx"), and the file states this before download: "Bản đã ẩn được lưu thành tệp .xlsx. Công thức được giữ bằng kết quả; màu và phông chữ không được giữ." Writing `.xls` again would need SheetJS's writer and loses more than it keeps.
- Very hidden sheets are skipped, as for `.xlsx`. Damaged and password-protected files get the unreadable message. Reading stops past the row limit, so a huge file is refused instead of filling memory.
- Copy: drop zone ".xlsx, .xls, .ods, .csv"; unsupported message "Chỉ hỗ trợ tệp Excel (.xlsx, .xls), .ods và .csv."

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` (257) pass. New tests use real files written by SheetJS: a BIFF8 `.xls` with a merged Vietnamese title, amounts and dates opens, masks and saves as an `.xlsx` that keeps the merge and numeric amounts. A BIFF5 (Excel 95) file opens, though SheetJS's BIFF5 writer cannot store Vietnamese, so that fixture is ASCII. An HTML table saved as `.xls` opens, and a truncated file is unreadable. In the browser preview, a synthetic BIFF8 statement opened with its title line, suggested hidden name and phone columns, kept amounts and showed the `.xlsx` note. Not verified: real bank exports and files from Excel 95 in Windows-1258; the owner's own `.xls` files are the next check.
