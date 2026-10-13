# 0076 — Spreadsheets: real .xlsx and .csv files, column-aware masking, file restore

Date: 13 October 2026. Status: requested by the owner. The spreadsheet screen was a two-row sample; the owner asked for the real flow: "select/drag & drop excels/csv file to the app, then the app previews the file … 10 or 20 first rows … like mailchimp, then preview mask, and mask all … download the new masked excel file … then reupload to unmask". Choices made with the owner: masking by column (a separate scan-every-cell option was tried and removed); keep values, sheets and basic look; warn before download when there is no passcode; up to 20 MB / 100 000 rows. This settles the PRD's open "exact XLSX feature subset" for the first version and covers FR-02, FR-08 and FR-09 for spreadsheets.

## Flow

Same three steps as the text page.

1. **Ẩn thông tin.** Drop a file on the drop zone or pick one ("Thử với tệp mẫu" opens an invented sample). The first 20 rows of each sheet show with a choice above every column, the way Mailchimp maps columns on import:
   - **Ẩn: <loại>** hides every non-empty cell of the column as `[TYPE_n_scope]` (Họ và tên, Số điện thoại, Email, Số tài khoản, Số thẻ, CCCD/CMND, Số giấy tờ, Địa chỉ, Mã giao dịch, Mã khách hàng, Ngày sinh, Tổ chức, Tên đăng nhập, Thông tin riêng tư);
   - **Quét nội dung** reads each cell with the text page's detector;
   - **Giữ nguyên** copies the column.

   Suggestions come from the header (Vietnamese and English phrases, marks and punctuation ignored) and, for unknown headers, from sample values (emails, Vietnamese phone numbers, title-case names, sentences → scan). Amounts, dates and statuses default to kept. A second option, **Quét từng ô** (scan every column), was offered first and then removed at the owner's request: "Quét nội dung" on a column already does that. "Xem trước bản đã ẩn" shows the result on the preview rows with the aliases the file will actually get; "Bản gốc" shows the rows as they are. "Ẩn toàn bộ n dòng" masks every row in the background.
2. **Tải về và gửi AI.** The masked first rows, "Đã ẩn n ô · m mã thay thế", and "Tải tệp đã ẩn", which saves `<tên> (đã ẩn).<xlsx|csv>` where the user chooses. Without a passcode, a notice says to keep the app open to restore the file later, with the passcode set-up in place (the owner's choice over a separate key file).
3. **Khôi phục.** Drop the file the AI returned (.xlsx or .csv). Known aliases are swapped back in every cell and header, restored values are highlighted in a preview, aliases from other files are listed and left alone, and "Tải tệp đã khôi phục" saves `<tên> (đã khôi phục).<ext>`. A second tab restores a reply pasted as text with the same alias table. After saving: "Khôi phục tệp khác" or "Ẩn bảng tính mới".

The same value of the same type gets one alias across columns, cells and sheets of a file, so the AI can still group, count and join.

## Supported subset

- **.xlsx:** every sheet except "very hidden" ones; the first row of each sheet is its header. Cells are read as displayed text (dates as dd/mm/yyyy, formula results, rich text). In the exported copy, edited cells become plain text; every other cell keeps its value, formula, number format and style, and sheets keep column widths. Charts, pivot tables and macros are not carried over, and the screen says so before download. .xls and .xlsm are refused with a hint to save as .xlsx.
- **.csv:** UTF-8 with or without BOM, else Windows-1258. The separator is the one used most in the header line outside quotes, because Vietnamese-locale Excel writes ";" and amounts contain commas. The export keeps the separator and line breaks and is written as UTF-8 with a BOM so Excel shows Vietnamese correctly.
- **Limits:** 20 MB and 100 000 data rows across sheets; larger files are refused with a reason. Restored cells come back as text even where the original was a number.

## Privacy and architecture

- Files are read with the HTML file picker or drop (`dragDropEnabled: false` on the window so the webview receives drops) and parsed in `src/workers/sheet.worker.ts`. Workbooks stay in that worker's memory; only display strings reach the page. Nothing is uploaded, and the app needs no file-read permission.
- Saving uses `tauri-plugin-dialog`'s save dialog, which adds exactly the chosen path to the fs scope, and `tauri-plugin-fs` `writeFile` (capabilities `dialog:allow-save`, `fs:allow-write-file`; no static scope). The browser preview downloads instead.
- A spreadsheet session (`private-sheet-v1`) stores the file name, the per-sheet plans and row counts, the masked first 20 rows, and the alias table. It never stores the workbook. With a passcode it goes into the vault like text sessions; without one it follows [0071](0071-history-needs-passcode.md) and [0072](0072-one-screen-without-history.md). After a restart, restoring still works; downloading the masked copy again needs the original file opened again.
- Scanned cells are sent to the existing text detector in batches of whole cells (≤ 40 000 characters, joined by blank lines), and spans are mapped back per cell. The text page and spreadsheets share the detector through `queueDetections`, so their requests take turns. Without the recognition pack, scanning finds email, phone and account-like values only, which the screen states.
- The spreadsheet sample (`createSession("excel")`, `maskedRows`) is removed; spreadsheet samples saved by earlier builds are dropped when history loads.

Code: `src/core/sheet/{columns,mask,files,sample}.ts`, `src/composables/useSheetRun.ts`, `src/pages/SheetPage.vue`, `src/components/SheetPreview.vue`, `src/adapters/sheet-files.ts`.

## Follow-up after the owner's first real file (same day)

A 1 058-row bank statement took too long, and the preview masked amounts as names. Its first rows are a merged title and account summary; the real header is row 5.

- **Header row.** `findHeaderRow` picks the first of the top 30 rows that fills at least 60 % of the columns with distinct short labels (not numbers); merged cells count once. Rows above it are the **preamble**: shown above the table, always scanned (the account holder's name is there) and never used as column names. Edits are keyed by the row's index in the sheet.
- **Suggestions.** Money and date headers (Số dư, Số tiền, Phí, Ngày giao dịch, Balance, Amount…) are kept, since nine-digit balances otherwise look like phone numbers. Counterparty headers (Bên gửi/nhận, Người nhận, Người thụ hưởng, Payee…) are scanned instead of hidden, so people are hidden and merchants (PHARMACITY, QR VIETTEL) stay readable.
- **Less work for the model.** Each distinct cell text is detected once and the result is shared by every cell with that text. Texts without a letter skip the model and meet only the fast email, phone and account rules. Name, organization and address spans with no letter are ignored. On the owner's file (counts only): about 5 300 cells and 77 000 characters before; 2 104 scanned cells, 670 distinct texts and about 27 000 characters for the model after, in 4 batches.
- **Progress.** While masking, the preview is replaced by one panel: "Đang chuẩn bị gói nhận diện…" while the model loads, then "Đang ẩn thông tin… n %" with a bar and "Còn khoảng …" once there is enough to estimate (the owner asked for percentages only: counts of distinct texts mean nothing to users); "Hủy" stops the run, keeping the file and its choices. While it runs, the view switch, hints, sheet tabs, notes and "Chọn tệp khác" are hidden; only the progress, "Hủy" and the busy button remain. Batches are 8 000 characters so the bar moves and cancelling is quick.
- **Rust.** The recognition models already have a native Rust runtime ([0046](0046-selected-pair-native-runtime.md)–[0048](0048-isolate-native-recognition.md)), measured much faster than WASM, but it is opt-in (`recognition-native-sidecar`, packaged builds) and the owner's 21 September direction keeps WASM as the default until offline GUI and platform qualification. Making it the default is a separate decision; spreadsheet masking would use it unchanged through the shared detector.

## Dependencies

Each version is at least two weeks old at the time of adding, and compatible with the Tauri 2.11 core already in use; newer plugin releases require Tauri 2.12 and would have pulled a core upgrade.

| Package | Version | Licence | Released | Why |
| --- | --- | --- | --- | --- |
| `exceljs` (npm) | 4.4.0 | MIT | 2023 | Read and write .xlsx with styles and formulas; loaded only in the spreadsheet worker (about 930 KB minified). |
| `papaparse` (npm) | 5.7.0 | MIT | 24 Aug 2026 | CSV parsing and writing with quoting. |
| `@types/papaparse` (npm, dev) | 5.5.2 | MIT | 13 Dec 2025 | Types. |
| `@tauri-apps/plugin-dialog` (npm) / `tauri-plugin-dialog` (crate) | 2.7.3 | MIT or Apache-2.0 | 31 Aug 2026 | System save dialog. |
| `@tauri-apps/plugin-fs` (npm) / `tauri-plugin-fs` (crate) | 2.5.2 | MIT or Apache-2.0 | 31 Aug 2026 | Write the file to the chosen path only. |

The crates are pinned with `=` in `src-tauri/Cargo.toml`; no existing crate changed version in `Cargo.lock`. `pnpm audit --prod` reports one new moderate advisory, in `uuid` via ExcelJS (GHSA for v3/v5/v6 with a caller-supplied buffer); ExcelJS generates v4 ids only. The other advisories (adm-zip, sharp, sprintf-js via the recognition libraries, source-map-js via Vue) predate this change.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (221; 12 new in `tests/sheet.test.mjs` cover header and value suggestions, the alias book, scanned cells, masking and restoring tables, scan batching, CSV separator, encoding and BOM, an XLSX round trip keeping formulas, number formats, bold header and column widths, refused files, and the vault codec), `cargo fmt --check` and `cargo clippy --all-targets -D warnings` passed. `pnpm test:models` could not run in this checkout because the model files under `artifacts/packs/` are absent; the pack file is unchanged.
- In the in-app browser: the sample CSV opened with every suggestion correct, the preview showed aliases including a phone number and an email found in notes; masking 30 rows hid 150 cells; the saved CSV had a BOM and the expected content; a returned CSV restored names and phone numbers, kept the AI's own column and reported a foreign alias; the restored file saved as "(đã khôi phục)". A two-sheet .xlsx with a formula opened in the worker, masked, saved and re-read with both sheets and the formula result intact. "Quét từng ô", 375 px width and dark mode were checked; the text page still masks.
- Not exercised: the desktop app's drop handling, save dialog and file write in WebKit; real Excel opening the exported files; performance near the 100 000-row limit.
