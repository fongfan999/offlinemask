# 0173. No limits, only estimates

Date: 29 October 2026. Status: decided by the owner.

## Context

Each kind of job had its own ceiling, picked when it was built: a text up to 50 000 characters ([0004](0004-text-processing.md)), a spreadsheet up to 20 MB and 100 000 rows ([0076](0076-spreadsheet-files.md)), a Word or OpenDocument file up to 20 MB ([0078](0078-word-documents.md), [0084](0084-opendocument-text.md)), a PDF up to 20 MB and 300 pages ([0149](0149-text-pdf-documents.md)), and a folder up to 5 000 files with each file up to 20 MB ([0171](0171-mask-a-whole-folder.md)). Over a ceiling the file was refused with "Hãy chia nhỏ…". Only the folder said up front how long it would take, and only the folder warned about a long job. The owner asked how to test the long cases across every screen and chose one simple rule instead: "remove all the limits, and show the estimation, and show the warning if it exceeds the threshold".

## Decision

- **No size, row, page, length or file-count limit.** Text of any length is accepted when pasted or opened from a file. Spreadsheets, Word, OpenDocument and PDF files of any size open. A PDF of any page count opens. A folder takes every supported file in it, whatever its size or count.
- **One estimate everywhere.** `composables/jobTime.ts` gives the seconds for a job: the characters the model will read, at 2 000 a second plus 5 seconds to load the model ([0171](0171-mask-a-whole-folder.md)'s measured pace), or 20 times quicker without the recognition pack. After a run of more than 20 000 characters on any page, the pace that run kept replaces the assumed one for the rest of the launch, in RAM only. What is counted:
  - **Text:** its length.
  - **Document:** the text of every paragraph.
  - **Spreadsheet:** the cells of columns set to "Quét nội dung", plus the lines above the header. The count follows the column choices.
  - **Folder:** the same counts for each of its files.
- **Shown beside the start button.** `JobTime` puts "🕒 Khoảng N phút trên máy này" in the footer of step 1. On a spreadsheet, document or folder it always shows. On a text it shows from one minute up, since short texts take a moment.
- **One warning over ten minutes.** `LongJobNote` appears above the content when the estimate passes ten minutes (`longJobSeconds`; first an hour, which the owner found far too long): "<Văn bản / Tài liệu / Bảng tính / Thư mục> này khá lớn. Cần khoảng N phút trên máy này. Bạn vẫn có thể bắt đầu…", with the suggestion of a machine kept for OfflineMask (no contact, no price). The job can always start.
- **ODS trailing rows.** ODS files often end with one empty row repeated a million times. The 100 000-row ceiling used to stop that from becoming a million-row grid. `odsGrid` now keeps empty rows only between rows with text, so the rows a sheet actually has come through at any count.
- **The app limits its own memory.** The old ceilings had also kept a large file from taking the machine's memory. In their place OfflineMask keeps to a budget of its own: a quarter of the machine's memory, between 1 and 4 GB (`core/memory.ts`, from the machine's figure that also sizes the folder's workers). Before a file is read, its need is estimated, and a file that needs more is refused with the figures: "Tệp này cần khoảng 4,7 GB bộ nhớ để mở, quá mức OfflineMask tự giới hạn trên máy này (4 GB). Hãy chia nhỏ tệp rồi thử lại."
  - **Measured.** Generated files were opened the way the app opens them (Node, 29 Oct 2026). Peak memory per byte was:
    - a CSV, about 9–11 times its size;
    - text, about 3 times;
    - a workbook, 12–14 times its unzipped XML;
    - a Word document, about 11 times its unzipped XML.
    The factors are rounded up to 12, 4, 15 and 13. An .xls, not measured, counts as 15.
  - **Zipped formats** (xlsx, ods, docx, odt) count by their unzipped size, read from the zip's central directory without inflating anything. Their compressed size says little: a 2 MB workbook needed 340 MB.
  - **PDF** cannot be judged by size, since a scan and a text PDF of the same size need very different amounts. Its own bytes count three times up front. While its pages are read, every character extracted counts 50 bytes (measured: about 95 MB per 1.9 million characters), and reading stops with "PDF này cần nhiều bộ nhớ hơn mức OfflineMask tự giới hạn…" past the budget.
  - **A folder** opens files side by side, one per worker. Each file is checked against its share of the budget, and one that does not fit is listed among the files not processed, with the reason.
  - **Cài đặt › Nâng cao.** The owner asked for the share to be adjustable but kept out of sight, since most people using the app are not technical. At the foot of the "Ứng dụng" card, a folded "Nâng cao" holds one choice, "Bộ nhớ cho OfflineMask": "Ít" (1/8), "Vừa (mặc định)" (1/4), "Nhiều" (1/2) and "Máy chỉ dùng cho OfflineMask" (3/4). Each shows its figure on this machine, with one line: "Tệp cần nhiều hơn mức này sẽ không mở, để máy không bị chậm. Chọn nhiều hơn nếu máy chỉ dùng để chạy OfflineMask." Never under 1 GB. Only the default stays under 4 GB; a share chosen on purpose is the user's, untested above that in the webview. The choice is stored like the theme (`offlinemask.memory.v1`, removed when back to the default), and the privacy page lists it among the settings. The section opens on its own when Settings opens with a choice other than the default; after that only the person opens or closes it (it first followed the choice, and picking the default folded it away mid-click). The choices are rows under the description, each with this machine's figure at the end. Refusals end with "…hoặc cho phép dùng nhiều hơn trong Cài đặt › Nâng cao." The ten-minute note is not configurable.

## Consequences

- The budget is an estimate from generated files on one machine. A file of an unusual shape can still need more than predicted. If that happens on real files, re-measure the factor rather than shrink the budget.
- The drop zones no longer say "tối đa 20 MB", and the "too-large", "too-many-rows" and "too-many-pages" errors and their messages are gone.
- The 2 000 characters a second is a measurement from one Apple-silicon Mac; slower machines correct themselves after their first large run.
- Testing: generated files make each case. For the warning, use a text of about 1.2 million characters, or a CSV whose sentence column has about 13 000 rows, or a folder of such files. For a memory refusal, use a CSV larger than the budget divided by 12 (about 170 MB on an 8 GB machine). Use the native engine (`pnpm -C desktop desktop:dev:native`) with the pack installed; without the pack the estimate is 20 times shorter.
